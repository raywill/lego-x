import { describe, expect, it } from 'vitest';

import type { BrickInstance } from '../../types/model';
import { findNextLowerSelectionPlacement } from './verticalMoveEngine';

function cube(id: string, position: BrickInstance['position']): BrickInstance {
  return { id, definitionId: 'cube-1', position, rotation: [0, 0, 0] };
}

describe('vertical selection movement', () => {
  it('lowers a single brick by one 5 mm layer when it fits', () => {
    const result = findNextLowerSelectionPlacement([cube('moving', [5, 25, 5])], []);

    expect(result?.descendedLayers).toBe(1);
    expect(result?.bricks[0].position).toEqual([5, 20, 5]);
  });

  it('skips occupied layers and finds the nearest lower cavity', () => {
    const moving = cube('moving', [5, 35, 5]);
    const roof = cube('roof', [5, 25, 5]);

    const result = findNextLowerSelectionPlacement([moving], [roof]);

    expect(result?.descendedLayers).toBe(4);
    expect(result?.bricks[0].position).toEqual([5, 15, 5]);
  });

  it('moves a multi-brick selection rigidly', () => {
    const result = findNextLowerSelectionPlacement([
      cube('a', [5, 25, 5]),
      cube('b', [15, 25, 5]),
    ], []);

    expect(result?.bricks.map(({ position }) => position)).toEqual([
      [5, 20, 5],
      [15, 20, 5],
    ]);
  });

  it('does not move a selection through the print bed', () => {
    expect(findNextLowerSelectionPlacement([cube('grounded', [5, 5, 5])], []))
      .toBeNull();
  });
});
