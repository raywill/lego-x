import { Box3, Mesh, Object3D, Vector3 } from 'three';

import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import { BRICK_LAYER, BRICK_UNIT, PLACEMENT_GRID } from '../../config/brickConfig';
import type { BrickDefinition, BrickInstance, Vec3Tuple } from '../../types/model';

export interface GridAxes {
  x?: boolean;
  y?: boolean;
  z?: boolean;
}

export const GRID_EPSILON = 1e-5;
const localBoundsCache = new Map<string, Box3>();

export function quantizeToGrid(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    throw new RangeError('Grid values and steps must be finite, with a positive step.');
  }
  const snapped = Math.round(value / step) * step;
  return Math.abs(snapped) <= GRID_EPSILON ? 0 : snapped;
}

export function isGridMultiple(value: number, step: number, epsilon = GRID_EPSILON): boolean {
  return Math.abs(value - quantizeToGrid(value, step)) <= epsilon;
}

export function getBrickBodyBounds(
  brick: BrickInstance,
  definitionOverride?: BrickDefinition,
): Box3 {
  const definition = definitionOverride ?? getBrickDefinition(brick.definitionId);
  if (!definition) throw new Error(`Unknown brick definition: ${brick.definitionId}`);
  const rotationKey = brick.rotation.map((value) => value.toFixed(8)).join(':');
  const cacheKey = `${definition.id}:${rotationKey}`;
  let localBounds = localBoundsCache.get(cacheKey);
  if (!localBounds) {
    const object = createBrickGroup(definition, { includeConnectorGeometry: false });
    try {
      object.rotation.set(...brick.rotation, 'XYZ');
      object.updateMatrixWorld(true);
      localBounds = new Box3().setFromObject(object, true);
      if (localBounds.isEmpty()) throw new Error(`Brick definition has no body geometry: ${definition.id}`);
      localBoundsCache.set(cacheKey, localBounds.clone());
    } finally {
      disposeObject(object);
    }
  }
  return localBounds.clone().translate(new Vector3(...brick.position));
}

/**
 * Snaps the body's minimum corner, not its center. The normal horizontal grid
 * remains one 10 mm brick unit, while an already exact half-grid transform or
 * a rotated 5 mm-thick body keeps the 5 mm precision lattice. This preserves
 * exact connector snaps without making ordinary free placement unnecessarily
 * fiddly.
 */
export function snapBrickToGrid(
  brick: BrickInstance,
  axes: GridAxes = { x: true, y: true, z: true },
  definition?: BrickDefinition,
): BrickInstance {
  const bounds = getBrickBodyBounds(brick, definition);
  const delta: Vec3Tuple = [0, 0, 0];
  if (axes.x !== false) {
    delta[0] = quantizeToGrid(
      bounds.min.x,
      horizontalSnapStep(bounds.min.x, bounds.max.x),
    ) - bounds.min.x;
  }
  if (axes.y !== false) delta[1] = quantizeToGrid(bounds.min.y, BRICK_LAYER) - bounds.min.y;
  if (axes.z !== false) {
    delta[2] = quantizeToGrid(
      bounds.min.z,
      horizontalSnapStep(bounds.min.z, bounds.max.z),
    ) - bounds.min.z;
  }
  return {
    ...brick,
    position: [
      clean(brick.position[0] + delta[0]),
      clean(brick.position[1] + delta[1]),
      clean(brick.position[2] + delta[2]),
    ],
    rotation: [...brick.rotation],
  };
}

export function isBrickOnGrid(
  brick: BrickInstance,
  axes: GridAxes = { x: true, y: true, z: true },
  definition?: BrickDefinition,
): boolean {
  const bounds = getBrickBodyBounds(brick, definition);
  return (axes.x === false || isGridMultiple(bounds.min.x, PLACEMENT_GRID))
    && (axes.y === false || isGridMultiple(bounds.min.y, BRICK_LAYER))
    && (axes.z === false || isGridMultiple(bounds.min.z, PLACEMENT_GRID));
}

function horizontalSnapStep(min: number, max: number): number {
  if (isGridMultiple(min, PLACEMENT_GRID)) return PLACEMENT_GRID;
  const size = max - min;
  return isGridMultiple(size, BRICK_UNIT, 0.02) ? BRICK_UNIT : PLACEMENT_GRID;
}

function clean(value: number): number {
  return Math.abs(value) <= GRID_EPSILON ? 0 : value;
}

function disposeObject(root: Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}
