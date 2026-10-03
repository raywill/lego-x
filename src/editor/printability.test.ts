import { describe, expect, it } from 'vitest';
import { getBrickDefinition } from '../bricks/catalog';
import type { BrickInstance, Connection } from '../types/model';
import { checkPrintability } from './printability';

describe('printability checks', () => {
  it('does not report a fully supported two-brick stack as an overhang', () => {
    const definition = getBrickDefinition('cube-1');
    if (!definition) throw new Error('Expected cube definition.');
    const stud = definition.connectors.find((connector) => connector.type === 'stud');
    const socket = definition.connectors.find((connector) => connector.type === 'socket');
    if (!stud || !socket) throw new Error('Expected mating connectors.');
    const bricks: BrickInstance[] = [
      { id: 'lower', definitionId: definition.id, position: [0, 5, 0], rotation: [0, 0, 0] },
      { id: 'upper', definitionId: definition.id, position: [0, 15, 0], rotation: [0, 0, 0] },
    ];
    const connections: Connection[] = [{
      brickA: 'lower', connectorA: stud.id, brickB: 'upper', connectorB: socket.id,
    }];

    expect(checkPrintability(bricks, connections).map((warning) => warning.kind)).not.toContain('overhang');
  });

  it('treats a gravity-landed body as supported without a logical connector', () => {
    const bricks: BrickInstance[] = [
      { id: 'lower', definitionId: 'cube-1', position: [0, 5, 0], rotation: [0, 0, 0] },
      { id: 'upper', definitionId: 'cube-1', position: [3, 15, 0], rotation: [0, 0, 0] },
    ];

    const warningKinds = checkPrintability(bricks, []).map((warning) => warning.kind);
    expect(warningKinds).not.toContain('floating');
  });

  it('ignores editor-only snap bumps when checking the print volume', () => {
    const definition = getBrickDefinition('cube-1');
    if (!definition) throw new Error('Expected cube definition.');
    const brick: BrickInstance = {
      id: 'high-cube',
      definitionId: definition.id,
      position: [0, 175, 0],
      rotation: [0, 0, 0],
    };

    const warningKinds = checkPrintability([brick], []).map((warning) => warning.kind);
    expect(warningKinds).not.toContain('outside');
  });
});
