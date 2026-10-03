import { PROJECT_VERSION } from '../config/brickConfig';
import { getBrickDefinition } from '../bricks/catalog';
import { areConnectorsCompatible, getWorldConnectors } from './snapping/snapEngine';
import type {
  BrickInstance,
  Connection,
  EulerTuple,
  ProjectData,
  ProjectSnapshot,
  Vec3Tuple,
} from '../types/model';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFiniteTuple = (value: unknown): value is Vec3Tuple | EulerTuple =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

const cloneBrick = (brick: BrickInstance): BrickInstance => ({
  ...brick,
  position: [...brick.position],
  rotation: [...brick.rotation],
});

const cloneConnection = (connection: Connection): Connection => ({ ...connection });

const connectionKey = (connection: Connection): string => {
  const endpointA = `${connection.brickA}\u0000${connection.connectorA}`;
  const endpointB = `${connection.brickB}\u0000${connection.connectorB}`;
  return endpointA < endpointB
    ? `${endpointA}\u0001${endpointB}`
    : `${endpointB}\u0001${endpointA}`;
};

const parseBrick = (value: unknown, seenIds: Set<string>): BrickInstance => {
  if (!isRecord(value)) {
    throw new Error('Invalid project: every brick must be an object.');
  }

  const { id, definitionId, position, rotation, color } = value;
  if (!isNonEmptyString(id) || seenIds.has(id)) {
    throw new Error('Invalid project: brick IDs must be unique, non-empty strings.');
  }
  if (!isNonEmptyString(definitionId) || !getBrickDefinition(definitionId)) {
    throw new Error(`Invalid project: unknown brick definition "${String(definitionId)}".`);
  }
  if (!isFiniteTuple(position) || !isFiniteTuple(rotation)) {
    throw new Error(`Invalid project: brick "${id}" has an invalid transform.`);
  }
  if (color !== undefined && typeof color !== 'string') {
    throw new Error(`Invalid project: brick "${id}" has an invalid color.`);
  }

  seenIds.add(id);
  return {
    id,
    definitionId,
    position: [...position],
    rotation: [...rotation],
    ...(color === undefined ? {} : { color }),
  };
};

const parseConnection = (
  value: unknown,
  bricksById: ReadonlyMap<string, BrickInstance>,
  seenConnections: Set<string>,
): Connection => {
  if (!isRecord(value)) {
    throw new Error('Invalid project: every connection must be an object.');
  }

  const { brickA, connectorA, brickB, connectorB } = value;
  if (
    !isNonEmptyString(brickA) ||
    !isNonEmptyString(connectorA) ||
    !isNonEmptyString(brickB) ||
    !isNonEmptyString(connectorB)
  ) {
    throw new Error('Invalid project: connection endpoints must be non-empty strings.');
  }
  if (brickA === brickB) {
    throw new Error('Invalid project: a brick cannot connect to itself.');
  }

  const instanceA = bricksById.get(brickA);
  const instanceB = bricksById.get(brickB);
  if (!instanceA || !instanceB) {
    throw new Error('Invalid project: a connection references a missing brick.');
  }

  const definitionA = getBrickDefinition(instanceA.definitionId);
  const definitionB = getBrickDefinition(instanceB.definitionId);
  if (
    !definitionA?.connectors.some((connector) => connector.id === connectorA) ||
    !definitionB?.connectors.some((connector) => connector.id === connectorB)
  ) {
    throw new Error('Invalid project: a connection references a missing connector.');
  }

  const connection = { brickA, connectorA, brickB, connectorB };
  const key = connectionKey(connection);
  if (seenConnections.has(key)) {
    throw new Error('Invalid project: duplicate connection.');
  }
  seenConnections.add(key);
  return connection;
};

