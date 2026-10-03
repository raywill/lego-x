import { Euler, Quaternion, Vector3 } from 'three';

import { BRICK_CONFIG } from '../../config/brickConfig';
import type {
  BrickDefinition,
  BrickInstance,
  Connection,
  ConnectorDefinition,
  EulerTuple,
  Vec3Tuple,
} from '../../types/model';

type QuaternionTuple = [number, number, number, number];

export interface WorldConnector {
  brickId: string;
  connectorId: string;
  connector: ConnectorDefinition;
  position: Vec3Tuple;
  quaternion: QuaternionTuple;
  /** The connector's local +Y axis transformed into world space. */
  normal: Vec3Tuple;
  /** The connector's local +Z axis transformed into world space. */
  twistReference: Vec3Tuple;
}

export interface SnapTransform {
  position: Vec3Tuple;
  rotation: EulerTuple;
}

export interface SnapContact {
  source: WorldConnector;
  target: WorldConnector;
  connection: Connection;
}

export interface SnapCandidate {
  draggedBrickId: string;
  draggedConnectorId: string;
  targetBrickId: string;
  targetConnectorId: string;
  source: WorldConnector;
  target: WorldConnector;
  transform: SnapTransform;
  distanceMm: number;
  angularCorrectionRad: number;
  score: number;
  committable: boolean;
  connection: Connection;
  /** Every compatible connector pair that coincides at the predicted transform. */
  contacts: SnapContact[];
}

export interface SnapEngineConfig {
  previewDistanceScale: number;
  commitDistanceScale: number;
  maxAngularCorrectionRad: number;
  angularWeightMmPerRad: number;
  epsilon: number;
}

export interface FindBestSnapInput {
  dragged: BrickInstance;
  draggedDefinition: BrickDefinition;
  targets: readonly WorldConnector[];
  /** Keys use the `${brickId}:${connectorId}` format. */
  occupiedConnectorKeys?: ReadonlySet<string>;
  config?: Partial<SnapEngineConfig>;
  /**
   * Optional interaction-space distance expressed in millimetre-equivalent
   * units. The editor uses this to map screen proximity back into the generic
   * snap thresholds while the final transform remains exact world geometry.
   */
  distanceResolver?: (source: WorldConnector, target: WorldConnector) => number;
}

export const DEFAULT_SNAP_ENGINE_CONFIG: Readonly<SnapEngineConfig> = {
  previewDistanceScale: 1.5,
  commitDistanceScale: 1,
  // A side connector may turn the brick by 90 degrees, but a same-facing
  // connector should not unexpectedly flip it all the way around.
  maxAngularCorrectionRad: Math.PI / 2 + 1e-6,
  angularWeightMmPerRad: 2,
  epsilon: 1e-6,
};

const OUTWARD_NORMAL = new Vector3(0, 1, 0);
const TWIST_REFERENCE = new Vector3(0, 0, 1);
const MATE_FLIP = new Quaternion().setFromAxisAngle(TWIST_REFERENCE, Math.PI);

export function areConnectorsCompatible(
  first: ConnectorDefinition,
  second: ConnectorDefinition,
): boolean {
  if (
    !first.compatibleWith.includes(second.type) ||
    !second.compatibleWith.includes(first.type)
  ) {
    return false;
  }

  const firstPolarity = first.polarity ?? 'neutral';
  const secondPolarity = second.polarity ?? 'neutral';

  return (
    firstPolarity === 'neutral' ||
    secondPolarity === 'neutral' ||
    firstPolarity !== secondPolarity
  );
}

export function getWorldConnectors(
  brick: BrickInstance,
  definition: BrickDefinition,
): WorldConnector[] {
  const brickPosition = vectorFromTuple(brick.position);
  const brickQuaternion = quaternionFromEuler(brick.rotation);

  return definition.connectors.map((connector) => {
    const localPosition = vectorFromTuple(connector.position);
    const localQuaternion = quaternionFromEuler(connector.rotation);
    const worldQuaternion = brickQuaternion.clone().multiply(localQuaternion).normalize();
    const worldPosition = localPosition
      .applyQuaternion(brickQuaternion)
      .add(brickPosition);

    return {
      brickId: brick.id,
      connectorId: connector.id,
      connector,
      position: vectorToTuple(worldPosition),
      quaternion: quaternionToTuple(worldQuaternion),
      normal: vectorToTuple(
        OUTWARD_NORMAL.clone().applyQuaternion(worldQuaternion).normalize(),
      ),
      twistReference: vectorToTuple(
        TWIST_REFERENCE.clone().applyQuaternion(worldQuaternion).normalize(),
      ),
    };
  });
}

/**
 * Returns the brick transform that puts `source` exactly onto `target`.
 * Connector +Y normals face one another and their +Z twist references agree.
 */
