import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';

import { BRICK_DEFINITIONS } from '../../bricks/catalog';
import { BRICK_LAYER, BRICK_UNIT } from '../../config/brickConfig';
import type { BrickInstance } from '../../types/model';
import {
  getBrickBodyBounds,
  isBrickOnGrid,
  isGridMultiple,
  snapBrickToGrid,
} from './gridEngine';

function instance(definitionId: string, position: BrickInstance['position'], rotation: BrickInstance['rotation'] = [0, 0, 0]): BrickInstance {
  return { id: `test-${definitionId}`, definitionId, position, rotation };
}

describe('integer placement grid', () => {
  it('uses cell edges as anchors for odd and even footprints', () => {
    const cube = snapBrickToGrid(instance('cube-1', [1.8, 7.2, -3.4]));
    const long = snapBrickToGrid(instance('block-1x2', [1.8, 7.2, -3.4]));

    expect(cube.position).toEqual([5, 5, -5]);
    expect(long.position).toEqual([0, 5, -5]);
    expect(isBrickOnGrid(cube)).toBe(true);
    expect(isBrickOnGrid(long)).toBe(true);
  });

  it('keeps a quarter-turned rectangular brick exactly on the grid', () => {
    const brick = snapBrickToGrid(instance('block-1x2', [8.7, 11.2, 13.1], [0, Math.PI / 2, 0]));
    const bounds = getBrickBodyBounds(brick);

    expect(isGridMultiple(bounds.min.x, BRICK_UNIT)).toBe(true);
    expect(isGridMultiple(bounds.min.y, BRICK_LAYER)).toBe(true);
    expect(isGridMultiple(bounds.min.z, BRICK_UNIT)).toBe(true);
  });

  it.each(BRICK_DEFINITIONS)('$id has a standard nominal and physical envelope', (definition) => {
    expect(isGridMultiple(definition.size[0], BRICK_UNIT)).toBe(true);
    expect(isGridMultiple(definition.size[1], BRICK_LAYER)).toBe(true);
    expect(isGridMultiple(definition.size[2], BRICK_UNIT)).toBe(true);

    const bounds = getBrickBodyBounds(instance(definition.id, [0, 0, 0]));
    const physicalSize = bounds.getSize(new Vector3());
    expect(isGridMultiple(physicalSize.x, BRICK_UNIT, 0.02)).toBe(true);
    expect(isGridMultiple(physicalSize.y, BRICK_LAYER, 0.02)).toBe(true);
    expect(isGridMultiple(physicalSize.z, BRICK_UNIT, 0.02)).toBe(true);
  });
});
