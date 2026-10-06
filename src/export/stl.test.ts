import { describe, expect, it } from 'vitest';
import { Mesh } from 'three';

import { BRICK_DEFINITIONS, getBrickDefinition } from '../bricks/catalog';
import type { BrickInstance, Connection, Vec3Tuple } from '../types/model';
import { buildBinaryStl, createPrintableAssembly } from './stl';

interface Triangle {
  a: Vec3Tuple;
  b: Vec3Tuple;
  c: Vec3Tuple;
}

function parseBinaryStl(buffer: ArrayBuffer): Triangle[] {
  const view = new DataView(buffer);
  const triangleCount = view.getUint32(80, true);
  const triangles: Triangle[] = [];

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const triangleOffset = 84 + triangle * 50;
    const vertex = (index: number): Vec3Tuple => {
      const offset = triangleOffset + 12 + index * 12;
      return [
        view.getFloat32(offset, true),
        view.getFloat32(offset + 4, true),
        view.getFloat32(offset + 8, true),
      ];
    };
    triangles.push({ a: vertex(0), b: vertex(1), c: vertex(2) });
  }

  expect(buffer.byteLength).toBe(84 + triangleCount * 50);
  return triangles;
}

function vertexKey(vertex: Vec3Tuple): string {
  return vertex.map((value) => Math.round(value * 1e5)).join(',');
}

