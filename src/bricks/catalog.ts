import { Euler, Quaternion, Vector3 } from 'three';

import { BRICK_CONFIG, BRICK_LAYER, BRICK_UNIT } from '../config/brickConfig';
import type {
  Axis,
  BrickDefinition,
  ConnectorDefinition,
  ConnectorPolarity,
  ConnectorType,
  EulerTuple,
  Vec3Tuple,
} from '../types/model';

/**
 * Connector frames use local +Y as their outward normal and local +Z as their
 * twist reference. This is the only orientation convention the snap engine
 * needs to understand.
 */
export type ConnectorFace =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'front'
  | 'back';

const HALF_TURN = Math.PI;
const QUARTER_TURN = Math.PI / 2;
const UP = new Vector3(0, 1, 0);

const FACE_ROTATIONS: Record<ConnectorFace, EulerTuple> = {
  top: [0, 0, 0],
  // Rotating around Z keeps the +Z twist reference identical on mating faces.
  bottom: [0, 0, HALF_TURN],
  right: [0, 0, -QUARTER_TURN],
  left: [0, 0, QUARTER_TURN],
  // Keep +Z (the twist reference) pointing upward on both front and back.
  // This lets a side magnet mate without rolling an upright brick.
  front: [QUARTER_TURN, HALF_TURN, 0],
  back: [-QUARTER_TURN, 0, 0],
};

const COMPATIBILITY: Record<ConnectorType, ConnectorType[]> = {
  stud: ['socket'],
  socket: ['stud'],
  rod: ['hole'],
  hole: ['rod'],
  hinge: ['hinge'],
  magnet: ['magnet'],
};

const POLARITY: Record<ConnectorType, ConnectorPolarity> = {
  stud: 'male',
  socket: 'female',
  rod: 'male',
  hole: 'female',
  hinge: 'neutral',
  magnet: 'neutral',
};

function cleanAngle(value: number): number {
  return Math.abs(value) < 1e-10 ? 0 : value;
}

export function createConnector(
  id: string,
  type: ConnectorType,
  position: Vec3Tuple,
  rotation: EulerTuple = [0, 0, 0],
): ConnectorDefinition {
  return {
    id,
    type,
    position: [...position],
    rotation: [...rotation],
    compatibleWith: [...COMPATIBILITY[type]],
    polarity: POLARITY[type],
    snapDistance:
      type === 'rod' || type === 'hole'
        ? BRICK_UNIT * 0.55
        : BRICK_CONFIG.snapDistance,
    // Side magnets have a single upright orientation. Allowing quarter-turns
    // around a horizontal face normal could roll a child's brick onto its side.
    twistSteps: type === 'hinge' || type === 'magnet' ? 1 : 4,
  };
}

/** Create a connector whose +Y axis points along an arbitrary local normal. */
export function createOrientedConnector(
  id: string,
  type: ConnectorType,
  position: Vec3Tuple,
  normal: Vec3Tuple,
): ConnectorDefinition {
  const direction = new Vector3(...normal).normalize();
  const quaternion = new Quaternion().setFromUnitVectors(UP, direction);
  const euler = new Euler().setFromQuaternion(quaternion, 'XYZ');
  return createConnector(id, type, position, [
    cleanAngle(euler.x),
    cleanAngle(euler.y),
    cleanAngle(euler.z),
  ]);
}

function facePosition(
  face: ConnectorFace,
  size: Vec3Tuple,
  u: number,
  v: number,
): Vec3Tuple {
  const [width, height, depth] = size;
  switch (face) {
    case 'top':
      return [u, height / 2, v];
    case 'bottom':
      return [u, -height / 2, v];
    case 'right':
      return [width / 2, v, u];
    case 'left':
      return [-width / 2, v, u];
    case 'front':
      return [u, v, depth / 2];
    case 'back':
      return [u, v, -depth / 2];
  }
}

