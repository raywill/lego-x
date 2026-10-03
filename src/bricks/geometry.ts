import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { BRICK_CONFIG, BRICK_UNIT } from '../config/brickConfig';
import type {
  Axis,
  BrickDefinition,
  GeometryDefinition,
  GeometryPartDefinition,
} from '../types/model';

export interface CreateBrickGroupOptions {
  color?: THREE.ColorRepresentation;
  connectorColor?: THREE.ColorRepresentation;
  opacity?: number;
  transparent?: boolean;
  roughness?: number;
  metalness?: number;
  includeConnectorGeometry?: boolean;
}

type PrimitiveGeometryDefinition = Exclude<
  GeometryDefinition,
  { kind: 'compound' }
>;

const AXIS_VECTOR: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

function materialFor(
  color: THREE.ColorRepresentation,
  options: CreateBrickGroupOptions,
): THREE.MeshStandardMaterial {
  const opacity = THREE.MathUtils.clamp(options.opacity ?? 1, 0, 1);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.02,
    opacity,
    transparent: options.transparent ?? opacity < 1,
    depthWrite: opacity >= 0.85,
  });
}

function orientGeometry(
  geometry: THREE.BufferGeometry,
  nativeAxis: Axis,
  requestedAxis: Axis,
): THREE.BufferGeometry {
  if (nativeAxis === requestedAxis) return geometry;
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    AXIS_VECTOR[nativeAxis],
    AXIS_VECTOR[requestedAxis],
  );
  geometry.applyQuaternion(quaternion);
  return geometry;
}

function extrudeCentered(shape: THREE.Shape, depth: number): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    bevelEnabled: false,
    curveSegments: 32,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function polygonShape(points: ReadonlyArray<readonly [number, number]>): THREE.Shape {
  const shape = new THREE.Shape();
  const [first, ...rest] = points;
  shape.moveTo(first[0], first[1]);
  for (const [x, y] of rest) shape.lineTo(x, y);
  shape.closePath();
  return shape;
}

function createTubeGeometry(
  outerRadius: number,
  innerRadius: number,
  length: number,
  axis: Axis,
): THREE.BufferGeometry {
  const safeInnerRadius = THREE.MathUtils.clamp(
    innerRadius,
    0.01,
    Math.max(0.01, outerRadius - 0.05),
  );
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, safeInnerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return orientGeometry(extrudeCentered(shape, length), 'z', axis);
}

function createHemisphereGeometry(radius: number, axis: Axis): THREE.BufferGeometry {
  const dome = new THREE.SphereGeometry(
    radius,
    36,
    18,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  const cap = new THREE.CircleGeometry(radius, 36);
  // CircleGeometry faces +Z. Rotate its outward face toward -Y.
  cap.rotateX(Math.PI / 2);
  const merged = mergeGeometries([dome, cap], false);
  dome.dispose();
  cap.dispose();
  if (!merged) throw new Error('Could not construct hemisphere geometry.');

  // A hemisphere is radius tall; center that height around the brick origin.
  merged.translate(0, -radius / 2, 0);
  return orientGeometry(merged, 'y', axis);
}

function createTriangularPrismGeometry(
  size: [number, number, number],
  symmetric: boolean,
): THREE.BufferGeometry {
  const [width, height, depth] = size;
  const apexX = symmetric ? 0 : -width / 2;
  const shape = polygonShape([
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [apexX, height / 2],
  ]);
  return extrudeCentered(shape, depth);
}

function createTrapezoidPrismGeometry(
  size: [number, number, number],
  topWidth: number,
): THREE.BufferGeometry {
  const [width, height, depth] = size;
  const clampedTopWidth = THREE.MathUtils.clamp(topWidth, 0.1, width);
  const shape = polygonShape([
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [clampedTopWidth / 2, height / 2],
    [-clampedTopWidth / 2, height / 2],
  ]);
  return extrudeCentered(shape, depth);
}

function createHalfCylinderGeometry(
  radius: number,
  length: number,
  axis: Axis,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-radius, 0);
  shape.lineTo(radius, 0);
  shape.absarc(0, 0, radius, 0, Math.PI, false);
  shape.closePath();
  const geometry = extrudeCentered(shape, length);
  // Center the half-cylinder's radius-high bounding box around the origin.
  geometry.translate(0, -radius / 2, 0);
  return orientGeometry(geometry, 'z', axis);
}

