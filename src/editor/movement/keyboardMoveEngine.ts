import { Vector3 } from 'three';

import { BRICK_LAYER, BRICK_UNIT } from '../../config/brickConfig';
import type { BrickInstance, Vec3Tuple } from '../../types/model';
import { hasBrickCollision } from '../collision/collisionEngine';
import { computeDropPlacement } from '../gravity/dropEngine';

export type GridDirection = readonly [x: -1 | 0 | 1, z: -1 | 0 | 1];

export interface KeyboardMoveResult {
  brick: BrickInstance;
  climbedLayers: number;
  fellLayers: number;
  waypoints: Vec3Tuple[];
}

export interface ViewGridAxes {
  right: GridDirection;
  up: GridDirection;
}

export const MAX_AUTO_CLIMB_LAYERS = 4;

/**
 * Maps screen directions onto two stable, perpendicular X/Z grid axes.
 * Forward is preferred for an angled/front view; screen-up is the fallback
 * for a true top view where camera forward has no horizontal component.
 */
export function resolveViewGridAxes(
  cameraRight: Vec3Tuple,
  cameraForward: Vec3Tuple,
  cameraUp: Vec3Tuple,
): ViewGridAxes {
  const rightReference = horizontal(cameraRight, [1, 0, 0]);
  const right = dominantGridAxis(rightReference);
  const projectedForward = new Vector3(cameraForward[0], 0, cameraForward[2]);
  const upReference = projectedForward.lengthSq() > 0.02
    ? projectedForward.normalize()
    : horizontal(cameraUp, [0, 0, -1]);
  const clockwise: GridDirection = [right[1], negateComponent(right[0])];
  const counterClockwise: GridDirection = [negateComponent(right[1]), right[0]];
  const clockwiseDot = clockwise[0] * upReference.x + clockwise[1] * upReference.z;
  const counterDot = counterClockwise[0] * upReference.x + counterClockwise[1] * upReference.z;
  return { right, up: clockwiseDot >= counterDot ? clockwise : counterClockwise };
}

export function directionForArrow(
  key: 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
  axes: ViewGridAxes,
): GridDirection {
  if (key === 'ArrowRight') return axes.right;
  if (key === 'ArrowLeft') return negateDirection(axes.right);
  if (key === 'ArrowUp') return axes.up;
  return negateDirection(axes.up);
}

export function computeKeyboardMove(
  selected: BrickInstance,
  others: readonly BrickInstance[],
  direction: GridDirection,
  maxClimbLayers = MAX_AUTO_CLIMB_LAYERS,
): KeyboardMoveResult | null {
  if (Math.abs(direction[0]) + Math.abs(direction[1]) !== 1) {
    throw new RangeError('Keyboard movement requires one cardinal grid direction.');
  }
  if (!Number.isInteger(maxClimbLayers) || maxClimbLayers < 0) {
    throw new RangeError('Maximum climb layers must be a non-negative integer.');
  }

  const scene = others.filter((brick) => brick.id !== selected.id);
  const destinationAtCurrentHeight = translated(selected, [
    direction[0] * BRICK_UNIT,
    0,
    direction[1] * BRICK_UNIT,
  ]);

  if (!hasBrickCollision(destinationAtCurrentHeight, scene)) {
    return landMove(selected, destinationAtCurrentHeight, scene, 0, []);
  }

  for (let layers = 1; layers <= maxClimbLayers; layers += 1) {
    const lift = layers * BRICK_LAYER;
    const liftedSource = translated(selected, [0, lift, 0]);
    if (!verticalPathIsClear(selected, liftedSource, scene)) break;

    const liftedDestination = translated(destinationAtCurrentHeight, [0, lift, 0]);
    if (!horizontalPathIsClear(liftedSource, liftedDestination, scene)) continue;

    return landMove(
      selected,
      liftedDestination,
      scene,
      layers,
      [[...liftedSource.position]],
    );
  }

  return null;
}

function landMove(
  selected: BrickInstance,
  heldDestination: BrickInstance,
  scene: readonly BrickInstance[],
  climbedLayers: number,
  leadingWaypoints: Vec3Tuple[],
): KeyboardMoveResult | null {
  const drop = computeDropPlacement(heldDestination, scene);
  const landed: BrickInstance = {
    ...heldDestination,
    position: [...drop.position],
    rotation: [...drop.rotation],
  };
  if (hasBrickCollision(landed, scene)) return null;
  const fallDistance = Math.max(0, heldDestination.position[1] - landed.position[1]);
  const fellLayers = Math.round(fallDistance / BRICK_LAYER);
  const waypoints: Vec3Tuple[] = [
    ...leadingWaypoints,
    [...heldDestination.position],
  ];
  if (fellLayers > 0) waypoints.push([...landed.position]);
  if (waypoints.length === 0 || !samePosition(waypoints.at(-1)!, landed.position)) {
    waypoints.push([...landed.position]);
  }
  return { brick: landed, climbedLayers, fellLayers, waypoints };
}

function verticalPathIsClear(
  start: BrickInstance,
  end: BrickInstance,
  scene: readonly BrickInstance[],
): boolean {
  const layers = Math.round((end.position[1] - start.position[1]) / BRICK_LAYER);
  for (let layer = 1; layer <= layers; layer += 1) {
    if (hasBrickCollision(translated(start, [0, layer * BRICK_LAYER, 0]), scene)) return false;
  }
  return true;
}

function horizontalPathIsClear(
  start: BrickInstance,
  end: BrickInstance,
  scene: readonly BrickInstance[],
): boolean {
  for (const progress of [0.25, 0.5, 0.75, 1]) {
    const candidate: BrickInstance = {
      ...start,
      position: [
        start.position[0] + (end.position[0] - start.position[0]) * progress,
        start.position[1],
        start.position[2] + (end.position[2] - start.position[2]) * progress,
      ],
      rotation: [...start.rotation],
    };
    if (hasBrickCollision(candidate, scene)) return false;
  }
  return true;
}

function translated(brick: BrickInstance, delta: Vec3Tuple): BrickInstance {
  return {
    ...brick,
    position: [
      brick.position[0] + delta[0],
      brick.position[1] + delta[1],
      brick.position[2] + delta[2],
    ],
    rotation: [...brick.rotation],
  };
}

function horizontal(value: Vec3Tuple, fallback: Vec3Tuple): Vector3 {
  const projected = new Vector3(value[0], 0, value[2]);
  if (projected.lengthSq() <= 1e-8) projected.set(fallback[0], 0, fallback[2]);
  return projected.normalize();
}

function dominantGridAxis(direction: Vector3): GridDirection {
  if (Math.abs(direction.x) >= Math.abs(direction.z)) {
    return [direction.x >= 0 ? 1 : -1, 0];
  }
  return [0, direction.z >= 0 ? 1 : -1];
}

function negateDirection(direction: GridDirection): GridDirection {
  return [negateComponent(direction[0]), negateComponent(direction[1])];
}

function negateComponent(value: -1 | 0 | 1): -1 | 0 | 1 {
  return value === 0 ? 0 : value === 1 ? -1 : 1;
}

function samePosition(first: readonly number[], second: readonly number[]): boolean {
  return first.every((value, index) => Math.abs(value - second[index]) <= 1e-6);
}
