import { MathUtils } from 'three';

import { PLACEMENT_GRID } from '../../config/brickConfig';
import type { BrickInstance, Vec3Tuple } from '../../types/model';
import { hasBrickCollision } from '../collision/collisionEngine';
import {
  computeDropPlacement,
  isBrickAboveBed,
  type DropResult,
} from '../gravity/dropEngine';
import { snapBrickToGrid } from '../grid/gridEngine';

export interface InsertionPlacement {
  direct: BrickInstance;
  landed: BrickInstance;
  drop: DropResult;
}

/**
 * Tests a physical side-insertion path at the brick's current layer, then
 * applies gravity starting inside that layer rather than above the model.
 */
export function computeInsertionPlacement(
  dragged: BrickInstance,
  targetXZ: readonly [number, number],
  pathStart: Vec3Tuple,
  others: readonly BrickInstance[],
): InsertionPlacement | null {
  const direct = snapBrickToGrid({
    ...dragged,
    position: [targetXZ[0], dragged.position[1], targetXZ[1]],
    rotation: [...dragged.rotation],
  });
  if (
    !isBrickAboveBed(direct)
    || !isCollisionFreePath(dragged, pathStart, direct.position, others)
  ) return null;

  const drop = computeDropPlacement(direct, others);
  const landed: BrickInstance = {
    ...direct,
    position: [...drop.position],
    rotation: [...drop.rotation],
  };
  if (
    hasBrickCollision(landed, others)
    || !isCollisionFreePath(direct, direct.position, landed.position, others)
  ) return null;
  return { direct, landed, drop };
}

export function isCollisionFreePath(
  brick: BrickInstance,
  start: Vec3Tuple,
  end: Vec3Tuple,
  others: readonly BrickInstance[],
  sampleStep = PLACEMENT_GRID / 2,
): boolean {
  const distance = Math.hypot(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
  );
  const steps = Math.max(1, Math.ceil(distance / sampleStep));
  for (let index = 1; index <= steps; index += 1) {
    const progress = index / steps;
    const candidate: BrickInstance = {
      ...brick,
      position: [
        MathUtils.lerp(start[0], end[0], progress),
        MathUtils.lerp(start[1], end[1], progress),
        MathUtils.lerp(start[2], end[2], progress),
      ],
      rotation: [...brick.rotation],
    };
    if (hasBrickCollision(candidate, others)) return false;
  }
  return true;
}
