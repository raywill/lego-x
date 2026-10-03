import { describe, expect, it } from 'vitest';

import type { BrickInstance } from '../../types/model';
import {
  computeKeyboardMove,
  directionForArrow,
  getKeyboardMoveStep,
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

  it('climbs the minimum number of layers to cross a one-brick obstacle', () => {
    const selected = cube('moving', [5, 5, 5]);
    const result = computeKeyboardMove(selected, [cube('step', [15, 5, 5])], [1, 0]);

    expect(result?.brick.position).toEqual([15, 15, 5]);
    expect(result?.climbedLayers).toBe(2);
    expect(result?.fellLayers).toBe(0);
  });

  it('stays put when the obstacle is higher than the auto-climb limit', () => {
    const selected = cube('moving', [5, 5, 5]);
    const wall = [5, 15, 25].map((y) => cube(`wall-${y}`, [15, y, 5]));

    expect(computeKeyboardMove(selected, wall, [1, 0])).toBeNull();
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
