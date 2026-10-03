import { describe, expect, it } from 'vitest';
import { BRICK_DEFINITIONS } from '../bricks/catalog';
import { PROJECT_VERSION } from '../config/brickConfig';
import type { BrickInstance, ProjectSnapshot } from '../types/model';
import {
  createConnection,
  deserializeProject,
  removeConnectionsForBrick,
  serializeProject,
} from './projectModel';

const definition = BRICK_DEFINITIONS.find((item) => item.connectors.length > 0);
if (!definition) throw new Error('The test catalog needs at least one connector.');

const makeBrick = (
  id: string,
  position: [number, number, number] = [0, definition.size[1] / 2, 0],
): BrickInstance => ({
  id,
  definitionId: definition.id,
  position,
  rotation: [0, 0, 0],
});

describe('project model', () => {
  it('creates a connection and removes only connections involving a deleted brick', () => {
    const connectorId = definition.connectors[0].id;
    const first = createConnection('a', connectorId, 'b', connectorId);
    const second = createConnection('b', connectorId, 'c', connectorId);
    const untouched = createConnection('c', connectorId, 'd', connectorId);

    expect(first).toEqual({
      brickA: 'a',
      connectorA: connectorId,
      brickB: 'b',
      connectorB: connectorId,
    });
    expect(removeConnectionsForBrick([first, second, untouched], 'b')).toEqual([untouched]);
  });

  it('round-trips a valid versioned project', () => {
    const bricks = [makeBrick('a'), makeBrick('b', [0, definition.size[1] * 1.5, 0])];
    const stud = definition.connectors.find((connector) => connector.type === 'stud');
    const socket = definition.connectors.find((connector) => connector.type === 'socket');
    if (!stud || !socket) throw new Error('The test brick needs a stud and socket.');
    const project: ProjectSnapshot = {
      bricks,
      connections: [createConnection('a', stud.id, 'b', socket.id)],
    };

    expect(deserializeProject(serializeProject(project))).toEqual({
      version: PROJECT_VERSION,
      bricks,
      connections: project.connections,
    });
  });

  it('rejects unknown definitions and connector IDs', () => {
    const brick = makeBrick('a');
    expect(() =>
      deserializeProject(
        JSON.stringify({
          version: PROJECT_VERSION,
          bricks: [{ ...brick, definitionId: 'not-in-the-catalog' }],
          connections: [],
        }),
      ),
    ).toThrow(/unknown brick definition/i);

    expect(() =>
      deserializeProject(
        JSON.stringify({
          version: PROJECT_VERSION,
          bricks: [brick, makeBrick('b', [0, definition.size[1] * 1.5, 0])],
          connections: [createConnection('a', 'not-a-connector', 'b', definition.connectors[0].id)],
        }),
      ),
    ).toThrow(/missing connector/i);
  });

  it('rejects malformed transforms and unsupported schema versions', () => {
    expect(() =>
      deserializeProject(
        JSON.stringify({
          version: PROJECT_VERSION,
          bricks: [{ ...makeBrick('a'), position: [0, Number.NaN, 0] }],
          connections: [],
        }),
      ),
    ).toThrow(/invalid transform/i);

    expect(() =>
      deserializeProject(JSON.stringify({ version: 999, bricks: [], connections: [] })),
    ).toThrow(/schema version/i);
  });
});