function edgeKey(first: Vec3Tuple, second: Vec3Tuple): string {
  const a = vertexKey(first);
  const b = vertexKey(second);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function edgeUseCounts(triangles: Triangle[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const { a, b, c } of triangles) {
    for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function projectedRayHitCount(
  triangles: readonly Triangle[],
  x: number,
  y: number,
): number {
  const epsilon = 1e-7;
  return triangles.filter(({ a, b, c }) => {
    const denominator = (b[1] - c[1]) * (a[0] - c[0])
      + (c[0] - b[0]) * (a[1] - c[1]);
    if (Math.abs(denominator) <= epsilon) return false;
    const first = ((b[1] - c[1]) * (x - c[0]) + (c[0] - b[0]) * (y - c[1])) / denominator;
    const second = ((c[1] - a[1]) * (x - c[0]) + (a[0] - c[0]) * (y - c[1])) / denominator;
    const third = 1 - first - second;
    return first >= -epsilon && second >= -epsilon && third >= -epsilon;
  }).length;
}

function cube(id: string, x: number): BrickInstance {
  const definition = getBrickDefinition('cube-1');
  if (!definition) throw new Error('Expected cube-1 in the catalog.');
  return {
    id,
    definitionId: definition.id,
    position: [x, definition.size[1] / 2, 0],
    rotation: [0, 0, 0],
  };
}

describe('STL export', () => {
  it('omits visual snap studs and rods from printable geometry', async () => {
    const definition = getBrickDefinition('cube-1');
    const rodDefinition = getBrickDefinition('rod');
    if (!definition) throw new Error('Expected cube-1 in the catalog.');
    if (!rodDefinition) throw new Error('Expected rod in the catalog.');

    const triangles = parseBinaryStl(await buildBinaryStl([cube('brick-a', 0)]));
    const yCoordinates = triangles.flatMap(({ a, b, c }) => [a[1], b[1], c[1]]);

    expect(triangles).toHaveLength(12);
    expect(Math.min(...yCoordinates)).toBeCloseTo(0, 5);
    expect(Math.max(...yCoordinates)).toBeCloseTo(definition.size[1], 5);

    const rodTriangles = parseBinaryStl(await buildBinaryStl([{
      id: 'rod-a',
      definitionId: rodDefinition.id,
      position: [0, rodDefinition.size[1] / 2, 0],
      rotation: [0, 0, 0],
    }]));
    const rodYCoordinates = rodTriangles.flatMap(({ a, b, c }) => [a[1], b[1], c[1]]);
    expect(Math.min(...rodYCoordinates)).toBeCloseTo(0, 5);
    expect(Math.max(...rodYCoordinates)).toBeCloseTo(rodDefinition.size[1], 5);
  });

  it('unions face-touching blocks into one closed solid without the shared face', async () => {
    const triangles = parseBinaryStl(
      await buildBinaryStl([cube('left', 0), cube('right', 10)]),
    );

    const internalSharedFaces = triangles.filter(({ a, b, c }) =>
      [a, b, c].every(([x]) => Math.abs(x - 5) < 1e-5),
    );
    expect(internalSharedFaces).toHaveLength(0);

    // A closed, indexed manifold uses every geometric edge exactly twice.
    // Rebuilding those edges from STL coordinates proves the two touching
    // blocks are one watertight boundary rather than overlapping shells.
    const edgeCounts = [...edgeUseCounts(triangles).values()];
    expect(edgeCounts.length).toBeGreaterThan(0);
    expect(edgeCounts.every((count) => count === 2)).toBe(true);

    const xCoordinates = triangles.flatMap(({ a, b, c }) => [a[0], b[0], c[0]]);
    expect(Math.min(...xCoordinates)).toBeCloseTo(-5, 5);
    expect(Math.max(...xCoordinates)).toBeCloseTo(15, 5);
  });

  it('adds a hidden 6 mm by 2.5 mm printable foot for a sphere pole connection', async () => {
    const sphereDefinition = getBrickDefinition('sphere');
    if (!sphereDefinition) throw new Error('Expected sphere definition.');
    const base = cube('base', 0);
    const sphere: BrickInstance = {
      id: 'ball',
      definitionId: 'sphere',
      // Its bottom pole meets the base's top surface at y=10.
      position: [0, 20, 0],
      rotation: [0, 0, 0],
    };
    const connection: Connection = {
      brickA: 'base',
      connectorA: 'top-stud-0-0',
      brickB: 'ball',
      connectorB: 'bottom-socket',
    };

    const assembly = createPrintableAssembly([base, sphere], [connection]);
    const printableFeet: Mesh[] = [];
    assembly.traverse((child) => {
      if (child instanceof Mesh && child.name.startsWith('sphere-print-foot-')) printableFeet.push(child);
    });
    expect(printableFeet).toHaveLength(1);
    const foot = printableFeet[0];
    expect(foot.position.y).toBeCloseTo(10, 5);
    foot.geometry.computeBoundingBox();
    expect(foot.geometry.boundingBox?.max.x).toBeCloseTo(3, 5);
    expect(foot.geometry.boundingBox?.min.x).toBeCloseTo(-3, 5);
    expect(foot.geometry.boundingBox?.max.y).toBeCloseTo(1.25, 5);
    expect(foot.geometry.boundingBox?.min.y).toBeCloseTo(-1.25, 5);

    const triangles = parseBinaryStl(await buildBinaryStl([base, sphere], 1, [connection]));
    expect(triangles.length).toBeGreaterThan(0);
    const yCoordinates = triangles.flatMap(({ a, b, c }) => [a[1], b[1], c[1]]);
    expect(Math.min(...yCoordinates)).toBeCloseTo(0, 5);
    expect(Math.max(...yCoordinates)).toBeCloseTo(30, 5);
  });

  it('does not add a sphere foot without a logical top or bottom connection', () => {
    const sphere: BrickInstance = {
      id: 'ball',
      definitionId: 'sphere',
      position: [0, 10, 0],
      rotation: [0, 0, 0],
    };
    const assembly = createPrintableAssembly([sphere]);
    const printableFeet: Mesh[] = [];
    assembly.traverse((child) => {
      if (child instanceof Mesh && child.name.startsWith('sphere-print-foot-')) printableFeet.push(child);
    });
    expect(printableFeet).toHaveLength(0);
  });

  it('exports disconnected printable bodies without producing an empty STL', async () => {
    const triangles = parseBinaryStl(
      await buildBinaryStl([cube('left', 0), cube('far-right', 40)]),
    );
    const xCoordinates = triangles.flatMap(({ a, b, c }) => [a[0], b[0], c[0]]);

    expect(triangles.length).toBeGreaterThan(0);
    expect(Math.min(...xCoordinates)).toBeCloseTo(-5, 5);
    expect(Math.max(...xCoordinates)).toBeCloseTo(45, 5);
  });

  it.each(['frame-square', 'frame-circle', 'frame-arch'])(
    'preserves the through-opening of %s in the STL',
    async (definitionId) => {
      const definition = getBrickDefinition(definitionId);
      if (!definition) throw new Error(`Expected ${definitionId}.`);
      const triangles = parseBinaryStl(await buildBinaryStl([{
        id: `test-${definitionId}`,
        definitionId,
        position: [5, definition.size[1] / 2, 5],
        rotation: [0, 0, 0],
      }]));

      expect(projectedRayHitCount(triangles, 5, definition.size[1] / 2)).toBe(0);
      expect(projectedRayHitCount(triangles, 17, definition.size[1] / 2)).toBeGreaterThan(0);
    },
  );

  it('exports the sphere-octant cutout as a closed printable shell', async () => {
    const definition = getBrickDefinition('block-sphere-octant-cutout');
    if (!definition) throw new Error('Expected sphere-octant cutout.');
    const triangles = parseBinaryStl(await buildBinaryStl([{
      id: 'sphere-cutout',
      definitionId: definition.id,
      position: [0, definition.size[1] / 2, 0],
      rotation: [0, 0, 0],
    }]));

    const edgeCounts = [...edgeUseCounts(triangles).values()];
    expect(edgeCounts.length).toBeGreaterThan(0);
    expect(edgeCounts.every((count) => count === 2)).toBe(true);
  });

  it('lifts a legacy below-bed assembly before export', async () => {
    const belowBed = cube('below-bed', 0);
    belowBed.position[1] = -35;
    const triangles = parseBinaryStl(await buildBinaryStl([belowBed]));
    const yCoordinates = triangles.flatMap(({ a, b, c }) => [a[1], b[1], c[1]]);

    expect(Math.min(...yCoordinates)).toBeCloseTo(0, 5);
    expect(Math.max(...yCoordinates)).toBeCloseTo(10, 5);
  });

  it.each([1, 0.75, 0.5, 0.25])('exports the complete model at %sx scale', async (scale) => {
    const triangles = parseBinaryStl(await buildBinaryStl([cube('scaled', 0)], scale));
    const xCoordinates = triangles.flatMap(({ a, b, c }) => [a[0], b[0], c[0]]);
    const yCoordinates = triangles.flatMap(({ a, b, c }) => [a[1], b[1], c[1]]);

    expect(Math.min(...xCoordinates)).toBeCloseTo(-5 * scale, 5);
    expect(Math.max(...xCoordinates)).toBeCloseTo(5 * scale, 5);
    expect(Math.min(...yCoordinates)).toBeCloseTo(0, 5);
    expect(Math.max(...yCoordinates)).toBeCloseTo(10 * scale, 5);
  });

  it('rejects an invalid export scale', async () => {
    await expect(buildBinaryStl([cube('invalid-scale', 0)], 0)).rejects.toThrow('打印比例必须大于 0');
  });

  it.each(BRICK_DEFINITIONS)(
    'converts $id procedural geometry to a printable solid',
    async (definition) => {
      const buffer = await buildBinaryStl([{
        id: `test-${definition.id}`,
        definitionId: definition.id,
        position: [0, definition.size[1] / 2, 0],
        rotation: [0, 0, 0],
      }]);
      expect(parseBinaryStl(buffer).length).toBeGreaterThan(0);
    },
  );
});
