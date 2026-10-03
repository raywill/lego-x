import { Box3, Euler, Quaternion, Vector3 } from 'three';

import { getBrickDefinition } from '../../bricks/catalog';
import { BRICK_LAYER, PLACEMENT_GRID } from '../../config/brickConfig';
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
  const firstBounds = getBrickBodyBounds(first);
  const secondBounds = getBrickBodyBounds(second);
  if (!boundsOverlap(firstBounds, secondBounds)) return false;
  const overlap = firstBounds.clone().intersect(secondBounds);
  return !overlapFitsInsideCavity(first, overlap)
    && !overlapFitsInsideCavity(second, overlap);
}

export function getCollidingBrickIds(
  candidate: BrickInstance,
  others: readonly BrickInstance[],
  ignoredBrickIds: ReadonlySet<string> = new Set<string>(),
): string[] {
  return others
    .filter((other) => (
      other.id !== candidate.id
      && !ignoredBrickIds.has(other.id)
      && bricksOverlap(candidate, other)
    ))
    .map((other) => other.id);
}

function overlapFitsInsideCavity(brick: BrickInstance, overlap: Box3): boolean {
  const definition = getBrickDefinition(brick.definitionId);
  if (!definition || overlap.isEmpty()) return false;
  const geometry = definition.geometry;
  if (
    geometry.kind !== 'frame'
    && geometry.kind !== 'concaveArcBlock'
    && geometry.kind !== 'sphereOctantCutout'
  ) return false;

  const inverseRotation = new Quaternion()
    .setFromEuler(new Euler(...brick.rotation, 'XYZ'))
    .invert();
  const localCorners = boxCorners(overlap).map((corner) => (
    corner.sub(new Vector3(...brick.position)).applyQuaternion(inverseRotation)
  ));

  if (geometry.kind === 'frame') {
    const [width, height] = geometry.size;
    const innerWidth = width - geometry.wallThickness * 2;
    const innerHeight = height - geometry.wallThickness * 2;
    if (geometry.opening === 'square') {
      return localCorners.every(({ x, y }) => (
        Math.abs(x) <= innerWidth / 2 + COLLISION_EPSILON
        && Math.abs(y) <= innerHeight / 2 + COLLISION_EPSILON
      ));
    }
    if (geometry.opening === 'circle') {
      const radius = Math.min(innerWidth, innerHeight) / 2;
      return localCorners.every(({ x, y }) => (
        Math.hypot(x, y) <= radius + COLLISION_EPSILON
      ));
    }
    const radius = Math.min(innerWidth / 2, innerHeight);
    const bottom = -height / 2 + geometry.wallThickness;
    const centerY = height / 2 - geometry.wallThickness - radius;
    return localCorners.every(({ x, y }) => (
      y >= bottom - COLLISION_EPSILON
      && (
        y <= centerY
          ? Math.abs(x) <= radius + COLLISION_EPSILON
          : Math.hypot(x, y - centerY) <= radius + COLLISION_EPSILON
      )
    ));
  }

  if (geometry.kind === 'concaveArcBlock') {
    const centerX = geometry.size[0] / 2;
    const centerY = geometry.size[1] / 2;
    return localCorners.every(({ x, y }) => (
      x >= centerX - geometry.radius - COLLISION_EPSILON
      && y >= centerY - geometry.radius - COLLISION_EPSILON
      && Math.hypot(x - centerX, y - centerY) <= geometry.radius + COLLISION_EPSILON
    ));
  }

  const center = new Vector3(
    geometry.size[0] / 2,
    geometry.size[1] / 2,
    geometry.size[2] / 2,
  );
  return localCorners.every((point) => (
    point.x >= center.x - geometry.radius - COLLISION_EPSILON
    && point.y >= center.y - geometry.radius - COLLISION_EPSILON
    && point.z >= center.z - geometry.radius - COLLISION_EPSILON
    && point.distanceTo(center) <= geometry.radius + COLLISION_EPSILON
  ));
}

function boxCorners(box: Box3): Vector3[] {
  const result: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) result.push(new Vector3(x, y, z));
    }
  }
  return result;
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
            origin.position[0] + x * PLACEMENT_GRID,
            origin.position[1],
            origin.position[2] + z * PLACEMENT_GRID,
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
): BrickInstance[] {
  const placed: BrickInstance[] = [];
  for (const rawBrick of bricks) {
    let brick = snapBrickToGrid(rawBrick);
    for (let attempts = 0; attempts <= placed.length; attempts += 1) {
      const colliders = placed.filter((other) => (
        !ignoredPairKeys.has(brickPairKey(brick.id, other.id))
        && bricksOverlap(brick, other)
      ));
      if (colliders.length === 0) break;
      const bounds = getBrickBodyBounds(brick);
      const nextBottom = Math.max(...colliders.map((other) => getBrickBodyBounds(other).max.y));
      const lift = Math.ceil((nextBottom - bounds.min.y) / BRICK_LAYER) * BRICK_LAYER;
      brick = snapBrickToGrid({
        ...brick,
        position: [brick.position[0], brick.position[1] + Math.max(BRICK_LAYER, lift), brick.position[2]],
        rotation: [...brick.rotation],
      });
    }
    const stillCollides = placed.some((other) => (
      !ignoredPairKeys.has(brickPairKey(brick.id, other.id))
      && bricksOverlap(brick, other)
    ));
    if (stillCollides) brick = liftAboveAll(brick, placed);
    placed.push(brick);
  }
  return placed;
}

function liftAboveAll(brick: BrickInstance, others: readonly BrickInstance[]): BrickInstance {
  if (others.length === 0) return brick;
  const bounds = getBrickBodyBounds(brick);
  const highestTop = Math.max(...others.map((other) => getBrickBodyBounds(other).max.y));
  return snapBrickToGrid({
    ...brick,
    position: [brick.position[0], brick.position[1] + highestTop - bounds.min.y, brick.position[2]],
    rotation: [...brick.rotation],
  });
}

function overlapDepth(
  firstMin: number,
  firstMax: number,
  secondMin: number,
  secondMax: number,
): number {
  return Math.min(firstMax, secondMax) - Math.max(firstMin, secondMin);
}
