import type { BrickInstance } from '../../types/model';
import { isBrickOnGrid } from '../grid/gridEngine';
import {
  isSlopedSnapCandidate,
  type SnapCandidate,
} from './snapEngine';

/**
 * Free placement and cardinal connector snaps use the body grid. A sloped
 * connector is intentionally different: its connector frame is the precise
 * placement constraint and may rotate the body's bounds off the cardinal grid.
 */
export function isSnapPlacementGridCompatible(
  contact: Pick<SnapCandidate, 'source' | 'target'>,
  brick: BrickInstance,
): boolean {
  return isSlopedSnapCandidate(contact) || isBrickOnGrid(brick);
}

