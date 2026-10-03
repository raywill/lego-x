import { Box3, Mesh } from 'three';
import { BRICK_CONFIG, PRINT_BED } from '../config/brickConfig';
import { getBrickDefinition } from '../bricks/catalog';
import { createBrickGroup } from '../bricks/geometry';
import type { BrickInstance, Connection } from '../types/model';

export type PrintWarningKind = 'outside' | 'floating' | 'overhang';

export interface PrintWarning {
  kind: PrintWarningKind;
  message: string;
  brickIds: string[];
}

const BODY_CONTACT_TOLERANCE = 0.2;

function getGeometryBounds(brick: BrickInstance): Box3 | null {
  const definition = getBrickDefinition(brick.definitionId);
  if (!definition) return null;
  // Connector bumps are editor-only guides. Print checks must use the same
  // plain body geometry that is sent to STL export.
  const object = createBrickGroup(definition, { includeConnectorGeometry: false });
  object.position.set(...brick.position);
  object.rotation.set(...brick.rotation);
  object.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(object, true);
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
  return bounds;
}

function overlapAreaXZ(a: Box3, b: Box3): number {
  const x = Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x));
  const z = Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z));
  return x * z;
}

export function checkPrintability(bricks: BrickInstance[], connections: Connection[]): PrintWarning[] {
  if (bricks.length === 0) return [];

  const boundsById = new Map<string, Box3>();
  for (const brick of bricks) {
    const bounds = getGeometryBounds(brick);
    if (bounds) boundsById.set(brick.id, bounds);
  }

  const outside = bricks.filter((brick) => {
    const bounds = boundsById.get(brick.id);
    if (!bounds) return false;
    return bounds.min.x < -PRINT_BED.width / 2
      || bounds.max.x > PRINT_BED.width / 2
      || bounds.min.z < -PRINT_BED.depth / 2
      || bounds.max.z > PRINT_BED.depth / 2
      || bounds.min.y < -0.75
      || bounds.max.y > PRINT_BED.height;
  }).map((brick) => brick.id);

  const grounded = new Set(
    bricks.filter((brick) => (boundsById.get(brick.id)?.min.y ?? 1) <= 0.8).map((brick) => brick.id),
  );
  const graph = new Map<string, Set<string>>();
  for (const brick of bricks) graph.set(brick.id, new Set());
  // A gravity-landed body is physically supported even when it missed a
  // logical stud/socket. Mirror the drop heuristic so it is not mislabeled as
  // floating merely because there is no connector edge.
  for (let firstIndex = 0; firstIndex < bricks.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < bricks.length; secondIndex += 1) {
      const first = bricks[firstIndex];
      const second = bricks[secondIndex];
      const firstBounds = boundsById.get(first.id);
      const secondBounds = boundsById.get(second.id);
      if (!firstBounds || !secondBounds || overlapAreaXZ(firstBounds, secondBounds) <= 0.01) continue;
      const verticallyTouching = Math.abs(firstBounds.min.y - secondBounds.max.y) <= BODY_CONTACT_TOLERANCE
        || Math.abs(secondBounds.min.y - firstBounds.max.y) <= BODY_CONTACT_TOLERANCE;
      if (!verticallyTouching) continue;
      graph.get(first.id)?.add(second.id);
      graph.get(second.id)?.add(first.id);
    }
  }
  for (const connection of connections) {
    graph.get(connection.brickA)?.add(connection.brickB);
    graph.get(connection.brickB)?.add(connection.brickA);
  }

  const connectedToBed = new Set(grounded);
  const queue = [...grounded];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of graph.get(current) ?? []) {
      if (!connectedToBed.has(next)) {
        connectedToBed.add(next);
        queue.push(next);
      }
    }
  }
  const floating = bricks.filter((brick) => !connectedToBed.has(brick.id)).map((brick) => brick.id);

  const excessiveOverhang = bricks.filter((brick) => {
    const bounds = boundsById.get(brick.id);
    if (!bounds || bounds.min.y <= 0.8 || !connectedToBed.has(brick.id)) return false;
    const footprint = Math.max(1, (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z));
    // The final CSG union removes editor-only connector bumps. Keep only a
    // small tolerance here for rotated/compound body bounds and float noise.
    const contactOverlap = BRICK_CONFIG.matingOverlap + 0.35;
    let supportedArea = 0;
    for (const other of bricks) {
      if (other.id === brick.id) continue;
      const support = boundsById.get(other.id);
      if (!support) continue;
      const verticalGap = bounds.min.y - support.max.y;
      if (verticalGap >= -contactOverlap && verticalGap <= 2.5) {
        supportedArea += overlapAreaXZ(bounds, support);
      }
    }
    return Math.min(1, supportedArea / footprint) < 0.18;
  }).map((brick) => brick.id);

  const warnings: PrintWarning[] = [];
  if (outside.length) warnings.push({ kind: 'outside', message: '有积木跑出打印区域了', brickIds: outside });
  if (floating.length) warnings.push({ kind: 'floating', message: '有积木悬在空中', brickIds: floating });
  if (excessiveOverhang.length) warnings.push({ kind: 'overhang', message: '有些地方打印时可能需要支撑', brickIds: excessiveOverhang });
  return warnings;
}
