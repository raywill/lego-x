import { Box3 } from 'three';

import { BRICK_LAYER, PLACEMENT_GRID } from '../../config/brickConfig';
import type { BrickInstance, Connection, Vec3Tuple } from '../../types/model';
import { bricksOverlap } from '../collision/collisionEngine';
import { getBrickBodyBounds, quantizeToGrid } from '../grid/gridEngine';

export interface DuplicatedBrickGroup {
  bricks: BrickInstance[];
  connections: Connection[];
  sourceToCopyId: Map<string, string>;
}

export function collectConnectedBrickIds(
  seedIds: readonly string[],
  connections: readonly Connection[],
): string[] {
  const selected = new Set(seedIds);
  const queue = [...selected];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const connection of connections) {
      let neighbor: string | null = null;
      if (connection.brickA === current) neighbor = connection.brickB;
      else if (connection.brickB === current) neighbor = connection.brickA;
      if (neighbor && !selected.has(neighbor)) {
        selected.add(neighbor);
        queue.push(neighbor);
      }
    }
  }
  return [...selected];
}

export function duplicateBrickGroup(
  bricks: readonly BrickInstance[],
  connections: readonly Connection[],
  selectedIds: readonly string[],
  makeId: () => string,
): DuplicatedBrickGroup {
  const selected = new Set(selectedIds);
  const sourceToCopyId = new Map<string, string>();
  const copies = bricks.filter((brick) => selected.has(brick.id)).map((brick) => {
    const id = makeId();
    sourceToCopyId.set(brick.id, id);
    return cloneBrick({ ...brick, id });
  });
  const copiedConnections = connections.flatMap((connection): Connection[] => {
    const brickA = sourceToCopyId.get(connection.brickA);
    const brickB = sourceToCopyId.get(connection.brickB);
    return brickA && brickB ? [{ ...connection, brickA, brickB }] : [];
  });
  return { bricks: copies, connections: copiedConnections, sourceToCopyId };
}

export function getGroupAnchor(bricks: readonly BrickInstance[]): Vec3Tuple {
  if (bricks.length === 0) return [0, 0, 0];
  const bounds = bricks.reduce(
    (combined, brick) => combined.union(getBrickBodyBounds(brick)),
    new Box3().makeEmpty(),
  );
  return [
    (bounds.min.x + bounds.max.x) / 2,
    bounds.min.y,
    (bounds.min.z + bounds.max.z) / 2,
  ];
}

/**
 * Moves a copied arrangement as a temporary rigid template, then lowers it
 * until the next layer would cross the bed or another physical brick.
 */
export function placeBrickGroup(
  bricks: readonly BrickInstance[],
  obstacles: readonly BrickInstance[],
  targetXZ: readonly [number, number],
): BrickInstance[] {
  if (bricks.length === 0) return [];
  const anchor = getGroupAnchor(bricks);
  const dx = quantizeToGrid(targetXZ[0] - anchor[0], PLACEMENT_GRID);
  const dz = quantizeToGrid(targetXZ[1] - anchor[2], PLACEMENT_GRID);
  const horizontallyMoved = translateGroup(bricks, [dx, 0, dz]);
  const groupBounds = combinedBounds(horizontallyMoved);
  const highestObstacle = obstacles.length === 0
    ? 0
    : Math.max(0, ...obstacles.map((brick) => getBrickBodyBounds(brick).max.y));
  const initialLift = Math.max(0, highestObstacle + BRICK_LAYER - groupBounds.min.y);
  let lastSafe = translateGroup(horizontallyMoved, [0, initialLift, 0]);
  const maxSteps = Math.ceil((combinedBounds(lastSafe).min.y + BRICK_LAYER) / BRICK_LAYER) + 2;

  for (let step = 1; step <= maxSteps; step += 1) {
    const candidate = translateGroup(lastSafe, [0, -BRICK_LAYER, 0]);
    if (
      combinedBounds(candidate).min.y < -1e-6
      || candidate.some((copy) => obstacles.some((other) => bricksOverlap(copy, other)))
    ) break;
    lastSafe = candidate;
  }
  return lastSafe;
}

function combinedBounds(bricks: readonly BrickInstance[]): Box3 {
  return bricks.reduce(
    (combined, brick) => combined.union(getBrickBodyBounds(brick)),
    new Box3().makeEmpty(),
  );
}

function translateGroup(
  bricks: readonly BrickInstance[],
  offset: Vec3Tuple,
): BrickInstance[] {
  return bricks.map((brick) => ({
    ...cloneBrick(brick),
    position: [
      brick.position[0] + offset[0],
      brick.position[1] + offset[1],
      brick.position[2] + offset[2],
    ],
  }));
}

function cloneBrick(brick: BrickInstance): BrickInstance {
  return {
    ...brick,
    position: [...brick.position],
    rotation: [...brick.rotation],
  };
}
