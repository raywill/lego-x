import { Box3, Mesh } from 'three';
import { describe, expect, it } from 'vitest';

import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import type { BrickInstance, EulerTuple, Vec3Tuple } from '../../types/model';
import { computeDropPlacement } from './dropEngine';

function brick(
  id: string,
  definitionId = 'cube-1',
  position: Vec3Tuple = [0, 5, 0],
  rotation: EulerTuple = [0, 0, 0],
): BrickInstance {
  return {
    id,
    definitionId,
    position: [...position],
    rotation: [...rotation],
  };
}

function bodyBounds(instance: BrickInstance): Box3 {
  const definition = getBrickDefinition(instance.definitionId);
  if (!definition) throw new Error(`Missing definition ${instance.definitionId}.`);
  const group = createBrickGroup(definition, {
    includeConnectorGeometry: false,
  });
  group.position.set(...instance.position);
  group.rotation.set(...instance.rotation, 'XYZ');
  group.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(group, true);
  group.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];
    materials.forEach((material) => material.dispose());
  });
  return bounds;
}

function placedBrick(source: BrickInstance, position: Vec3Tuple): BrickInstance {
  return { ...source, position: [...position], rotation: [...source.rotation] };
}

describe('computeDropPlacement', () => {
  it('drops a brick onto the print bed', () => {
    const dragged = brick('dragged', 'cube-1', [3, 80, -7]);
    const result = computeDropPlacement(dragged, []);

    expect(result.position).toEqual([3, 5, -7]);
    expect(result.rotation).toEqual(dragged.rotation);
    expect(result.supportY).toBe(0);
    expect(result.supportBrickId).toBeNull();
    expect(result.contact.area).toBeCloseTo(100);
    expect(bodyBounds(placedBrick(dragged, result.position)).min.y).toBeCloseTo(0);
  });

  it('drops a cube exactly onto another cube', () => {
    const support = brick('support');
    const dragged = brick('dragged', 'cube-1', [0, 60, 0]);
    const result = computeDropPlacement(dragged, [support]);

    expect(result.supportBrickId).toBe('support');
    expect(result.supportY).toBeCloseTo(10);
    expect(result.position).toEqual([0, 15, 0]);
    expect(bodyBounds(placedBrick(dragged, result.position)).min.y).toBeCloseTo(
      result.supportY,
    );
  });

  it('selects the highest of multiple overlapping supports', () => {
    const low = brick('low', 'cube-1', [0, 5, 0]);
    const high = brick('high', 'cube-1', [0, 25, 0]);
    const dragged = brick('dragged', 'cube-1', [0, 90, 0]);
    const result = computeDropPlacement(dragged, [low, high]);

    expect(result.supportBrickId).toBe('high');
    expect(result.supportY).toBeCloseTo(30);
    expect(result.position[1]).toBeCloseTo(35);
  });

  it('does not treat edge-only XZ contact as support', () => {
    const edgeNeighbour = brick('edge', 'cube-1', [10, 5, 0]);
    const dragged = brick('dragged', 'cube-1', [0, 40, 0]);
    const result = computeDropPlacement(dragged, [edgeNeighbour]);

    expect(result.supportBrickId).toBeNull();
    expect(result.supportY).toBe(0);
    expect(result.position[1]).toBeCloseTo(5);
  });

  it('uses the rotated body AABB while preserving a long brick rotation', () => {
    const support = brick('support', 'cube-1', [0, 5, 11]);
    const dragged = brick(
      'dragged',
      'block-1x2',
      [0, 70, 0],
      [0, Math.PI / 2, 0],
    );
    const result = computeDropPlacement(dragged, [support]);

    expect(result.supportBrickId).toBe('support');
    expect(result.position[0]).toBe(dragged.position[0]);
    expect(result.position[2]).toBe(dragged.position[2]);
    expect(result.rotation).toEqual(dragged.rotation);
    expect(result.contact.depth).toBeCloseTo(4);
    expect(bodyBounds(placedBrick(dragged, result.position)).min.y).toBeCloseTo(10);
  });

  it('drops a floating release to the bed when nearby bricks do not overlap', () => {
    const nearby = brick('nearby', 'cube-1', [30, 5, 0]);
    const dragged = brick('dragged', 'cube-1', [0, 120, 0]);
    const result = computeDropPlacement(dragged, [nearby, dragged]);

    expect(result.supportBrickId).toBeNull();
    expect(result.position).toEqual([0, 5, 0]);
    expect(result.contact.polygon).toEqual([
      [-5, -5],
      [5, -5],
      [5, 5],
      [-5, 5],
    ]);
  });

  it('never jumps upward to a surface above the held brick', () => {
    const overhead = brick('overhead', 'cube-1', [0, 35, 0]);
    const dragged = brick('dragged', 'cube-1', [0, 20, 0]);
    const result = computeDropPlacement(dragged, [overhead]);

    expect(result.supportBrickId).toBeNull();
    expect(result.position[1]).toBe(5);
  });
});
