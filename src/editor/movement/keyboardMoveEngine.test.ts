import { describe, expect, it } from 'vitest';

import type { BrickInstance } from '../../types/model';
import { isConnectionValid } from '../projectModel';
import {
  computeKeyboardMove,
  directionForArrow,
  getKeyboardMoveStep,
  MAX_AUTO_CLIMB_LAYERS,
  resolveViewGridAxes,
} from './keyboardMoveEngine';

function cube(id: string, position: BrickInstance['position']): BrickInstance {
  return { id, definitionId: 'cube-1', position, rotation: [0, 0, 0] };
}

describe('view-relative keyboard movement', () => {
  it('maps an angled view onto stable perpendicular grid axes', () => {
    const axes = resolveViewGridAxes(
      [0.8, 0, -0.6],
      [-0.5, -0.6, -0.7],
      [-0.3, 0.8, -0.4],
    );

    expect(axes.right).toEqual([1, 0]);
    expect(axes.up).toEqual([0, -1]);
    expect(directionForArrow('ArrowLeft', axes)).toEqual([-1, 0]);
    expect(directionForArrow('ArrowDown', axes)).toEqual([0, 1]);
  });

  it('uses screen-up for a true top view', () => {
    expect(resolveViewGridAxes(
      [1, 0, 0],
      [0, -1, 0],
      [0, 0, -1],
    )).toEqual({ right: [1, 0], up: [0, -1] });
  });

  it('moves off a high support and falls onto the lower support', () => {
    const selected = cube('moving', [5, 25, 5]);
    const result = computeKeyboardMove(selected, [cube('low-support', [15, 5, 5])], [1, 0]);

    expect(result?.brick.position).toEqual([15, 15, 5]);
    expect(result?.fellLayers).toBe(2);
  });

  it('moves an upright thin plate by half a cell in either horizontal direction', () => {
    const uprightPlate: BrickInstance = {
      id: 'upright-plate',
      definitionId: 'plate-1x2',
      position: [2.5, 10, 5],
      rotation: [0, 0, Math.PI / 2],
    };

    expect(getKeyboardMoveStep(uprightPlate)).toBe(5);
    const movedRight = computeKeyboardMove(uprightPlate, [], [1, 0])?.brick.position;
    const movedForward = computeKeyboardMove(uprightPlate, [], [0, 1])?.brick.position;
    expect(movedRight?.[0]).toBeCloseTo(7.5);
    expect(movedRight?.slice(1)).toEqual([10, 5]);
    expect(movedForward?.[0]).toBeCloseTo(2.5);
    expect(movedForward?.slice(1)).toEqual([10, 10]);
  });

  it('keeps the normal one-cell step for a full-size block', () => {
    const selected = cube('regular', [5, 5, 5]);
    expect(getKeyboardMoveStep(selected)).toBe(10);
    expect(computeKeyboardMove(selected, [], [1, 0])?.brick.position).toEqual([15, 5, 5]);
  });

  it('climbs one half-layer up a compatible wall without moving through it', () => {
    const selected = cube('moving', [5, 5, 5]);
    const wall = cube('wall', [15, 5, 5]);
    const result = computeKeyboardMove(selected, [wall], [1, 0]);

    expect(result?.brick.position).toEqual([5, 10, 5]);
    expect(result?.brick.rotation).toEqual(selected.rotation);
    expect(result?.climbedLayers).toBe(1);
    expect(result?.fellLayers).toBe(0);
    expect(result?.kind).toBe('wall-climb');
    expect(result?.wallConnection).not.toBeNull();
    expect(isConnectionValid(result!.wallConnection!, [result!.brick, wall])).toBe(true);
  });

  it('moves repeatedly up a tall wall in half-layer steps', () => {
    const wall = [5, 15, 25].map((y) => cube(`wall-${y}`, [15, y, 5]));
    let selected = cube('moving', [5, 5, 5]);

    for (const expectedY of [10, 15, 20, 25]) {
      const result = computeKeyboardMove(selected, wall, [1, 0]);
      expect(result?.kind).toBe('wall-climb');
      expect(result?.brick.position).toEqual([5, expectedY, 5]);
      expect(result?.wallConnection).not.toBeNull();
      selected = result!.brick;
    }
  });

  it('climbs a wide even-grid wall whose original side points miss the cube center', () => {
    const selected = cube('moving', [-5, 5, 0]);
    const wall: BrickInstance[] = [5, 15, 25].map((y) => ({
      id: `wide-wall-${y}`,
      definitionId: 'block-2x4',
      position: [20, y, 0],
      rotation: [0, 0, 0],
    }));
    const result = computeKeyboardMove(selected, wall, [1, 0]);

    expect(result?.kind).toBe('wall-climb');
    expect(result?.brick.position).toEqual([-5, 10, 0]);
    expect(result?.wallConnection?.connectorB).toMatch(/half-grid|cell-center/);
    expect(isConnectionValid(result!.wallConnection!, [result!.brick, ...wall])).toBe(true);
  });

  it('climbs the narrow side of a large brick with only 5 mm of face overlap', () => {
    const selected = cube('moving', [-5, 5, 10]);
    const wall: BrickInstance[] = [5, 15, 25].map((y) => ({
      id: `narrow-wall-${y}`,
      definitionId: 'block-2x4',
      position: [20, y, 0],
      rotation: [0, 0, 0],
    }));
    const result = computeKeyboardMove(selected, wall, [1, 0]);

    expect(result?.kind).toBe('wall-climb');
    expect(result?.brick.position).toEqual([-5, 10, 10]);
    expect(result?.wallConnection?.connectorB).toContain('cell-center');
  });

  it('climbs the wide front face of a large brick with only 5 mm of face overlap', () => {
    const selected = cube('moving', [20, 5, -15]);
    const wall: BrickInstance[] = [5, 15, 25].map((y) => ({
      id: `wide-front-wall-${y}`,
      definitionId: 'block-2x4',
      position: [0, y, 0],
      rotation: [0, 0, 0],
    }));
    const result = computeKeyboardMove(selected, wall, [0, 1]);

    expect(result?.kind).toBe('wall-climb');
    expect(result?.brick.position).toEqual([20, 10, -15]);
    expect(result?.wallConnection?.connectorB).toContain('cell-center');
  });

  it('lets a triangular piece climb by its planar cap without using its slope', () => {
    const triangle: BrickInstance = {
      id: 'triangle',
      definitionId: 'triangle-prism',
      position: [0, 10, 0],
      rotation: [0, 0, 0],
    };
    const wall = [5, 15, 25].map((y) => cube(`wall-${y}`, [0, y, 10]));
    const result = computeKeyboardMove(triangle, wall, [0, 1]);

    expect(result?.kind).toBe('wall-climb');
    expect(result?.brick.position).toEqual([0, 15, 0]);
    expect(result?.brick.rotation).toEqual([0, 0, 0]);
    expect(result?.wallConnection?.connectorA).toBe('front-wall-magnet');
  });

  it('crosses onto the top only after climbing beyond the wall face', () => {
    const wall = cube('wall', [15, 5, 5]);
    const first = computeKeyboardMove(cube('moving', [5, 5, 5]), [wall], [1, 0]);
    const second = computeKeyboardMove(first!.brick, [wall], [1, 0]);

    expect(first?.kind).toBe('wall-climb');
    expect(second?.kind).toBe('obstacle-climb');
    expect(second?.brick.position).toEqual([15, 15, 5]);
    expect(second?.wallConnection).toBeNull();
  });

  it('does not reuse a wall connector that another connection already occupies', () => {
    const selected = cube('moving', [5, 5, 5]);
    const wall = cube('wall', [15, 5, 5]);
    const available = computeKeyboardMove(selected, [wall], [1, 0]);
    const occupiedTarget = `${available!.wallConnection!.brickB}:${available!.wallConnection!.connectorB}`;
    const result = computeKeyboardMove(
      selected,
      [wall],
      [1, 0],
      MAX_AUTO_CLIMB_LAYERS,
      new Set([occupiedTarget]),
    );

    expect(result?.kind).toBe('wall-climb');
    expect(`${result!.wallConnection!.brickB}:${result!.wallConnection!.connectorB}`)
      .not.toBe(occupiedTarget);
  });

  it('does not climb through a low ceiling', () => {
    const selected = cube('moving', [5, 5, 5]);
    const scene = [
      cube('step', [15, 5, 5]),
      cube('ceiling', [5, 15, 5]),
    ];

    expect(computeKeyboardMove(selected, scene, [1, 0])).toBeNull();
  });
});
