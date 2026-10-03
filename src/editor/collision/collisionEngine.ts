import type { Box3 } from 'three';

import { BRICK_LAYER, BRICK_UNIT } from '../../config/brickConfig';
import type { BrickInstance } from '../../types/model';
import { getBrickBodyBounds, snapBrickToGrid } from '../grid/gridEngine';

export const COLLISION_EPSILON = 1e-4;

export function brickPairKey(firstId: string, secondId: string): string {
  return firstId < secondId ? `${firstId}\u0000${secondId}` : `${secondId}\u0000${firstId}`;
}

/**
 * Bodies may touch on a face, edge, or point. A collision only exists when
 * their occupied ranges penetrate by a measurable amount on all three axes.
 */
export function boundsOverlap(first: Box3, second: Box3): boolean {
  return overlapDepth(first.min.x, first.max.x, second.min.x, second.max.x) > COLLISION_EPSILON
    && overlapDepth(first.min.y, first.max.y, second.min.y, second.max.y) > COLLISION_EPSILON
    && overlapDepth(first.min.z, first.max.z, second.min.z, second.max.z) > COLLISION_EPSILON;
}

export function bricksOverlap(first: BrickInstance, second: BrickInstance): boolean {
  if (first.id === second.id) return false;
  return boundsOverlap(getBrickBodyBounds(first), getBrickBodyBounds(second));
}

export function getCollidingBrickIds(
  candidate: BrickInstance,
  others: readonly BrickInstance[],
  ignoredBrickIds: ReadonlySet<string> = new Set<string>(),
): string[] {
  const candidateBounds = getBrickBodyBounds(candidate);
  return others
    .filter((other) => (
      other.id !== candidate.id
      && !ignoredBrickIds.has(other.id)
      && boundsOverlap(candidateBounds, getBrickBodyBounds(other))
    ))
    .map((other) => other.id);
}

export function hasBrickCollision(
  candidate: BrickInstance,
  others: readonly BrickInstance[],
  ignoredBrickIds?: ReadonlySet<string>,
): boolean {
  return getCollidingBrickIds(candidate, others, ignoredBrickIds).length > 0;
}

/** Find the nearest free horizontal grid position without changing height. */
export function findNearestFreeGridPlacement(
  brick: BrickInstance,
  others: readonly BrickInstance[],
  maxRadiusInCells = 128,
): BrickInstance {
  const origin = snapBrickToGrid(brick);
  if (!hasBrickCollision(origin, others)) return origin;

  for (let radius = 1; radius <= maxRadiusInCells; radius += 1) {
    for (let x = -radius; x <= radius; x += 1) {
      for (let z = -radius; z <= radius; z += 1) {
        if (Math.max(Math.abs(x), Math.abs(z)) !== radius) continue;
        const candidate: BrickInstance = {
          ...origin,
          position: [
            origin.position[0] + x * BRICK_UNIT,
            origin.position[1],
            origin.position[2] + z * BRICK_UNIT,
          ],
          rotation: [...origin.rotation],
        };
        if (!hasBrickCollision(candidate, others)) return candidate;
      }
    }
  }

  return liftAboveAll(origin, others);
}

/**
 * Repairs legacy projects deterministically: earlier bricks stay put and any
 * later overlapping body is lifted by whole vertical layers until it is free.
 */
export function separateOverlappingBricks(
  bricks: readonly BrickInstance[],
  ignoredPairKeys: ReadonlySet<string> = new Set<string>(),
  preserveTransformBrickIds: ReadonlySet<string> = new Set<string>(),
): BrickInstance[] {
  const placed: BrickInstance[] = [];
  for (const rawBrick of bricks) {
    const preserveTransform = preserveTransformBrickIds.has(rawBrick.id);
    let brick = preserveTransform ? cloneBrick(rawBrick) : snapBrickToGrid(rawBrick);
    for (let attempts = 0; attempts <= placed.length; attempts += 1) {
      const colliders = placed.filter((other) => (
        !ignoredPairKeys.has(brickPairKey(brick.id, other.id))
        && bricksOverlap(brick, other)
      ));
      if (colliders.length === 0) break;
      const bounds = getBrickBodyBounds(brick);
      const nextBottom = Math.max(...colliders.map((other) => getBrickBodyBounds(other).max.y));
      const lift = Math.ceil((nextBottom - bounds.min.y) / BRICK_LAYER) * BRICK_LAYER;
      const lifted: BrickInstance = {
        ...brick,
        position: [brick.position[0], brick.position[1] + Math.max(BRICK_LAYER, lift), brick.position[2]],
        rotation: [...brick.rotation],
      };
      brick = preserveTransform ? lifted : snapBrickToGrid(lifted);
    }
    const stillCollides = placed.some((other) => (
      !ignoredPairKeys.has(brickPairKey(brick.id, other.id))
      && bricksOverlap(brick, other)
    ));
    if (stillCollides) brick = liftAboveAll(brick, placed, preserveTransform);
    placed.push(brick);
  }
  return placed;
}

function liftAboveAll(
  brick: BrickInstance,
  others: readonly BrickInstance[],
  preserveTransform = false,
): BrickInstance {
  if (others.length === 0) return brick;
  const bounds = getBrickBodyBounds(brick);
  const highestTop = Math.max(...others.map((other) => getBrickBodyBounds(other).max.y));
  const lifted: BrickInstance = {
    ...brick,
    position: [brick.position[0], brick.position[1] + highestTop - bounds.min.y, brick.position[2]],
    rotation: [...brick.rotation],
  };
  return preserveTransform ? lifted : snapBrickToGrid(lifted);
}

function cloneBrick(brick: BrickInstance): BrickInstance {
  return {
    ...brick,
    position: [...brick.position],
    rotation: [...brick.rotation],
  };
}

function overlapDepth(
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
): number {
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
}