export function computeSnapTransform(
  source: ConnectorDefinition,
  target: WorldConnector,
): SnapTransform {
  const targetQuaternion = quaternionFromTuple(target.quaternion);
  const desiredSourceQuaternion = targetQuaternion.multiply(MATE_FLIP.clone());

  return transformForDesiredConnector(
    source,
    vectorFromTuple(target.position),
    desiredSourceQuaternion,
    DEFAULT_SNAP_ENGINE_CONFIG.epsilon,
  );
}

export function findBestSnap({
  dragged,
  draggedDefinition,
  targets,
  occupiedConnectorKeys = new Set<string>(),
  config: configOverrides,
  distanceResolver,
}: FindBestSnapInput): SnapCandidate | null {
  const config: SnapEngineConfig = {
    ...DEFAULT_SNAP_ENGINE_CONFIG,
    ...configOverrides,
  };
  const sources = getWorldConnectors(dragged, draggedDefinition);
  let best: SnapCandidate | null = null;

  for (const source of sources) {
    if (occupiedConnectorKeys.has(connectorKey(source.brickId, source.connectorId))) {
      continue;
    }

    const sourcePosition = vectorFromTuple(source.position);
    const sourceQuaternion = quaternionFromTuple(source.quaternion);

    for (const target of targets) {
      if (
        target.brickId === dragged.id ||
        occupiedConnectorKeys.has(connectorKey(target.brickId, target.connectorId)) ||
        !areConnectorsCompatible(source.connector, target.connector)
      ) {
        continue;
      }

      const targetPosition = vectorFromTuple(target.position);
      const resolvedDistance = distanceResolver
        ? distanceResolver(source, target)
        : sourcePosition.distanceTo(targetPosition);
      const distanceMm = Number.isFinite(resolvedDistance)
        ? Math.max(0, resolvedDistance)
        : Number.POSITIVE_INFINITY;
      const snapDistance = Math.min(
        validSnapDistance(source.connector.snapDistance),
        validSnapDistance(target.connector.snapDistance),
      );

      if (distanceMm > snapDistance * config.previewDistanceScale + config.epsilon) {
        continue;
      }

      const bestOrientation = findMatingOrientation(source, target, sourceQuaternion);

      if (
        bestOrientation === undefined ||
        bestOrientation.angularCorrectionRad >
          config.maxAngularCorrectionRad + config.epsilon
      ) {
        continue;
      }

      const transform = transformForDesiredConnector(
        source.connector,
        targetPosition,
        bestOrientation.desiredSourceQuaternion,
        config.epsilon,
      );
      const score =
        distanceMm +
        bestOrientation.angularCorrectionRad * config.angularWeightMmPerRad;
      const candidate: SnapCandidate = {
        draggedBrickId: dragged.id,
        draggedConnectorId: source.connectorId,
        targetBrickId: target.brickId,
        targetConnectorId: target.connectorId,
        source,
        target,
        transform,
        distanceMm,
        angularCorrectionRad: bestOrientation.angularCorrectionRad,
        score,
        committable:
          distanceMm <= snapDistance * config.commitDistanceScale + config.epsilon,
        connection: {
          brickA: dragged.id,
          connectorA: source.connectorId,
          brickB: target.brickId,
          connectorB: target.connectorId,
        },
        contacts: [],
      };

      if (best === null || candidate.score < best.score) {
        best = candidate;
      }
    }
  }

  if (!best) return null;
  return {
    ...best,
    contacts: collectAlignedContacts(
      dragged,
      draggedDefinition,
      best,
      targets,
      occupiedConnectorKeys,
    ),
  };
}

function collectAlignedContacts(
  dragged: BrickInstance,
  draggedDefinition: BrickDefinition,
  candidate: SnapCandidate,
  targets: readonly WorldConnector[],
  occupiedConnectorKeys: ReadonlySet<string>,
): SnapContact[] {
  const alignedDragged: BrickInstance = {
    ...dragged,
    position: [...candidate.transform.position],
    rotation: [...candidate.transform.rotation],
  };
  const alignedSources = getWorldConnectors(alignedDragged, draggedDefinition);
  const contacts: SnapContact[] = [];
  const usedSources = new Set<string>();
  const usedTargets = new Set<string>();

  const pairs = alignedSources.flatMap((source) => targets.map((target) => ({ source, target })));
  pairs.sort((first, second) => {
    const firstPrimary = first.source.connectorId === candidate.draggedConnectorId
      && first.target.brickId === candidate.targetBrickId
      && first.target.connectorId === candidate.targetConnectorId;
    const secondPrimary = second.source.connectorId === candidate.draggedConnectorId
      && second.target.brickId === candidate.targetBrickId
      && second.target.connectorId === candidate.targetConnectorId;
    if (firstPrimary !== secondPrimary) return firstPrimary ? -1 : 1;
    const firstKey = `${first.source.connectorId}:${first.target.brickId}:${first.target.connectorId}`;
    const secondKey = `${second.source.connectorId}:${second.target.brickId}:${second.target.connectorId}`;
    return firstKey.localeCompare(secondKey);
  });

  for (const { source, target } of pairs) {
    const sourceKey = connectorKey(source.brickId, source.connectorId);
    const targetKey = connectorKey(target.brickId, target.connectorId);
    if (
      target.brickId === dragged.id
      || occupiedConnectorKeys.has(sourceKey)
      || occupiedConnectorKeys.has(targetKey)
      || usedSources.has(sourceKey)
      || usedTargets.has(targetKey)
      || !areConnectorsCompatible(source.connector, target.connector)
    ) continue;

    const positionError = vectorFromTuple(source.position).distanceTo(
      vectorFromTuple(target.position),
    );
    const orientation = findMatingOrientation(
      source,
      target,
      quaternionFromTuple(source.quaternion),
    );
    if (
      positionError > 0.05
      || orientation === undefined
      || orientation.angularCorrectionRad > 1e-4
    ) continue;

    usedSources.add(sourceKey);
    usedTargets.add(targetKey);
    contacts.push({
      source,
      target,
      connection: {
        brickA: dragged.id,
        connectorA: source.connectorId,
        brickB: target.brickId,
        connectorB: target.connectorId,
      },
    });
  }

  return contacts;
}

