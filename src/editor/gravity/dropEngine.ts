import { Box3, Mesh, Object3D, Vector3 } from 'three';

import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import type {
  BrickInstance,
  EulerTuple,
  Vec3Tuple,
} from '../../types/model';

export type XZPoint = [x: number, z: number];

export interface XZContactRegion {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  width: number;
  depth: number;
  area: number;
  polygon: [XZPoint, XZPoint, XZPoint, XZPoint];
}

export interface DropResult {
  /** Final body transform position. X and Z always equal the input values. */
  position: Vec3Tuple;
  /** Rotation is returned unchanged so callers can apply one complete transform. */
  rotation: EulerTuple;
  supportY: number;
  supportBrickId: string | null;
  contact: XZContactRegion;
}

interface SupportCandidate {
  brickId: string;
  topY: number;
  contact: XZContactRegion;
}

const DROP_EPSILON = 1e-7;
const rotatedBodyBounds = new Map<string, Box3>();

export function isBrickAboveBed(brick: BrickInstance, bedY = 0): boolean {
  if (!Number.isFinite(bedY)) throw new RangeError('bedY must be a finite number.');
  return getBodyWorldBounds(brick).min.y >= bedY - DROP_EPSILON;
}

/**
 * Returns the same transform unless some body geometry is below the bed. In
 * that case the complete brick is lifted just enough to make its lowest point
 * touch the bed. This also handles rotated and compound pieces.
 */
export function keepBrickAboveBed(brick: BrickInstance, bedY = 0): BrickInstance {
  if (!Number.isFinite(bedY)) throw new RangeError('bedY must be a finite number.');
  const bounds = getBodyWorldBounds(brick);
  const lift = Math.max(0, bedY - bounds.min.y);
  return {
    ...brick,
    position: [brick.position[0], cleanNearZero(brick.position[1] + lift), brick.position[2]],
    rotation: [...brick.rotation],
  };
}

/** Lift a saved assembly as one unit so existing connections stay aligned. */
export function keepAssemblyAboveBed(
  bricks: readonly BrickInstance[],
  bedY = 0,
): BrickInstance[] {
  if (!Number.isFinite(bedY)) throw new RangeError('bedY must be a finite number.');
  if (bricks.length === 0) return [];
  const lowestY = Math.min(...bricks.map((brick) => getBodyWorldBounds(brick).min.y));
  const lift = Math.max(0, bedY - lowestY);
  return bricks.map((brick) => ({
    ...brick,
    position: [brick.position[0], cleanNearZero(brick.position[1] + lift), brick.position[2]],
    rotation: [...brick.rotation],
  }));
}

/**
 * Deterministically lowers a brick onto the highest body below its XZ
 * footprint, or onto the print bed when no brick has a positive-area overlap.
 * This is geometric placement only; it does not mutate instances or simulate
 * velocity, mass, or connected assemblies.
 */
export function computeDropPlacement(
  dragged: BrickInstance,
  others: readonly BrickInstance[],
  bedY = 0,
): DropResult {
  if (!Number.isFinite(bedY)) {
    throw new RangeError('bedY must be a finite number.');
  }

  const draggedBounds = getBodyWorldBounds(dragged);
  const bedContact = footprintRegion(draggedBounds);
  let supportY = bedY;
  let supportBrickId: string | null = null;
  let contact = bedContact;

  const candidates: SupportCandidate[] = [];
  for (const other of others) {
    if (other.id === dragged.id) continue;

    const otherBounds = getBodyWorldBounds(other);
    // Gravity only moves downward. A body whose top is above the currently
    // held brick cannot become a landing surface for this release.
    if (otherBounds.max.y > draggedBounds.min.y + DROP_EPSILON) continue;
    const overlap = intersectFootprints(draggedBounds, otherBounds);
    if (!overlap) continue;

    candidates.push({
      brickId: other.id,
      topY: otherBounds.max.y,
      contact: overlap,
    });
  }

  candidates.sort(compareSupports);
  const highest = candidates[0];
  if (highest && highest.topY > bedY + DROP_EPSILON) {
    supportY = highest.topY;
    supportBrickId = highest.brickId;
    contact = highest.contact;
  }

  const finalY = cleanNearZero(
    dragged.position[1] + supportY - draggedBounds.min.y,
  );

  return {
    position: [dragged.position[0], finalY, dragged.position[2]],
    rotation: [...dragged.rotation],
    supportY: cleanNearZero(supportY),
    supportBrickId,
    contact,
  };
}

function getBodyWorldBounds(instance: BrickInstance): Box3 {
  const definition = getBrickDefinition(instance.definitionId);
  if (!definition) {
    throw new Error(`Unknown brick definition: ${instance.definitionId}`);
  }

  const rotationKey = instance.rotation.map((value) => value.toFixed(8)).join(':');
  const cacheKey = `${definition.id}:${rotationKey}`;
  let originBounds = rotatedBodyBounds.get(cacheKey);
  if (!originBounds) {
    const group = createBrickGroup(definition, {
      includeConnectorGeometry: false,
    });
    try {
      group.rotation.set(...instance.rotation, 'XYZ');
      group.updateMatrixWorld(true);
      originBounds = new Box3().setFromObject(group, true);
      if (originBounds.isEmpty()) {
        throw new Error(`Brick definition has no body geometry: ${definition.id}`);
      }
      rotatedBodyBounds.set(cacheKey, originBounds.clone());
    } finally {
      disposeObject(group);
    }
  }
  return originBounds.clone().translate(new Vector3(...instance.position));
}

function footprintRegion(bounds: Box3): XZContactRegion {
  return createContactRegion(
    bounds.min.x,
    bounds.max.x,
    bounds.min.z,
    bounds.max.z,
  );
}

function intersectFootprints(
  first: Box3,
  second: Box3,
): XZContactRegion | null {
  const minX = Math.max(first.min.x, second.min.x);
  const maxX = Math.min(first.max.x, second.max.x);
  const minZ = Math.max(first.min.z, second.min.z);
  const maxZ = Math.min(first.max.z, second.max.z);

  // Touching along only an edge or a point cannot support a brick.
  if (maxX - minX <= DROP_EPSILON || maxZ - minZ <= DROP_EPSILON) {
    return null;
  }

  return createContactRegion(minX, maxX, minZ, maxZ);
}

function createContactRegion(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): XZContactRegion {
  const width = maxX - minX;
  const depth = maxZ - minZ;
  return {
    minX: cleanNearZero(minX),
    maxX: cleanNearZero(maxX),
    minZ: cleanNearZero(minZ),
    maxZ: cleanNearZero(maxZ),
    width: cleanNearZero(width),
    depth: cleanNearZero(depth),
    area: cleanNearZero(width * depth),
    polygon: [
      [cleanNearZero(minX), cleanNearZero(minZ)],
      [cleanNearZero(maxX), cleanNearZero(minZ)],
      [cleanNearZero(maxX), cleanNearZero(maxZ)],
      [cleanNearZero(minX), cleanNearZero(maxZ)],
    ],
  };
}

function compareSupports(
  first: SupportCandidate,
  second: SupportCandidate,
): number {
  const heightDifference = second.topY - first.topY;
  if (Math.abs(heightDifference) > DROP_EPSILON) return heightDifference;

  const areaDifference = second.contact.area - first.contact.area;
  if (Math.abs(areaDifference) > DROP_EPSILON) return areaDifference;

  if (first.brickId < second.brickId) return -1;
  if (first.brickId > second.brickId) return 1;
  return 0;
}

function disposeObject(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function cleanNearZero(value: number): number {
  return Math.abs(value) <= DROP_EPSILON ? 0 : value;
}
