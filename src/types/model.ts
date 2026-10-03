export type Vec3Tuple = [number, number, number];
export type EulerTuple = [number, number, number];
export type Axis = 'x' | 'y' | 'z';

export type ConnectorType =
  | 'stud'
  | 'socket'
  | 'rod'
  | 'hole'
  | 'hinge'
  | 'magnet';
export type ConnectorPolarity = 'male' | 'female' | 'neutral';

export interface ConnectorDefinition {
  id: string;
  type: ConnectorType;
  position: Vec3Tuple;
  rotation: EulerTuple;
  compatibleWith: ConnectorType[];
  polarity?: ConnectorPolarity;
  snapDistance: number;
  twistSteps?: 1 | 2 | 4;
}

export type GeometryDefinition =
  | { kind: 'box'; size: Vec3Tuple; radius?: number }
  | { kind: 'cylinder'; radius: number; length: number; axis: Axis }
  | { kind: 'cone'; radius: number; height: number; axis: Axis }
  | { kind: 'tube'; outerRadius: number; innerRadius: number; length: number; axis: Axis }
  | { kind: 'sphere'; radius: number }
  | { kind: 'hemisphere'; radius: number; axis: Axis }
  | { kind: 'torus'; majorRadius: number; tubeRadius: number; axis: Axis }
  | { kind: 'triangularPrism'; size: Vec3Tuple; symmetric?: boolean }
  | { kind: 'wedge'; size: Vec3Tuple }
  | { kind: 'doubleWedge'; size: Vec3Tuple }
  | { kind: 'trapezoidPrism'; size: Vec3Tuple; topWidth: number }
  | { kind: 'halfCylinder'; radius: number; length: number; axis: Axis }
  | {
      kind: 'frame';
      size: Vec3Tuple;
      opening: 'square' | 'circle' | 'arch';
      wallThickness: number;
    }
  | { kind: 'concaveArcBlock'; size: Vec3Tuple; radius: number }
  | { kind: 'sphereOctantCutout'; size: Vec3Tuple; radius: number }
  | { kind: 'quarterCylinder'; radius: number; length: number; axis: Axis }
  | { kind: 'compound'; parts: GeometryPartDefinition[] };

export interface GeometryPartDefinition {
  geometry: GeometryDefinition;
  position?: Vec3Tuple;
  rotation?: EulerTuple;
  color?: string;
}

export type BrickCategory =
  | 'blocks'
  | 'round'
  | 'slopes'
  | 'curves'
  | 'frames'
  | 'mechanical';

export interface BrickDefinition {
  id: string;
  name: string;
  shortName: string;
  category: BrickCategory;
  size: Vec3Tuple;
  color: string;
  geometry: GeometryDefinition;
  connectors: ConnectorDefinition[];
}

export interface BrickInstance {
  id: string;
  definitionId: string;
  position: Vec3Tuple;
  rotation: EulerTuple;
  color?: string;
}

export interface Connection {
  brickA: string;
  connectorA: string;
  brickB: string;
  connectorB: string;
}

export interface ProjectSnapshot {
  bricks: BrickInstance[];
  connections: Connection[];
}

export interface ProjectData extends ProjectSnapshot {
  version: typeof import('../config/brickConfig').PROJECT_VERSION;
}