export const isConnectionValid = (
  connection: Connection,
  bricks: readonly BrickInstance[],
  existingConnections: readonly Connection[] = [],
): boolean => {
  if (connection.brickA === connection.brickB) return false;
  const brickA = bricks.find((brick) => brick.id === connection.brickA);
  const brickB = bricks.find((brick) => brick.id === connection.brickB);
  if (!brickA || !brickB) return false;
  const definitionA = getBrickDefinition(brickA.definitionId);
  const definitionB = getBrickDefinition(brickB.definitionId);
  if (!definitionA || !definitionB) return false;
  const connectorA = definitionA.connectors.find((connector) => connector.id === connection.connectorA);
  const connectorB = definitionB.connectors.find((connector) => connector.id === connection.connectorB);
  if (!connectorA || !connectorB || !areConnectorsCompatible(connectorA, connectorB)) return false;

  const endpointA = `${connection.brickA}:${connection.connectorA}`;
  const endpointB = `${connection.brickB}:${connection.connectorB}`;
  const occupied = existingConnections.some((item) => (
    `${item.brickA}:${item.connectorA}` === endpointA
      || `${item.brickB}:${item.connectorB}` === endpointA
      || `${item.brickA}:${item.connectorA}` === endpointB
      || `${item.brickB}:${item.connectorB}` === endpointB
  ));
  if (occupied) return false;

  const worldA = getWorldConnectors(brickA, definitionA).find((item) => item.connectorId === connectorA.id);
  const worldB = getWorldConnectors(brickB, definitionB).find((item) => item.connectorId === connectorB.id);
  if (!worldA || !worldB) return false;
  const positionError = Math.hypot(
    worldA.position[0] - worldB.position[0],
    worldA.position[1] - worldB.position[1],
    worldA.position[2] - worldB.position[2],
  );
  const normalDot = worldA.normal[0] * worldB.normal[0]
    + worldA.normal[1] * worldB.normal[1]
    + worldA.normal[2] * worldB.normal[2];
  return positionError <= 0.75 && normalDot <= -0.98;
};

const validateProjectValue = (value: unknown): ProjectData => {
  if (!isRecord(value) || value.version !== PROJECT_VERSION) {
    throw new Error(`Invalid project: expected schema version ${PROJECT_VERSION}.`);
  }
  if (!Array.isArray(value.bricks) || !Array.isArray(value.connections)) {
    throw new Error('Invalid project: bricks and connections must be arrays.');
  }

  const seenBrickIds = new Set<string>();
  const bricks = value.bricks.map((brick) => parseBrick(brick, seenBrickIds));
  const bricksById = new Map(bricks.map((brick) => [brick.id, brick]));
  const seenConnections = new Set<string>();
  const connections: Connection[] = [];
  for (const rawConnection of value.connections) {
    const connection = parseConnection(rawConnection, bricksById, seenConnections);
    if (!isConnectionValid(connection, bricks, connections)) {
      throw new Error('Invalid project: incompatible, occupied, or misaligned connection.');
    }
    connections.push(connection);
  }

  return { version: PROJECT_VERSION, bricks, connections };
};

export const createConnection = (
  brickA: string,
  connectorA: string,
  brickB: string,
  connectorB: string,
): Connection => ({ brickA, connectorA, brickB, connectorB });

export const removeConnectionsForBrick = (
  connections: readonly Connection[],
  brickId: string,
): Connection[] =>
  connections
    .filter((connection) => connection.brickA !== brickId && connection.brickB !== brickId)
    .map(cloneConnection);

export const serializeProject = (project: ProjectSnapshot): string => {
  const validated = validateProjectValue({
    version: PROJECT_VERSION,
    bricks: project.bricks,
    connections: project.connections,
  });
  return JSON.stringify(validated);
};

export const deserializeProject = (serialized: string): ProjectData => {
  if (typeof serialized !== 'string') {
    throw new Error('Invalid project: expected serialized JSON text.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    throw new Error('Invalid project: malformed JSON.');
  }
  return validateProjectValue(parsed);
};

export const cloneProjectSnapshot = (project: ProjectSnapshot): ProjectSnapshot => ({
  bricks: project.bricks.map(cloneBrick),
  connections: project.connections.map(cloneConnection),
});