export function createFaceConnector(
  id: string,
  type: ConnectorType,
  face: ConnectorFace,
  size: Vec3Tuple,
  u = 0,
  v = 0,
): ConnectorDefinition {
  return createConnector(
    id,
    type,
    facePosition(face, size, u, v),
    FACE_ROTATIONS[face],
  );
}

export interface ConnectorGridOptions {
  face: ConnectorFace;
  type: ConnectorType;
  size: Vec3Tuple;
  columns: number;
  rows: number;
  pitchU?: number;
  pitchV?: number;
  idPrefix?: string;
}

/**
 * Expands a compact face pattern into explicit, stable connector records.
 * The runtime catalog never contains an implicit grid.
 */
export function createConnectorGrid({
  face,
  type,
  size,
  columns,
  rows,
  pitchU = BRICK_UNIT,
  pitchV = BRICK_UNIT,
  idPrefix = `${face}-${type}`,
}: ConnectorGridOptions): ConnectorDefinition[] {
  const connectors: ConnectorDefinition[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u = (column - (columns - 1) / 2) * pitchU;
      const v = (row - (rows - 1) / 2) * pitchV;
      connectors.push(
        createFaceConnector(
          `${idPrefix}-${column}-${row}`,
          type,
          face,
          size,
          u,
          v,
        ),
      );
    }
  }
  return connectors;
}

export function createTopBottomGrid(
  size: Vec3Tuple,
  columns: number,
  rows: number,
): ConnectorDefinition[] {
  return [
    ...createConnectorGrid({
      face: 'top',
      type: 'stud',
      size,
      columns,
      rows,
    }),
    ...createConnectorGrid({
      face: 'bottom',
      type: 'socket',
      size,
      columns,
      rows,
    }),
  ];
}

/**
 * Explicit logical connection points on the four vertical faces of a box.
 * They sit exactly on the body boundary, so mating a pair makes the planar
 * faces touch without introducing generic surface snapping.
 *
 * Magnet connectors are logical-only: geometry.ts creates protrusions for
 * studs and rods, never for magnets.
 */
export function createSideMagnetConnectors(
  size: Vec3Tuple,
  columnsX: number,
  columnsZ: number,
): ConnectorDefinition[] {
  const verticalRows = Math.max(1, Math.round(size[1] / BRICK_LAYER));
  const centerConnectors = [
    ...createConnectorGrid({
      face: 'left',
      type: 'magnet',
      size,
      columns: columnsZ,
      rows: 1,
      idPrefix: 'side-left-magnet',
    }),
    ...createConnectorGrid({
      face: 'right',
      type: 'magnet',
      size,
      columns: columnsZ,
      rows: 1,
      idPrefix: 'side-right-magnet',
    }),
    ...createConnectorGrid({
      face: 'front',
      type: 'magnet',
      size,
      columns: columnsX,
      rows: 1,
      idPrefix: 'side-front-magnet',
    }),
    ...createConnectorGrid({
      face: 'back',
      type: 'magnet',
      size,
      columns: columnsX,
      rows: 1,
      idPrefix: 'side-back-magnet',
    }),
  ];
  if (verticalRows === 1) return centerConnectors;

  const layered = (face: ConnectorFace, columns: number) => createConnectorGrid({
    face,
    type: 'magnet',
    size,
    columns,
    rows: verticalRows,
    pitchV: BRICK_LAYER,
    idPrefix: `side-${face}-magnet-layer`,
  });
  return [
    ...centerConnectors,
    ...layered('left', columnsZ),
    ...layered('right', columnsZ),
    ...layered('front', columnsX),
    ...layered('back', columnsX),
  ];
}

export function createAxisPair(
  size: Vec3Tuple,
  axis: Axis,
  type: ConnectorType,
  idPrefix = type,
): ConnectorDefinition[] {
  const faces: Record<Axis, [ConnectorFace, ConnectorFace]> = {
    x: ['left', 'right'],
    y: ['bottom', 'top'],
    z: ['back', 'front'],
  };
  const [negative, positive] = faces[axis];
  return [
    createFaceConnector(`${idPrefix}-${axis}-negative`, type, negative, size),
    createFaceConnector(`${idPrefix}-${axis}-positive`, type, positive, size),
  ];
}