function findMatingOrientation(
  source: WorldConnector,
  target: WorldConnector,
  sourceQuaternion: Quaternion,
): { desiredSourceQuaternion: Quaternion; angularCorrectionRad: number } | undefined {
  const targetQuaternion = quaternionFromTuple(target.quaternion);
  const twistSteps = Math.max(
    source.connector.twistSteps ?? 1,
    target.connector.twistSteps ?? 1,
  );
  let best:
    | { desiredSourceQuaternion: Quaternion; angularCorrectionRad: number }
    | undefined;

  for (let step = 0; step < twistSteps; step += 1) {
    const twist = new Quaternion().setFromAxisAngle(
      OUTWARD_NORMAL,
      (Math.PI * 2 * step) / twistSteps,
    );
    const desiredSourceQuaternion = targetQuaternion
      .clone()
      .multiply(twist)
      .multiply(MATE_FLIP.clone())
      .normalize();
    const angularCorrectionRad = sourceQuaternion.angleTo(desiredSourceQuaternion);
    if (best === undefined || angularCorrectionRad < best.angularCorrectionRad) {
      best = { desiredSourceQuaternion, angularCorrectionRad };
    }
  }

  return best;
}

function transformForDesiredConnector(
  source: ConnectorDefinition,
  targetPosition: Vector3,
  desiredSourceQuaternion: Quaternion,
  epsilon: number,
): SnapTransform {
  const sourceLocalQuaternion = quaternionFromEuler(source.rotation);
  const brickQuaternion = desiredSourceQuaternion
    .clone()
    .multiply(sourceLocalQuaternion.invert())
    .normalize();
  const rotatedSourceOffset = vectorFromTuple(source.position).applyQuaternion(
    brickQuaternion,
  );
  const brickPosition = targetPosition.clone().sub(rotatedSourceOffset);

  return {
    position: vectorToTuple(brickPosition, epsilon),
    rotation: quaternionToEulerTuple(brickQuaternion, epsilon),
  };
}

function connectorKey(brickId: string, connectorId: string): string {
  return `${brickId}:${connectorId}`;
}

function validSnapDistance(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : BRICK_CONFIG.snapDistance;
}

function vectorFromTuple(tuple: Vec3Tuple): Vector3 {
  return new Vector3(tuple[0], tuple[1], tuple[2]);
}

function vectorToTuple(vector: Vector3, epsilon = 0): Vec3Tuple {
  return [
    cleanNearZero(vector.x, epsilon),
    cleanNearZero(vector.y, epsilon),
    cleanNearZero(vector.z, epsilon),
  ];
}

function quaternionFromEuler(rotation: EulerTuple): Quaternion {
  return new Quaternion()
    .setFromEuler(new Euler(rotation[0], rotation[1], rotation[2], 'XYZ'))
    .normalize();
}

function quaternionFromTuple(tuple: QuaternionTuple): Quaternion {
  return new Quaternion(tuple[0], tuple[1], tuple[2], tuple[3]).normalize();
}

function quaternionToTuple(quaternion: Quaternion): QuaternionTuple {
  return [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
}

function quaternionToEulerTuple(
  quaternion: Quaternion,
  epsilon: number,
): EulerTuple {
  const euler = new Euler().setFromQuaternion(quaternion, 'XYZ');
  return [
    cleanNearZero(euler.x, epsilon),
    cleanNearZero(euler.y, epsilon),
    cleanNearZero(euler.z, epsilon),
  ];
}

function cleanNearZero(value: number, epsilon: number): number {
  return Math.abs(value) <= epsilon ? 0 : value;
}
