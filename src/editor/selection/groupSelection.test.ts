import { describe, expect, it } from 'vitest';

import type { BrickInstance, Connection } from '../../types/model';
import { bricksOverlap } from '../collision/collisionEngine';
import {
  duplicateBrickGroup,
  placeBrickGroup,
} from './groupSelection';

const brick = (id: string, position: BrickInstance['position']): BrickInstance => ({
  id,
  definitionId: 'cube-1',
  position,
  rotation: [0, 0, 0],
});

const connection = (brickA: string, brickB: string): Connection => ({
  brickA,
  connectorA: 'top-stud-0-0',
  brickB,
  connectorB: 'bottom-socket-0-0',
});

describe('group selection helpers', () => {
  it('copies only internal connections and remaps both endpoints', () => {
    let nextId = 0;
    const result = duplicateBrickGroup(
      [brick('a', [5, 5, 5]), brick('b', [5, 15, 5]), brick('c', [15, 5, 5])],
      [connection('a', 'b'), connection('b', 'c')],
      ['a', 'b'],
      () => `copy-${nextId += 1}`,
    );

    expect(result.bricks.map(({ id }) => id)).toEqual(['copy-1', 'copy-2']);
    expect(result.connections).toEqual([connection('copy-1', 'copy-2')]);
    expect(result.sourceToCopyId.get('a')).toBe('copy-1');
  });

  it('preserves relative transforms and lands the group without overlap', () => {
    const originals = [brick('a', [5, 5, 5]), brick('b', [5, 15, 5])];
    const copies = originals.map((item, index) => ({ ...item, id: `copy-${index}` }));
    const placed = placeBrickGroup(copies, originals, [25, 5]);

    expect(placed[1].position[1] - placed[0].position[1]).toBe(10);
    expect(placed[1].position[0] - placed[0].position[0]).toBe(0);
    expect(placed.every((copy) => originals.every((source) => !bricksOverlap(copy, source))))
      .toBe(true);
    expect(placed[0].position).toEqual([25, 5, 5]);
  });

  it('rests the whole copied template on top of an obstacle', () => {
    const placed = placeBrickGroup(
      [brick('copy-a', [5, 5, 5]), brick('copy-b', [15, 5, 5])],
      [brick('support', [25, 5, 5])],
      [30, 5],
    );

    expect(placed.map(({ position }) => position[1])).toEqual([15, 15]);
  });
});