function bottomGrid(
  size: Vec3Tuple,
  columns: number,
  rows: number,
): ConnectorDefinition[] {
  return createConnectorGrid({
    face: 'bottom',
    type: 'socket',
    size,
    columns,
    rows,
  });
}

function slopeConnector(
  id: string,
  position: Vec3Tuple,
  normal: Vec3Tuple,
): ConnectorDefinition {
  return createOrientedConnector(id, 'stud', position, normal);
}

function annulusSurfaceConnectors(size: Vec3Tuple): ConnectorDefinition[] {
  const radialOffset = BRICK_UNIT * 0.6;
  const points: Array<[number, number]> = [
    [radialOffset, 0],
    [-radialOffset, 0],
    [0, radialOffset],
    [0, -radialOffset],
  ];
  return points.flatMap(([x, z], index) => [
    createFaceConnector(`top-stud-ring-${index}`, 'stud', 'top', size, x, z),
    createFaceConnector(
      `bottom-socket-ring-${index}`,
      'socket',
      'bottom',
      size,
      x,
      z,
    ),
  ]);
}

const U = BRICK_UNIT;
const PLATE = BRICK_CONFIG.plateHeight;
const DISC = BRICK_CONFIG.discHeight;
const ROD_DIAMETER = BRICK_CONFIG.rodRadius * 2;

const cubeSize: Vec3Tuple = [U, U, U];
const block1x2Size: Vec3Tuple = [2 * U, U, U];
const block2x2Size: Vec3Tuple = [2 * U, U, 2 * U];
const block2x4Size: Vec3Tuple = [4 * U, U, 2 * U];
const beamSize: Vec3Tuple = [6 * U, U, U];
const plate1x2Size: Vec3Tuple = [2 * U, PLATE, U];
const plate3x3Size: Vec3Tuple = [3 * U, PLATE, 3 * U];
const plate1x6Size: Vec3Tuple = [6 * U, PLATE, U];
const cylinderSize: Vec3Tuple = [U, U, U];
const cone1Size: Vec3Tuple = [U, U, U];
const cone2Size: Vec3Tuple = [2 * U, 2 * U, 2 * U];
const discSize: Vec3Tuple = [2 * U, DISC, 2 * U];
const rodSize: Vec3Tuple = [ROD_DIAMETER, 4 * U, ROD_DIAMETER];
const ringSize: Vec3Tuple = [2 * U, PLATE, 2 * U];
const triangleSize: Vec3Tuple = [2 * U, 2 * U, U];
const wedgeSize: Vec3Tuple = [3 * U, U, 2 * U];
const roofSize: Vec3Tuple = [4 * U, 2 * U, 2 * U];
const trapezoidSize: Vec3Tuple = [3 * U, U, 2 * U];
const halfCylinderSize: Vec3Tuple = [3 * U, U, 2 * U];
const hemisphereSize: Vec3Tuple = [2 * U, U, 2 * U];
const sphereSize: Vec3Tuple = [2 * U, 2 * U, 2 * U];
const wheelSize: Vec3Tuple = [U, 3 * U, 3 * U];
const axleSize: Vec3Tuple = [5 * U, ROD_DIAMETER, ROD_DIAMETER];
const hingeSize: Vec3Tuple = [2 * U, U, 2 * U];
const largeWheelSize: Vec3Tuple = [U, 5 * U, 5 * U];
const handleSize: Vec3Tuple = [U, 3 * U, 3 * U];

const beamSideHoles = [
  ...createConnectorGrid({
    face: 'front',
    type: 'hole',
    size: beamSize,
    columns: 6,
    rows: 1,
    idPrefix: 'front-hole',
  }),
  ...createConnectorGrid({
    face: 'back',
    type: 'hole',
    size: beamSize,
    columns: 6,
    rows: 1,
    idPrefix: 'back-hole',
  }),
];

