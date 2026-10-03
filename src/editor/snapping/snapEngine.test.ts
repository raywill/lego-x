import { Box3, Euler, Mesh, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';

import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import type {
  BrickDefinition,
  BrickInstance,
  ConnectorDefinition,
} from '../../types/model';
import { isConnectionValid } from '../projectModel';
import {
  areConnectorsCompatible,
  computeSnapTransform,
  findBestSnap,
  getWorldConnectors,
} from './snapEngine';

const HALF_TURN = Math.PI;

function connector(
  overrides: Partial<ConnectorDefinition> = {},
): ConnectorDefinition {
  return {
    id: 'connector',
    type: 'stud',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    compatibleWith: ['socket'],
    polarity: 'male',
    snapDistance: 6,
    ...overrides,
  };
}

function definition(
  id: string,
  connectors: ConnectorDefinition[],
  size: [number, number, number] = [10, 10, 10],
): BrickDefinition {
  return {
    id,
    name: id,
    shortName: id,
    category: 'blocks',
    size,
    color: '#f97316',
    geometry: { kind: 'box', size },
    connectors,
  };
}

function instance(
  id: string,
  definitionId: string,
  position: [number, number, number] = [0, 0, 0],
  rotation: [number, number, number] = [0, 0, 0],
): BrickInstance {
  return { id, definitionId, position, rotation };
}

describe('areConnectorsCompatible', () => {
  it('requires bidirectional type compatibility and compatible polarity', () => {
    const stud = connector();
    const socket = connector({
      id: 'socket',
      type: 'socket',
      compatibleWith: ['stud'],
      polarity: 'female',
    });

    expect(areConnectorsCompatible(stud, socket)).toBe(true);
    expect(
      areConnectorsCompatible(stud, { ...socket, polarity: 'male' }),
    ).toBe(false);
    expect(
      areConnectorsCompatible(stud, { ...socket, compatibleWith: ['rod'] }),
    ).toBe(false);
    expect(
      areConnectorsCompatible(stud, { ...socket, polarity: 'neutral' }),
    ).toBe(true);
  });
});

describe('getWorldConnectors', () => {
  it('applies the brick transform to connector position and orientation', () => {
    const brickDefinition = definition('turned', [
      connector({ position: [2, 0, 0] }),
    ]);
    const [world] = getWorldConnectors(
      instance('brick', 'turned', [10, 20, 30], [0, 0, Math.PI / 2]),
      brickDefinition,
    );

    expect(world.position[0]).toBeCloseTo(10);
    expect(world.position[1]).toBeCloseTo(22);
    expect(world.position[2]).toBeCloseTo(30);
    expect(world.normal[0]).toBeCloseTo(-1);
    expect(world.normal[1]).toBeCloseTo(0);
    expect(world.normal[2]).toBeCloseTo(0);
    expect(world.twistReference).toEqual([0, 0, 1]);
  });
});

describe('computeSnapTransform', () => {
  it('aligns positions, opposes +Y normals, and preserves the +Z twist reference', () => {
    const source = connector({
      id: 'bottom-socket',
      type: 'socket',
      compatibleWith: ['stud'],
      polarity: 'female',
      position: [0, -5, 0],
      rotation: [0, 0, HALF_TURN],
    });
    const targetDefinition = definition('base', [
      connector({ id: 'top-stud', position: [0, 5, 0] }),
    ]);
    const [target] = getWorldConnectors(
      instance('base-1', 'base'),
      targetDefinition,
    );

    const transform = computeSnapTransform(source, target);
    expect(transform.position).toEqual([0, 10, 0]);

    const sourceDefinition = definition('upper', [source]);
    const [alignedSource] = getWorldConnectors(
      instance('upper-1', 'upper', transform.position, transform.rotation),
      sourceDefinition,
    );
    const sourceNormal = new Vector3(...alignedSource.normal);
    const targetNormal = new Vector3(...target.normal);
    const sourceTwist = new Vector3(...alignedSource.twistReference);
    const targetTwist = new Vector3(...target.twistReference);

    expect(new Vector3(...alignedSource.position).distanceTo(new Vector3(...target.position))).toBeCloseTo(0);
    expect(sourceNormal.dot(targetNormal)).toBeCloseTo(-1);
    expect(sourceTwist.dot(targetTwist)).toBeCloseTo(1);
  });
});

describe('findBestSnap', () => {
  it('chooses the closest valid compatible connector', () => {
    const source = connector({
      id: 'bottom',
      type: 'socket',
      compatibleWith: ['stud'],
      polarity: 'female',
      rotation: [0, 0, HALF_TURN],
    });
    const draggedDefinition = definition('dragged', [source]);
    const targetDefinition = definition('target', [connector({ id: 'top' })]);
    const targets = [
      ...getWorldConnectors(
        instance('far', 'target', [4, 0, 0]),
        targetDefinition,
      ),
      ...getWorldConnectors(
        instance('near', 'target', [1, 0, 0]),
        targetDefinition,
      ),
    ];

    const candidate = findBestSnap({
      dragged: instance('moving', 'dragged'),
      draggedDefinition,
      targets,
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.targetBrickId).toBe('near');
    expect(candidate?.distanceMm).toBeCloseTo(1);
    expect(candidate?.committable).toBe(true);
    expect(candidate?.connection).toEqual({
      brickA: 'moving',
      connectorA: 'bottom',
      brickB: 'near',
      connectorB: 'top',
    });
  });

  it('allows a long brick to overhang when only one end connector mates', () => {
    const endSocket = connector({
      id: 'end-socket',
      type: 'socket',
      compatibleWith: ['stud'],
      polarity: 'female',
      position: [-20, -5, 0],
      rotation: [0, 0, HALF_TURN],
    });
    const beamDefinition = definition('long-beam', [endSocket], [40, 10, 10]);
    const baseDefinition = definition('base', [
      connector({ id: 'edge-stud', position: [0, 5, 0] }),
    ]);
    const [target] = getWorldConnectors(
      instance('base-1', 'base'),
      baseDefinition,
    );

    const candidate = findBestSnap({
      dragged: instance('beam-1', 'long-beam', [20, 10.5, 0]),
      draggedDefinition: beamDefinition,
      targets: [target],
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.transform.position[0]).toBeCloseTo(20);
    expect(candidate?.transform.position[1]).toBeCloseTo(10);

    const [alignedEnd] = getWorldConnectors(
      instance(
        'beam-1',
        'long-beam',
        candidate!.transform.position,
        candidate!.transform.rotation,
      ),
      beamDefinition,
    );
    expect(new Vector3(...alignedEnd.position).distanceTo(new Vector3(...target.position))).toBeCloseTo(0);

    // The opposite end remains 40 mm away: snapping aligns the connector,
    // never the beam's complete surface or bounding box.
    const beamRotation = new Quaternion().setFromEuler(
      // This case is identity, but using the produced transform keeps the
      // assertion valid if Euler canonicalisation changes.
      new Euler(...candidate!.transform.rotation, 'XYZ'),
    );
    const oppositeEnd = new Vector3(20, -5, 0)
      .applyQuaternion(beamRotation)
      .add(new Vector3(...candidate!.transform.position));
    expect(oppositeEnd.distanceTo(new Vector3(...target.position))).toBeCloseTo(40);
  });

  it('can use an interaction-space distance while keeping exact world alignment', () => {
    const source = connector({
      id: 'bottom',
      type: 'socket',
      compatibleWith: ['stud'],
      polarity: 'female',
      rotation: [0, 0, HALF_TURN],
    });
    const draggedDefinition = definition('dragged', [source]);
    const targetDefinition = definition('target', [connector({ id: 'high-stud' })]);
    const [target] = getWorldConnectors(
      instance('tower-top', 'target', [0, 80, 0]),
      targetDefinition,
    );

    const candidate = findBestSnap({
      dragged: instance('moving', 'dragged'),
      draggedDefinition,
      targets: [target],
      distanceResolver: () => 2,
    });

    expect(candidate?.committable).toBe(true);
    expect(candidate?.transform.position[1]).toBeCloseTo(80);
  });

  it('reports every target connector touched by the predicted snap transform', () => {
    const draggedDefinition = definition('two-sockets', [
      connector({
        id: 'socket-left',
        type: 'socket',
        compatibleWith: ['stud'],
        polarity: 'female',
        position: [-5, -5, 0],
        rotation: [0, 0, HALF_TURN],
      }),
      connector({
        id: 'socket-right',
        type: 'socket',
        compatibleWith: ['stud'],
        polarity: 'female',
        position: [5, -5, 0],
        rotation: [0, 0, HALF_TURN],
      }),
    ], [20, 10, 10]);
    const targetDefinition = definition('two-studs', [
      connector({ id: 'stud-left', position: [-5, 5, 0] }),
      connector({ id: 'stud-right', position: [5, 5, 0] }),
    ], [20, 10, 10]);
    const targets = getWorldConnectors(
      instance('target', targetDefinition.id),
      targetDefinition,
    );

    const candidate = findBestSnap({
      dragged: instance('moving', draggedDefinition.id, [0, 10.4, 0]),
      draggedDefinition,
      targets,
    });

    expect(candidate?.contacts).toHaveLength(2);
    expect(candidate?.contacts.map(({ target }) => target.connectorId).sort()).toEqual([
      'stud-left',
      'stud-right',
    ]);
    expect(new Set(candidate?.contacts.map(({ target }) => (
      `${target.brickId}:${target.connectorId}`
    ))).size).toBe(2);
  });

  it('does not report an occupied target as a predicted contact', () => {
    const draggedDefinition = definition('two-sockets', [
      connector({
        id: 'socket-left',
        type: 'socket',
        compatibleWith: ['stud'],
        polarity: 'female',
        position: [-5, -5, 0],
        rotation: [0, 0, HALF_TURN],
      }),
      connector({
        id: 'socket-right',
        type: 'socket',
        compatibleWith: ['stud'],
        polarity: 'female',
        position: [5, -5, 0],
        rotation: [0, 0, HALF_TURN],
      }),
    ], [20, 10, 10]);
    const targetDefinition = definition('two-studs', [
      connector({ id: 'stud-left', position: [-5, 5, 0] }),
      connector({ id: 'stud-right', position: [5, 5, 0] }),
    ], [20, 10, 10]);
    const targets = getWorldConnectors(
      instance('target', targetDefinition.id),
      targetDefinition,
    );

    const candidate = findBestSnap({
      dragged: instance('moving', draggedDefinition.id, [0, 10.4, 0]),
      draggedDefinition,
      targets,
      occupiedConnectorKeys: new Set(['target:stud-right']),
    });

    expect(candidate?.contacts.map(({ target }) => target.connectorId)).toEqual([
      'stud-left',
    ]);
  });

  it('reports both real catalog contacts for aligned 1x2 blocks', () => {
    const block = getBrickDefinition('block-1x2');
    if (!block) throw new Error('Expected 1x2 block definition.');
    const fixed = instance('fixed', block.id, [0, 5, 0]);
    const moving = instance('moving', block.id, [0, 15.3, 0]);

    const candidate = findBestSnap({
      dragged: moving,
      draggedDefinition: block,
      targets: getWorldConnectors(fixed, block),
    });

    expect(candidate?.contacts).toHaveLength(2);
    expect(candidate?.contacts.every(({ target }) => target.brickId === fixed.id)).toBe(true);
    expect(candidate?.contacts.map(({ target }) => target.connector.type)).toEqual([
      'stud',
      'stud',
    ]);
  });

  it('snaps horizontally adjacent cubes until their AABB faces exactly touch', () => {
    const cube = getBrickDefinition('cube-1');
    if (!cube) throw new Error('Expected cube definition.');

    const fixed = instance('fixed', cube.id, [0, 5, 0]);
    const moving = instance('moving', cube.id, [10.8, 5, 0]);
    const candidate = findBestSnap({
      dragged: moving,
      draggedDefinition: cube,
      targets: getWorldConnectors(fixed, cube),
    });

    expect(candidate).not.toBeNull();
    expect(candidate?.source.connector.type).toBe('magnet');
    expect(candidate?.target.connector.type).toBe('magnet');
    expect(candidate?.committable).toBe(true);

    const aligned: BrickInstance = {
      ...moving,
      position: candidate!.transform.position,
      rotation: candidate!.transform.rotation,
    };
    expect(aligned.position[1]).toBeCloseTo(fixed.position[1], 8);
    expect(aligned.rotation).toEqual([0, 0, 0]);
    const fixedGroup = createBrickGroup(cube, {
      includeConnectorGeometry: false,
    });
    const movingGroup = createBrickGroup(cube, {
      includeConnectorGeometry: false,
    });
    fixedGroup.position.set(...fixed.position);
    movingGroup.position.set(...aligned.position);
    movingGroup.rotation.set(...aligned.rotation, 'XYZ');
    fixedGroup.updateMatrixWorld(true);
    movingGroup.updateMatrixWorld(true);

    const fixedBounds = new Box3().setFromObject(fixedGroup, true);
    const movingBounds = new Box3().setFromObject(movingGroup, true);
    expect(movingBounds.min.x).toBeCloseTo(fixedBounds.max.x, 8);
    expect(isConnectionValid(candidate!.connection, [fixed, aligned])).toBe(true);

    for (const group of [fixedGroup, movingGroup]) {
      group.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => material.dispose());
      });
    }
  });

  it.each([
    [[10.8, 5, 0], [10, 5, 0]],
    [[-10.8, 5, 0], [-10, 5, 0]],
    [[0, 5, 10.8], [0, 5, 10]],
    [[0, 5, -10.8], [0, 5, -10]],
  ] as const)('keeps a side-snapped cube upright at %j', (start, expected) => {
    const cube = getBrickDefinition('cube-1');
    if (!cube) throw new Error('Expected cube definition.');
    const fixed = instance('fixed', cube.id, [0, 5, 0]);
    const moving = instance('moving', cube.id, [...start]);
    const candidate = findBestSnap({
      dragged: moving,
      draggedDefinition: cube,
      targets: getWorldConnectors(fixed, cube),
    });

    expect(candidate?.source.connector.type).toBe('magnet');
    candidate?.transform.position.forEach((value, index) => {
      expect(value).toBeCloseTo(expected[index], 8);
    });
    candidate?.transform.rotation.forEach((value) => {
      expect(value).toBeCloseTo(0, 8);
    });
  });
});
