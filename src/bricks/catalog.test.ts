import { BoxGeometry, Mesh, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BRICK_DEFINITIONS, getBrickDefinition } from './catalog';
import { createBrickGroup, getBrickGroundY } from './geometry';

describe('brick catalog', () => {
  it('contains 34 unique, connector-driven construction pieces', () => {
    expect(BRICK_DEFINITIONS).toHaveLength(34);
    expect(new Set(BRICK_DEFINITIONS.map((definition) => definition.id)).size).toBe(34);
    expect(BRICK_DEFINITIONS.every((definition) => definition.connectors.length > 0)).toBe(true);
  });

  it('provides a compact family of true hollow frames and rounded corners', () => {
    const requested = [
      'frame-square',
      'frame-circle',
      'frame-arch',
      'block-concave-arc',
      'block-sphere-octant-cutout',
      'quarter-cylinder',
    ];
    const definitions = requested.map((id) => getBrickDefinition(id));

    expect(definitions.every(Boolean)).toBe(true);
    expect(definitions.every((definition) => definition?.category === 'frames')).toBe(true);
    expect(definitions.every((definition) => (definition?.connectors.length ?? 0) > 0)).toBe(true);
    expect(definitions.slice(0, 3).map((definition) => definition?.geometry.kind))
      .toEqual(['frame', 'frame', 'frame']);
  });

  it.each(['frame-square', 'frame-circle', 'frame-arch'])(
    'renders a traversable opening instead of a painted recess for %s',
    (definitionId) => {
      const definition = getBrickDefinition(definitionId);
      if (!definition) throw new Error(`Expected ${definitionId}.`);
      const group = createBrickGroup(definition, { includeConnectorGeometry: false });
      group.updateMatrixWorld(true);
      const raycaster = new Raycaster();

      raycaster.set(new Vector3(0, 0, 50), new Vector3(0, 0, -1));
      expect(raycaster.intersectObject(group, true)).toHaveLength(0);
      raycaster.set(new Vector3(12, 0, 50), new Vector3(0, 0, -1));
      expect(raycaster.intersectObject(group, true).length).toBeGreaterThan(0);

      group.traverse((child) => {
        if (!(child instanceof Mesh)) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material.dispose());
      });
    },
  );

  it('provides one-unit and two-unit printable cones', () => {
    const small = getBrickDefinition('cone-1');
    const large = getBrickDefinition('cone-2');

    expect(small?.size).toEqual([10, 10, 10]);
    expect(large?.size).toEqual([20, 20, 20]);
    expect(small?.geometry.kind).toBe('cone');
    expect(large?.geometry.kind).toBe('cone');
    expect(small?.connectors.every((connector) => connector.type === 'socket')).toBe(true);
    expect(large?.connectors.every((connector) => connector.type === 'socket')).toBe(true);
  });

  it('renders the basic block body with square BoxGeometry corners', () => {
    const definition = getBrickDefinition('cube-1');
    if (!definition) throw new Error('Expected cube definition.');
    const group = createBrickGroup(definition, { includeConnectorGeometry: false });
    const body = group.getObjectByName('cube-1-body');

    expect(body).toBeInstanceOf(Mesh);
    expect((body as Mesh).geometry).toBeInstanceOf(BoxGeometry);

    const mesh = body as Mesh;
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    materials.forEach((material) => material.dispose());
  });

  it('places the printable body—not editor-only connector bumps—on the bed', () => {
    const definition = getBrickDefinition('rod');
    if (!definition) throw new Error('Expected rod definition.');

    expect(getBrickGroundY(definition)).toBeCloseTo(definition.size[1] / 2, 6);
  });

  it('gives basic boxes logical side magnets without rendering protrusions', () => {
    const definition = getBrickDefinition('cube-1');
    if (!definition) throw new Error('Expected cube definition.');

    const magnets = definition.connectors.filter(
      (connector) => connector.type === 'magnet',
    );
    expect(magnets).toHaveLength(12);
    expect(
      magnets.every((connector) => connector.polarity === 'neutral'),
    ).toBe(true);
    expect(
      magnets.every((connector) => connector.compatibleWith.includes('magnet')),
    ).toBe(true);

    const group = createBrickGroup(definition);
    expect(
      group.children.filter(
        (child) => child.userData.connectorType === 'magnet',
      ),
    ).toHaveLength(0);

    group.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((material) => material.dispose());
    });
  });

  it('keeps both broad faces of a thin plate attachable after it is upright', () => {
    const definition = getBrickDefinition('plate-1x2');
    if (!definition) throw new Error('Expected thin plate definition.');
    const faceMagnets = definition.connectors.filter(({ id, type }) => (
      type === 'magnet'
      && (id.startsWith('plate-top-magnet') || id.startsWith('plate-bottom-magnet'))
    ));

    expect(faceMagnets).toHaveLength(4);
    expect(faceMagnets.every(({ position }) => Math.abs(position[1]) === 2.5)).toBe(true);
  });

  it.each([
    'triangle-prism',
    'right-triangle-prism',
    'wedge',
    'roof-wedge',
    'trapezoid-prism',
  ])('gives %s orthogonal end-face magnets without making its slope magnetic', (definitionId) => {
    const definition = getBrickDefinition(definitionId);
    if (!definition) throw new Error(`Expected ${definitionId}.`);
    const wallMagnets = definition.connectors.filter(({ id }) => id.endsWith('wall-magnet'));

    expect(wallMagnets.map(({ id }) => id).sort()).toEqual([
      'back-wall-magnet',
      'front-wall-magnet',
    ]);
    expect(wallMagnets.every(({ position }) => Math.abs(position[2]) === definition.size[2] / 2))
      .toBe(true);
  });

  it('provides a one-by-one half-height plate with generic face connections', () => {
    const definition = getBrickDefinition('plate-1x1');
    if (!definition) throw new Error('Expected one-by-one thin plate definition.');

    expect(definition.size).toEqual([10, 5, 10]);
    expect(definition.geometry).toEqual({ kind: 'box', size: [10, 5, 10] });
    expect(definition.connectors.filter(({ type }) => type === 'stud')).toHaveLength(1);
    expect(definition.connectors.filter(({ type }) => type === 'socket')).toHaveLength(1);
    expect(definition.connectors.filter(({ type }) => type === 'magnet')).toHaveLength(6);
  });
});
