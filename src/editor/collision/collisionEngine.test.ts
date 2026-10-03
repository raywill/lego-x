import { describe, expect, it } from 'vitest';

import type { BrickInstance } from '../../types/model';
import {
  bricksOverlap,
  findNearestFreeGridPlacement,
  separateOverlappingBricks,
} from './collisionEngine';
import { getBrickBodyBounds, isGridMultiple } from '../grid/gridEngine';
import { PLACEMENT_GRID } from '../../config/brickConfig';

function cube(id: string, position: BrickInstance['position']): BrickInstance {
  return { id, definitionId: 'cube-1', position, rotation: [0, 0, 0] };
}

function brick(
  id: string,
  definitionId: string,
  position: BrickInstance['position'],
  rotation: BrickInstance['rotation'] = [0, 0, 0],
): BrickInstance {
  return { id, definitionId, position, rotation };
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

  it('uses the half-grid when it is the nearest free non-overlapping position', () => {
    const original = brick(
      'original',
      'plate-1x2',
      [2.5, 10, 5],
      [0, 0, Math.PI / 2],
    );
    const duplicate = findNearestFreeGridPlacement(
      { ...original, id: 'copy' },
      [original],
    );
    const bounds = getBrickBodyBounds(duplicate);

    expect(bricksOverlap(original, duplicate)).toBe(false);
    expect(isGridMultiple(bounds.min.x, PLACEMENT_GRID)).toBe(true);
    expect(isGridMultiple(bounds.min.z, PLACEMENT_GRID)).toBe(true);
    expect(Math.max(
      Math.abs(duplicate.position[0] - original.position[0]),
      Math.abs(duplicate.position[2] - original.position[2]),
    )).toBe(PLACEMENT_GRID);
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

  it.each(['frame-square', 'frame-circle', 'frame-arch'])(
    'allows a small block through the real opening of %s but rejects its frame',
    (definitionId) => {
      const frame = brick('frame', definitionId, [0, 15, 0]);
      const centered = cube('centered', [0, 15, 0]);
      const touchingFrame = cube('touching-frame', [9, 15, 0]);

      expect(bricksOverlap(frame, centered)).toBe(false);
      expect(bricksOverlap(frame, touchingFrame)).toBe(true);
    },
  );

  it('keeps a frame opening usable after a quarter turn', () => {
    const frame = brick('frame', 'frame-square', [0, 15, 0], [0, Math.PI / 2, 0]);
    const centered = cube('centered', [0, 15, 0]);

    expect(bricksOverlap(frame, centered)).toBe(false);
  });
});
