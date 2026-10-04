import { BRICK_LAYER } from '../../config/brickConfig';
import type { BrickInstance } from '../../types/model';
import { hasBrickCollision } from '../collision/collisionEngine';
import { getBrickBodyBounds } from '../grid/gridEngine';

export interface LowerSelectionResult {
  bricks: BrickInstance[];
  descendedLayers: number;
}

/**
 * Finds the next lower grid layer where the complete selection fits. Occupied
 * layers are skipped so Space can cycle from a roof into a valid cavity.
 */
export function findNextLowerSelectionPlacement(
  selected: readonly BrickInstance[],
  obstacles: readonly BrickInstance[],
): LowerSelectionResult | null {
  if (selected.length === 0) return null;
  const lowestBottom = Math.min(...selected.map((brick) => getBrickBodyBounds(brick).min.y));
  const maxLayers = Math.floor((lowestBottom + 1e-6) / BRICK_LAYER);

  for (let layers = 1; layers <= maxLayers; layers += 1) {
    const offsetY = -layers * BRICK_LAYER;
    const candidates = selected.map((brick): BrickInstance => ({
      ...brick,
      position: [brick.position[0], brick.position[1] + offsetY, brick.position[2]],
      rotation: [...brick.rotation],
    }));
    if (candidates.some((brick) => getBrickBodyBounds(brick).min.y < -1e-6)) break;
    if (candidates.some((brick) => hasBrickCollision(brick, obstacles))) continue;
    return { bricks: candidates, descendedLayers: layers };
  }
  return null;
}
