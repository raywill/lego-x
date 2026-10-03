import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

import { ROTATION_STEP } from '../../config/brickConfig';
import type { BrickInstance, EulerTuple, Vec3Tuple } from '../../types/model';

export type QuarterTurnDirection = -1 | 1;

interface OrthogonalOrientation {
  quaternion: Quaternion;
  rotation: EulerTuple;
}

const CARDINAL_DIRECTIONS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
] as const;

const ANGLE_EPSILON = 1e-8;
const ORTHOGONAL_ORIENTATIONS = createOrthogonalOrientations();

/** Every rigid orientation obtainable with 90-degree turns (the cube rotation group). */
export const ORTHOGONAL_ROTATIONS: readonly EulerTuple[] = ORTHOGONAL_ORIENTATIONS
  .map(({ rotation }) => [...rotation]);

/**
 * Rotates a brick around a world-space cardinal axis, then canonicalises the
 * result to one of the 24 exact orthogonal orientations. This prevents Euler
 * gimbal behaviour and accumulated floating-point drift after many turns.
 */
export function rotateBrickByWorldQuarterTurn(
  brick: BrickInstance,
  worldAxis: Vec3Tuple,
  direction: QuarterTurnDirection,
): BrickInstance {
  const axis = new Vector3(...worldAxis);
  if (!isCardinalAxis(axis)) {
    throw new RangeError('Orthogonal rotation requires one cardinal world axis.');
  }
  axis.normalize();

  const current = new Quaternion().setFromEuler(new Euler(...brick.rotation, 'XYZ'));
  const delta = new Quaternion().setFromAxisAngle(axis, direction * ROTATION_STEP);
  const next = delta.multiply(current).normalize();
  const orientation = nearestOrthogonalOrientation(next);

  return {
    ...brick,
    position: [...brick.position],
    rotation: [...orientation.rotation],
  };
}

export function isOrthogonalRotation(rotation: EulerTuple): boolean {
  const quaternion = new Quaternion().setFromEuler(new Euler(...rotation, 'XYZ')).normalize();
  return ORTHOGONAL_ORIENTATIONS.some(({ quaternion: candidate }) => (
    1 - Math.abs(quaternion.dot(candidate)) <= ANGLE_EPSILON
  ));
}

function createOrthogonalOrientations(): OrthogonalOrientation[] {
  const orientations: OrthogonalOrientation[] = [];
  for (const up of CARDINAL_DIRECTIONS) {
    for (const forward of CARDINAL_DIRECTIONS) {
      if (Math.abs(up.dot(forward)) > ANGLE_EPSILON) continue;
      const right = new Vector3().crossVectors(up, forward);
      const quaternion = new Quaternion().setFromRotationMatrix(
        new Matrix4().makeBasis(right, up, forward),
      ).normalize();
      if (orientations.some(({ quaternion: existing }) => (
        1 - Math.abs(quaternion.dot(existing)) <= ANGLE_EPSILON
      ))) continue;
      orientations.push({
        quaternion,
        rotation: quaternionToQuarterTurnEuler(quaternion),
      });
    }
  }
  if (orientations.length !== 24) {
    throw new Error(`Expected 24 orthogonal orientations, found ${orientations.length}.`);
  }
  return orientations;
}

function nearestOrthogonalOrientation(quaternion: Quaternion): OrthogonalOrientation {
  let best = ORTHOGONAL_ORIENTATIONS[0];
  let bestDot = -1;
  for (const candidate of ORTHOGONAL_ORIENTATIONS) {
    const dot = Math.abs(quaternion.dot(candidate.quaternion));
    if (dot > bestDot) {
      best = candidate;
      bestDot = dot;
    }
  }
  return best;
}

function quaternionToQuarterTurnEuler(quaternion: Quaternion): EulerTuple {
  const euler = new Euler().setFromQuaternion(quaternion, 'XYZ');
  return [euler.x, euler.y, euler.z].map((angle) => {
    const snapped = Math.round(angle / ROTATION_STEP) * ROTATION_STEP;
    return Math.abs(snapped) <= ANGLE_EPSILON ? 0 : snapped;
  }) as EulerTuple;
}

function isCardinalAxis(axis: Vector3): boolean {
  if (Math.abs(axis.length() - 1) > ANGLE_EPSILON) return false;
  const nonZero = [axis.x, axis.y, axis.z]
    .filter((component) => Math.abs(component) > ANGLE_EPSILON);
  return nonZero.length === 1 && Math.abs(Math.abs(nonZero[0]) - 1) <= ANGLE_EPSILON;
}