const symmetricTriangleSlopes: ConnectorDefinition[] = [
  slopeConnector('left-slope-stud', [-U / 2, 0, 0], [-2, 1, 0]),
  slopeConnector('right-slope-stud', [U / 2, 0, 0], [2, 1, 0]),
];

const roofSlopeStuds: ConnectorDefinition[] = [];
for (const side of [-1, 1] as const) {
  for (const alongSlope of [0, 1]) {
    for (const z of [-U / 2, U / 2]) {
      const x = side * (alongSlope === 0 ? U / 2 : 1.5 * U);
      const y = alongSlope === 0 ? U / 2 : -U / 2;
      roofSlopeStuds.push(
        slopeConnector(
          `${side < 0 ? 'left' : 'right'}-slope-stud-${alongSlope}-${z < 0 ? 0 : 1}`,
          [x, y, z],
          [side, 1, 0],
        ),
      );
    }
  }
}

const wheelGeometry = {
  kind: 'compound',
  parts: [
    {
      geometry: { kind: 'torus', majorRadius: U, tubeRadius: U * 0.5, axis: 'x' },
      color: '#27324a',
    },
    {
      geometry: { kind: 'cylinder', radius: U * 0.42, length: U, axis: 'x' },
    },
    { geometry: { kind: 'box', size: [U * 0.52, U * 0.2, U * 2.2] } },
    {
      geometry: { kind: 'box', size: [U * 0.52, U * 0.2, U * 2.2] },
      rotation: [QUARTER_TURN, 0, 0],
    },
  ],
} satisfies BrickDefinition['geometry'];

const largeWheelGeometry = {
  kind: 'compound',
  parts: [
    {
      geometry: { kind: 'torus', majorRadius: U * 2, tubeRadius: U * 0.5, axis: 'x' },
      color: '#263044',
    },
    {
      geometry: { kind: 'cylinder', radius: U * 0.5, length: U, axis: 'x' },
    },
    { geometry: { kind: 'box', size: [U * 0.7, U * 0.28, U * 3.8] } },
    {
      geometry: { kind: 'box', size: [U * 0.7, U * 0.28, U * 3.8] },
      rotation: [QUARTER_TURN, 0, 0],
    },
  ],
} satisfies BrickDefinition['geometry'];

const handleParts: Extract<BrickDefinition['geometry'], { kind: 'compound' }>['parts'] = [
  {
    geometry: { kind: 'torus', majorRadius: U, tubeRadius: U * 0.5, axis: 'x' },
  },
  {
    geometry: { kind: 'cylinder', radius: U * 0.3, length: U, axis: 'x' },
  },
];
for (const angle of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
  const radialCenter = U * 0.69;
  handleParts.push({
    geometry: { kind: 'box', size: [U * 0.8, U * 0.2, U * 1.5] },
    position: [
      0,
      -Math.sin(angle) * radialCenter,
      Math.cos(angle) * radialCenter,
    ],
    rotation: [angle, 0, 0],
  });
}

