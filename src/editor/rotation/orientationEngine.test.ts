import { Euler, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { BRICK_DEFINITIONS, getBrickDefinition } from '../../bricks/catalog';
import type { BrickInstance, ConnectorType } from '../../types/model';
import { keepBrickAboveBed } from '../gravity/dropEngine';
import { getBrickBodyBounds, isBrickOnGrid, snapBrickToGrid } from '../grid/gridEngine';
import { isConnectionValid } from '../projectModel';
import { findBestSnap, getWorldConnectors } from '../snapping/snapEngine';
import {
  isOrthogonalRotation,
  ORTHOGONAL_ROTATIONS,
  rotateBrickByWorldQuarterTurn,
} from './orientationEngine';

function instance(
  id: string,
  definitionId: string,
  rotation: BrickInstance['rotation'] = [0, 0, 0],
): BrickInstance {
  return { id, definitionId, position: [0, 0, 0], rotation: [...rotation] };
}

describe('orthogonal orientation engine', () => {
  it('defines exactly 24 unique, exact orientations', () => {
    expect(ORTHOGONAL_ROTATIONS).toHaveLength(24);
    expect(ORTHOGONAL_ROTATIONS.every(isOrthogonalRotation)).toBe(true);
    const quaternionKeys = ORTHOGONAL_ROTATIONS.map((rotation) => {
      const quaternion = new Quaternion().setFromEuler(new Euler(...rotation, 'XYZ'));
      if (quaternion.w < 0) quaternion.set(
        -quaternion.x,
        -quaternion.y,
        -quaternion.z,
        -quaternion.w,
      );
      return quaternion.toArray().map((value) => value.toFixed(6)).join(':');
    });
    expect(new Set(quaternionKeys)).toHaveLength(24);
  });

  it('returns exactly to the starting orientation after four flips', () => {
    let brick = instance('turning', 'block-1x2');
    for (let index = 0; index < 4; index += 1) {
      brick = rotateBrickByWorldQuarterTurn(brick, [1, 0, 0], 1);
    }
    expect(brick.rotation).toEqual([0, 0, 0]);
  });

  it('keeps every catalog piece on-grid and above the bed in all 24 orientations', () => {
    for (const definition of BRICK_DEFINITIONS) {
      for (const rotation of ORTHOGONAL_ROTATIONS) {
        const brick = keepBrickAboveBed(snapBrickToGrid({
          ...instance(`test-${definition.id}`, definition.id, rotation),
          position: [3.2, 91.7, -4.4],
        }));
        expect(isBrickOnGrid(brick), `${definition.id} at ${rotation.join(',')}`).toBe(true);
        expect(getBrickBodyBounds(brick).min.y).toBeGreaterThanOrEqual(-1e-5);
        for (const connector of getWorldConnectors(brick, definition)) {
          expect([...connector.position, ...connector.normal].every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it.each([
    ['stud', 'socket', 'cube-1', 'cube-1'],
    ['rod', 'hole', 'axle', 'wheel'],
  ] as const)(
    'still aligns %s/%s connectors after a brick has been flipped',
    (sourceType, targetType, sourceDefinitionId, targetDefinitionId) => {
      const sourceDefinition = getBrickDefinition(sourceDefinitionId);
      const targetDefinition = getBrickDefinition(targetDefinitionId);
      if (!sourceDefinition || !targetDefinition) throw new Error('Missing test definitions.');
      const targetBrick = instance('target', targetDefinitionId);
      const target = getWorldConnectors(targetBrick, targetDefinition)
        .find(({ connector }) => connector.type === targetType);
      if (!target) throw new Error(`Missing ${targetType} target.`);

      let moving = rotateBrickByWorldQuarterTurn(
        instance('moving', sourceDefinitionId),
        [0, 0, 1],
        1,
      );
      const source = getWorldConnectors(moving, sourceDefinition)
        .filter(({ connector }) => connector.type === sourceType)
        .sort((first, second) => matingAngle(first.normal, target.normal)
          - matingAngle(second.normal, target.normal))[0];
      if (!source) throw new Error(`Missing ${sourceType} source.`);
      moving = {
        ...moving,
        position: [
          target.position[0] - source.position[0] + 0.2,
          target.position[1] - source.position[1],
          target.position[2] - source.position[2],
        ],
      };

      const candidate = findBestSnap({
        dragged: moving,
        draggedDefinition: sourceDefinition,
        targets: [target],
      });
      expect(candidate?.committable).toBe(true);
      const aligned: BrickInstance = {
        ...moving,
        position: [...candidate!.transform.position],
        rotation: [...candidate!.transform.rotation],
      };
      expect(isConnectionValid(candidate!.connection, [targetBrick, aligned])).toBe(true);
    },
  );
});

function matingAngle(first: readonly number[], second: readonly number[]): number {
  return new Vector3(...first as [number, number, number])
    .angleTo(new Vector3(...second as [number, number, number]).negate());
}
