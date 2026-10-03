import { BoxGeometry, Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { BRICK_DEFINITIONS, getBrickDefinition } from './catalog';
import { createBrickGroup, getBrickGroundY } from './geometry';

describe('brick catalog', () => {
  it('contains exactly 25 unique, connector-driven construction pieces', () => {
    expect(BRICK_DEFINITIONS).toHaveLength(25);
    expect(new Set(BRICK_DEFINITIONS.map((definition) => definition.id)).size).toBe(25);
    expect(BRICK_DEFINITIONS.every((definition) => definition.connectors.length > 0)).toBe(true);
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
});