/** A deliberately small library of generic construction pieces. */
export const BRICK_DEFINITIONS: BrickDefinition[] = [
  {
    id: 'cube-1',
    name: '小方块',
    shortName: '方块',
    category: 'blocks',
    size: cubeSize,
    color: '#ff6b5f',
    geometry: { kind: 'box', size: cubeSize },
    connectors: [
      ...createTopBottomGrid(cubeSize, 1, 1),
      ...createSideMagnetConnectors(cubeSize, 1, 1),
    ],
  },
  {
    id: 'block-1x2',
    name: '一乘二长方块',
    shortName: '短砖',
    category: 'blocks',
    size: block1x2Size,
    color: '#ff914d',
    geometry: { kind: 'box', size: block1x2Size },
    connectors: [
      ...createTopBottomGrid(block1x2Size, 2, 1),
      ...createSideMagnetConnectors(block1x2Size, 2, 1),
    ],
  },
  {
    id: 'block-2x2',
    name: '二乘二方块',
    shortName: '方砖',
    category: 'blocks',
    size: block2x2Size,
    color: '#ffc642',
    geometry: { kind: 'box', size: block2x2Size },
    connectors: [
      ...createTopBottomGrid(block2x2Size, 2, 2),
      ...createSideMagnetConnectors(block2x2Size, 2, 2),
    ],
  },
  {
    id: 'block-2x4',
    name: '二乘四大方块',
    shortName: '大砖',
    category: 'blocks',
    size: block2x4Size,
    color: '#58c96f',
    geometry: { kind: 'box', size: block2x4Size },
    connectors: [
      ...createTopBottomGrid(block2x4Size, 4, 2),
      ...createSideMagnetConnectors(block2x4Size, 4, 2),
    ],
  },
  {
    id: 'beam-long',
    name: '长方梁',
    shortName: '长梁',
    category: 'blocks',
    size: beamSize,
    color: '#43b8d8',
    geometry: { kind: 'box', size: beamSize },
    connectors: [
      ...createTopBottomGrid(beamSize, 6, 1),
      ...createSideMagnetConnectors(beamSize, 6, 1),
      ...beamSideHoles,
    ],
  },
  {
    id: 'plate-1x2',
    name: '薄长板',
    shortName: '薄板',
    category: 'blocks',
    size: plate1x2Size,
    color: '#6b8ef2',
    geometry: { kind: 'box', size: plate1x2Size },
    connectors: [
      ...createTopBottomGrid(plate1x2Size, 2, 1),
      ...createSideMagnetConnectors(plate1x2Size, 2, 1),
    ],
  },
  {
    id: 'plate-3x3',
    name: '方形板',
    shortName: '方板',
    category: 'blocks',
    size: plate3x3Size,
    color: '#9275ed',
    geometry: { kind: 'box', size: plate3x3Size },
    connectors: [
      ...createTopBottomGrid(plate3x3Size, 3, 3),
      ...createSideMagnetConnectors(plate3x3Size, 3, 3),
    ],
  },
  {
    id: 'plate-1x6',
    name: '长薄板',
    shortName: '长板',
    category: 'blocks',
    size: plate1x6Size,
    color: '#e36fc6',
    geometry: { kind: 'box', size: plate1x6Size },
    connectors: [
      ...createTopBottomGrid(plate1x6Size, 6, 1),
      ...createSideMagnetConnectors(plate1x6Size, 6, 1),
    ],
  },
  {
    id: 'cylinder',
    name: '圆柱',
    shortName: '圆柱',
    category: 'round',
    size: cylinderSize,
    color: '#ff6577',
    geometry: { kind: 'cylinder', radius: U / 2, length: U, axis: 'y' },
    connectors: createTopBottomGrid(cylinderSize, 1, 1),
  },
  {
    id: 'cone-1',
    name: '直径一圆锥',
    shortName: '小圆锥',
    category: 'round',
    size: cone1Size,
    color: '#f47662',
    geometry: { kind: 'cone', radius: U / 2, height: U, axis: 'y' },
    connectors: bottomGrid(cone1Size, 1, 1),
  },
  {
    id: 'cone-2',
    name: '直径二圆锥',
    shortName: '大圆锥',
    category: 'round',
    size: cone2Size,
    color: '#ed786f',
    geometry: { kind: 'cone', radius: U, height: 2 * U, axis: 'y' },
    connectors: bottomGrid(cone2Size, 2, 2),
  },
  {
    id: 'disc',
    name: '薄圆片',
    shortName: '圆片',
    category: 'round',
    size: discSize,
    color: '#ff9d3f',
    geometry: { kind: 'cylinder', radius: U, length: DISC, axis: 'y' },
    connectors: createTopBottomGrid(discSize, 1, 1),
  },
  {
    id: 'rod',
    name: '直杆',
    shortName: '直杆',
    category: 'round',
    size: rodSize,
    color: '#f0c438',
    geometry: { kind: 'cylinder', radius: BRICK_CONFIG.rodRadius, length: 4 * U, axis: 'y' },
    connectors: createAxisPair(rodSize, 'y', 'rod'),
  },
  {
    id: 'ring',
    name: '空心圆环',
    shortName: '圆环',
    category: 'round',
    size: ringSize,
    color: '#65c867',
    geometry: {
      kind: 'tube',
      outerRadius: U,
      innerRadius: U * 0.46,
      length: PLATE,
      axis: 'y',
    },
    connectors: [
      ...createAxisPair(ringSize, 'y', 'hole'),
      ...annulusSurfaceConnectors(ringSize),
    ],
  },
  {
    id: 'triangle-prism',
    name: '三角柱',
    shortName: '三角柱',
    category: 'slopes',
    size: triangleSize,
    color: '#42bfc5',
    geometry: { kind: 'triangularPrism', size: triangleSize, symmetric: true },
    connectors: [...bottomGrid(triangleSize, 2, 1), ...symmetricTriangleSlopes],
  },
  {
    id: 'right-triangle-prism',
    name: '直角三角柱',
    shortName: '直角块',
    category: 'slopes',
    size: triangleSize,
    color: '#4c9fe7',
    geometry: { kind: 'triangularPrism', size: triangleSize, symmetric: false },
    connectors: [
      ...bottomGrid(triangleSize, 2, 1),
      slopeConnector('slope-stud', [0, 0, 0], [1, 1, 0]),
    ],
  },
  {
    id: 'wedge',
    name: '斜坡块',
    shortName: '斜坡',
    category: 'slopes',
    size: wedgeSize,
    color: '#7184e8',
    geometry: { kind: 'wedge', size: wedgeSize },
    connectors: [
      ...bottomGrid(wedgeSize, 3, 2),
      slopeConnector('slope-stud-0', [-U * 0.75, U * 0.25, 0], [1, 3, 0]),
      slopeConnector('slope-stud-1', [U * 0.75, -U * 0.25, 0], [1, 3, 0]),
    ],
  },
  {
    id: 'roof-wedge',
    name: '双斜坡屋顶',
    shortName: '屋顶块',
    category: 'slopes',
    size: roofSize,
    color: '#9a71dc',
    geometry: { kind: 'doubleWedge', size: roofSize },
    connectors: [...bottomGrid(roofSize, 4, 2), ...roofSlopeStuds],
  },
  {
    id: 'trapezoid-prism',
    name: '梯形柱',
    shortName: '梯形块',
    category: 'slopes',
    size: trapezoidSize,
    color: '#db69b3',
    geometry: { kind: 'trapezoidPrism', size: trapezoidSize, topWidth: U },
    connectors: [
      ...bottomGrid(trapezoidSize, 3, 2),
      ...createConnectorGrid({
        face: 'top',
        type: 'stud',
        size: trapezoidSize,
        columns: 1,
        rows: 2,
      }),
    ],
  },
  {
    id: 'half-cylinder',
    name: '半圆柱',
    shortName: '半圆',
    category: 'curves',
    size: halfCylinderSize,
    color: '#f06d87',
    geometry: { kind: 'halfCylinder', radius: U, length: 3 * U, axis: 'x' },
    connectors: [
      ...bottomGrid(halfCylinderSize, 3, 2),
      createFaceConnector('left-socket', 'socket', 'left', halfCylinderSize),
      createFaceConnector('right-stud', 'stud', 'right', halfCylinderSize),
    ],
  },
  {
    id: 'hemisphere',
    name: '半球',
    shortName: '半球',
    category: 'curves',
    size: hemisphereSize,
    color: '#f29a43',
    geometry: { kind: 'hemisphere', radius: U, axis: 'y' },
    connectors: [
      createFaceConnector('bottom-socket', 'socket', 'bottom', hemisphereSize),
      createFaceConnector('apex-stud', 'stud', 'top', hemisphereSize),
    ],
  },
  {
    id: 'sphere',
    name: '球体',
    shortName: '球',
    category: 'curves',
    size: sphereSize,
    color: '#e3bf3c',
    geometry: { kind: 'sphere', radius: U },
    connectors: [
      createFaceConnector('top-stud', 'stud', 'top', sphereSize),
      createFaceConnector('bottom-socket', 'socket', 'bottom', sphereSize),
      createFaceConnector('right-stud', 'stud', 'right', sphereSize),
      createFaceConnector('left-socket', 'socket', 'left', sphereSize),
      createFaceConnector('front-stud', 'stud', 'front', sphereSize),
      createFaceConnector('back-socket', 'socket', 'back', sphereSize),
    ],
  },
  {
    id: 'wheel',
    name: '轮子',
    shortName: '轮子',
    category: 'mechanical',
    size: wheelSize,
    color: '#5bc37c',
    geometry: wheelGeometry,
    connectors: createAxisPair(wheelSize, 'x', 'hole'),
  },
  {
    id: 'axle',
    name: '车轴',
    shortName: '车轴',
    category: 'mechanical',
    size: axleSize,
    color: '#50afcf',
    geometry: { kind: 'cylinder', radius: BRICK_CONFIG.rodRadius, length: 5 * U, axis: 'x' },
    connectors: createAxisPair(axleSize, 'x', 'rod'),
  },
  {
    id: 'hinge',
    name: '直角铰链',
    shortName: '铰链',
    category: 'mechanical',
    size: hingeSize,
    color: '#697fe0',
    geometry: {
      kind: 'compound',
      parts: [
        {
          geometry: { kind: 'box', size: [2 * U, U * 0.5, U] },
          position: [0, -U * 0.25, U * 0.5],
        },
        {
          geometry: { kind: 'box', size: [2 * U, U, U * 0.5] },
          position: [0, 0, -U * 0.75],
        },
        {
          geometry: { kind: 'cylinder', radius: U * 0.25, length: 2 * U, axis: 'x' },
          position: [0, 0, -U * 0.25],
        },
      ],
    },
    connectors: [
      slopeConnector('leaf-top-stud-0', [-U / 2, 0, U / 2], [0, 1, 0]),
      slopeConnector('leaf-top-stud-1', [U / 2, 0, U / 2], [0, 1, 0]),
      createOrientedConnector('leaf-bottom-socket-0', 'socket', [-U / 2, -U / 2, U / 2], [0, -1, 0]),
      createOrientedConnector('leaf-bottom-socket-1', 'socket', [U / 2, -U / 2, U / 2], [0, -1, 0]),
      createFaceConnector('hinge-x-negative', 'hinge', 'left', hingeSize, -U / 4),
      createFaceConnector('hinge-x-positive', 'hinge', 'right', hingeSize, -U / 4),
    ],
  },
  {
    id: 'wheel-large',
    name: '大轮子',
    shortName: '大轮',
    category: 'mechanical',
    size: largeWheelSize,
    color: '#9b72e4',
    geometry: largeWheelGeometry,
    connectors: createAxisPair(largeWheelSize, 'x', 'hole'),
  },
  {
    id: 'circular-handle',
    name: '圆形把手',
    shortName: '圆把手',
    category: 'mechanical',
    size: handleSize,
    color: '#e06eb9',
    geometry: { kind: 'compound', parts: handleParts },
    connectors: createAxisPair(handleSize, 'x', 'hole'),
  },
];

const DEFINITION_BY_ID = new Map(
  BRICK_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getBrickDefinition(id: string): BrickDefinition | undefined {
  return DEFINITION_BY_ID.get(id);
}
