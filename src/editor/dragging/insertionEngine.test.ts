import { describe, expect, it } from 'vitest';

import type { BrickInstance } from '../../types/model';
import { computeInsertionPlacement, isCollisionFreePath } from './insertionEngine';

function cube(id: string, position: BrickInstance['position']): BrickInstance {
  return { id, definitionId: 'cube-1', position, rotation: [0, 0, 0] };
}

describe('side insertion placement', () => {
  it('returns a brick to an open slot below a roof instead of jumping onto it', () => {
    const moving = cube('moving', [35, 15, 5]);
    const scene = [
      cube('floor', [5, 5, 5]),
      cube('roof', [5, 25, 5]),
      cube('left-wall', [-5, 15, 5]),
    ];

    const placement = computeInsertionPlacement(moving, [5, 5], moving.position, scene);

    expect(placement).not.toBeNull();
    expect(placement?.direct.position).toEqual([5, 15, 5]);
    expect(placement?.landed.position).toEqual([5, 15, 5]);
    expect(placement?.drop.supportBrickId).toBe('floor');
  });

  it('rejects a target when the horizontal route crosses solid material', () => {
    const moving = cube('moving', [35, 15, 5]);
    const wall = cube('wall', [15, 15, 5]);

    expect(computeInsertionPlacement(moving, [5, 5], moving.position, [wall])).toBeNull();
    expect(isCollisionFreePath(moving, moving.position, [5, 15, 5], [wall])).toBe(false);
  });

  it('applies gravity from inside the opening when there is no shelf at that layer', () => {
    const moving = cube('moving', [35, 25, 5]);
    const roof = cube('roof', [5, 35, 5]);

    const placement = computeInsertionPlacement(moving, [5, 5], moving.position, [roof]);

    expect(placement?.direct.position).toEqual([5, 25, 5]);
    expect(placement?.landed.position).toEqual([5, 5, 5]);
    expect(placement?.drop.supportBrickId).toBeNull();
  });
});
