import type {
  Manifold,
  ManifoldToplevel,
} from 'manifold-3d';
import manifoldWasmUrl from 'manifold-3d/manifold.wasm?url';
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Material,
} from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { getBrickDefinition } from '../bricks/catalog';
import { createBrickGroup } from '../bricks/geometry';
import type { BrickInstance } from '../types/model';

const MANIFOLD_WELD_TOLERANCE_MM = 1e-5;

let manifoldModulePromise: Promise<ManifoldToplevel> | undefined;

function getManifoldModule(): Promise<ManifoldToplevel> {
  if (!manifoldModulePromise) {
    const moduleConfig = typeof window === 'undefined'
      ? undefined
      : { locateFile: () => manifoldWasmUrl };
    manifoldModulePromise = import('manifold-3d')
      .then(({ default: createManifoldModule }) => createManifoldModule(moduleConfig))
      .then((module) => {
        module.setup();
        return module;
      });
  }
  return manifoldModulePromise;
}

/**
 * Builds the geometry used by export. The editor's visible studs and rods are
 * interaction affordances only, so they are deliberately omitted here.
 */
export function createPrintableAssembly(bricks: BrickInstance[]): Group {
  const assembly = new Group();
  assembly.name = 'Digital Bricks printable assembly';

  for (const brick of bricks) {
    const definition = getBrickDefinition(brick.definitionId);
    if (!definition) continue;
    const object = createBrickGroup(definition, {
      color: brick.color ?? definition.color,
      includeConnectorGeometry: false,
    });
    object.name = `${definition.id}-${brick.id}`;
    object.position.set(...brick.position);
    object.rotation.set(...brick.rotation);
    assembly.add(object);
  }

  assembly.updateMatrixWorld(true);
  return assembly;
}

function disposeMaterial(material: Material | Material[]): void {
  const materials = Array.isArray(material) ? material : [material];
  materials.forEach((item) => item.dispose());
}

function disposeAssembly(assembly: Group): void {
  assembly.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    disposeMaterial(child.material);
  });
}

function geometryToManifold(
  module: ManifoldToplevel,
  source: BufferGeometry,
): Manifold {
  const transformed = source.clone();
  for (const attribute of Object.keys(transformed.attributes)) {
    if (attribute !== 'position') transformed.deleteAttribute(attribute);
  }

  // Three primitives split vertices at UV seams and hard normal boundaries.
  // Manifold operates on topology, so weld those coincident position-only
  // vertices before handing the mesh to the solid kernel.
  const welded = mergeVertices(transformed, MANIFOLD_WELD_TOLERANCE_MM);
  transformed.dispose();

  try {
    const position = welded.getAttribute('position');
    const index = welded.getIndex();
    if (!position || position.itemSize !== 3 || !index) {
      throw new Error('积木包含无法转换为实体的几何');
    }

    const vertProperties = new Float32Array(position.count * 3);
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const offset = vertex * 3;
      vertProperties[offset] = position.getX(vertex);
      vertProperties[offset + 1] = position.getY(vertex);
      vertProperties[offset + 2] = position.getZ(vertex);
    }

    const triVerts = new Uint32Array(index.count);
    for (let entry = 0; entry < index.count; entry += 1) {
      triVerts[entry] = index.getX(entry);
    }

    return module.Manifold.ofMesh(
      new module.Mesh({ numProp: 3, vertProperties, triVerts }),
    );
  } finally {
    welded.dispose();
  }
}

function manifoldToGeometry(solid: Manifold): BufferGeometry {
  const mesh = solid.getMesh();
  const positions = new Float32Array(mesh.numVert * 3);
  for (let vertex = 0; vertex < mesh.numVert; vertex += 1) {
    const sourceOffset = vertex * mesh.numProp;
    const targetOffset = vertex * 3;
    positions[targetOffset] = mesh.vertProperties[sourceOffset];
    positions[targetOffset + 1] = mesh.vertProperties[sourceOffset + 1];
    positions[targetOffset + 2] = mesh.vertProperties[sourceOffset + 2];
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.triVerts), 1));
  geometry.computeVertexNormals();
  return geometry;
}

async function buildUnionGeometry(bricks: BrickInstance[]): Promise<BufferGeometry> {
  const module = await getManifoldModule();
  const assembly = createPrintableAssembly(bricks);
  const solids: Manifold[] = [];

  try {
    assembly.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const worldGeometry = child.geometry.clone().applyMatrix4(child.matrixWorld);
      try {
        solids.push(geometryToManifold(module, worldGeometry));
      } finally {
        worldGeometry.dispose();
      }
    });

    if (solids.length === 0) throw new Error('场景里还没有可打印的积木');

    const union = module.Manifold.union(solids);
    try {
      return manifoldToGeometry(union);
    } finally {
      union.delete();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`无法生成完整的打印实体：${message}`);
  } finally {
    solids.forEach((solid) => solid.delete());
    disposeAssembly(assembly);
  }
}

export async function buildBinaryStl(
  bricks: BrickInstance[],
  scale = 1,
): Promise<ArrayBuffer> {
  if (!bricks.length) throw new Error('场景里还没有积木');
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('打印比例必须大于 0');

  const geometry = await buildUnionGeometry(bricks);
  geometry.scale(scale, scale, scale);
  const material = new MeshStandardMaterial();
  const printableMesh = new Mesh(geometry, material);
  printableMesh.name = 'Digital Bricks unified printable mesh';

  try {
    const data = new STLExporter().parse(printableMesh, { binary: true });
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  } finally {
    geometry.dispose();
    material.dispose();
  }
}

export async function downloadStl(
  bricks: BrickInstance[],
  filename = '我的数字积木.stl',
  scale = 1,
): Promise<void> {
  const data = await buildBinaryStl(bricks, scale);
  const blob = new Blob([data], { type: 'model/stl' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