function createPrimitiveGeometry(
  definition: PrimitiveGeometryDefinition,
): THREE.BufferGeometry {
  switch (definition.kind) {
    case 'box': {
      const [width, height, depth] = definition.size;
      // Construction blocks need exact square corners and planar stacking faces.
      return new THREE.BoxGeometry(width, height, depth, 1, 1, 1);
    }
    case 'cylinder':
      return orientGeometry(
        new THREE.CylinderGeometry(
          definition.radius,
          definition.radius,
          definition.length,
          36,
          1,
          false,
        ),
        'y',
        definition.axis,
      );
    case 'cone':
      return orientGeometry(
        new THREE.ConeGeometry(
          definition.radius,
          definition.height,
          36,
          1,
          false,
        ),
        'y',
        definition.axis,
      );
    case 'tube':
      return createTubeGeometry(
        definition.outerRadius,
        definition.innerRadius,
        definition.length,
        definition.axis,
      );
    case 'sphere':
      return new THREE.SphereGeometry(definition.radius, 36, 24);
    case 'hemisphere':
      return createHemisphereGeometry(definition.radius, definition.axis);
    case 'torus':
      return orientGeometry(
        new THREE.TorusGeometry(
          definition.majorRadius,
          definition.tubeRadius,
          16,
          48,
        ),
        'z',
        definition.axis,
      );
    case 'triangularPrism':
      return createTriangularPrismGeometry(
        definition.size,
        definition.symmetric ?? true,
      );
    case 'wedge':
      return createTriangularPrismGeometry(definition.size, false);
    case 'doubleWedge':
      return createTriangularPrismGeometry(definition.size, true);
    case 'trapezoidPrism':
      return createTrapezoidPrismGeometry(
        definition.size,
        definition.topWidth,
      );
    case 'halfCylinder':
      return createHalfCylinderGeometry(
        definition.radius,
        definition.length,
        definition.axis,
      );
  }
}

function setMeshDefaults(mesh: THREE.Mesh, name: string): void {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.printable = true;
}

function appendGeometry(
  parent: THREE.Group,
  definition: GeometryDefinition,
  inheritedColor: THREE.ColorRepresentation,
  options: CreateBrickGroupOptions,
  name: string,
): void {
  if (definition.kind !== 'compound') {
    const mesh = new THREE.Mesh(
      createPrimitiveGeometry(definition),
      materialFor(inheritedColor, options),
    );
    setMeshDefaults(mesh, name);
    parent.add(mesh);
    return;
  }

  definition.parts.forEach((part, index) => {
    appendPart(parent, part, inheritedColor, options, `${name}-part-${index}`);
  });
}

function appendPart(
  parent: THREE.Group,
  part: GeometryPartDefinition,
  inheritedColor: THREE.ColorRepresentation,
  options: CreateBrickGroupOptions,
  name: string,
): void {
  const partGroup = new THREE.Group();
  partGroup.name = name;
  if (part.position) partGroup.position.set(...part.position);
  if (part.rotation) partGroup.rotation.set(...part.rotation, 'XYZ');
  parent.add(partGroup);
  appendGeometry(
    partGroup,
    part.geometry,
    part.color ?? options.color ?? inheritedColor,
    options,
    `${name}-mesh`,
  );
}

function appendMaleConnectorGeometry(
  group: THREE.Group,
  definition: BrickDefinition,
  options: CreateBrickGroupOptions,
): void {
  const baseColor = new THREE.Color(options.color ?? definition.color);
  const connectorColor =
    options.connectorColor ?? baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.08);

  for (const connector of definition.connectors) {
    if (connector.type !== 'stud' && connector.type !== 'rod') continue;

    const radius =
      connector.type === 'stud'
        ? BRICK_CONFIG.studRadius
        : BRICK_CONFIG.rodRadius;
    const length =
      connector.type === 'stud'
        ? BRICK_CONFIG.studHeight
        : BRICK_UNIT * 0.36;
    const geometry = new THREE.CylinderGeometry(
      radius,
      radius,
      length,
      connector.type === 'stud' ? 24 : 18,
      1,
      false,
    );
    const mesh = new THREE.Mesh(geometry, materialFor(connectorColor, options));
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(...connector.rotation, 'XYZ'),
    );
    const outward = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    const sourceOverlap = Math.min(
      BRICK_CONFIG.matingOverlap,
      length * 0.3,
    );
    mesh.position
      .set(...connector.position)
      .addScaledVector(outward, length / 2 - sourceOverlap);
    mesh.quaternion.copy(quaternion);
    mesh.userData.connectorId = connector.id;
    mesh.userData.connectorType = connector.type;
    setMeshDefaults(mesh, `${definition.id}-${connector.id}-physical`);
    group.add(mesh);
  }
}

/**
 * Builds procedural brick geometry. Editor previews include tangible snap
 * bumps by default; print/export callers disable them and keep only the body.
 */
export function createBrickGroup(
  definition: BrickDefinition,
  options: CreateBrickGroupOptions = {},
): THREE.Group {
  const group = new THREE.Group();
  group.name = definition.id;
  group.userData.brickDefinitionId = definition.id;

  appendGeometry(
    group,
    definition.geometry,
    options.color ?? definition.color,
    options,
    `${definition.id}-body`,
  );

  if (options.includeConnectorGeometry !== false) {
    appendMaleConnectorGeometry(group, definition, options);
  }

  return group;
}

export function getBrickGroundY(definition: BrickDefinition): number {
  // Snap protrusions only guide editing; the printable brick body is what must
  // rest on the bed.
  const group = createBrickGroup(definition, { includeConnectorGeometry: false });
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group, true);
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
  return Math.max(0, -bounds.min.y);
}
