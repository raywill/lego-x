import { describe, expect, it } from 'vitest';

import type { BrickInstance } from '../../types/model';
import {
  bricksOverlap,
  findNearestFreeGridPlacement,
  separateOverlappingBricks,
} from './collisionEngine';

function cube(id: string, position: BrickInstance['position']): BrickInstance {
  return { id, definitionId: 'cube-1', position, rotation: [0, 0, 0] };
}

describe('brick collision constraints', () => {
  it('allows exact contact but rejects spatial penetration', () => {
    const base = cube('base', [5, 5, 5]);
    expect(bricksOverlap(base, cube('touching-side', [15, 5, 5]))).toBe(false);
    expect(bricksOverlap(base, cube('touching-top', [5, 15, 5]))).toBe(false);
    expect(bricksOverlap(base, cube('overlap', [5, 5, 5]))).toBe(true);
  });

  it('places a duplicate at the nearest free grid location', () => {
    const original = cube('original', [5, 5, 5]);
    const duplicate = findNearestFreeGridPlacement(
      cube('copy', [5, 5, 5]),
      [original],
    );

    expect(bricksOverlap(original, duplicate)).toBe(false);
    expect(duplicate.position).not.toEqual(original.position);
  });

  it('repairs overlapping legacy bricks by lifting later bodies', () => {
    const repaired = separateOverlappingBricks([
      cube('first', [5, 5, 5]),
      cube('second', [5, 5, 5]),
      cube('third', [5, 5, 5]),
    ]);

    expect(repaired.map((brick) => brick.position[1])).toEqual([5, 15, 25]);
    expect(bricksOverlap(repaired[0], repaired[1])).toBe(false);
    expect(bricksOverlap(repaired[1], repaired[2])).toBe(false);
  });
});
