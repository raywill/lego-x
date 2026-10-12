import type { BrickDefinition } from '../types/model';
import type { Locale } from './locale';

type EnglishBrickName = { name: string; shortName: string };

const ENGLISH_BRICK_NAMES: Record<string, EnglishBrickName> = {
  'cube-1': { name: '1×1 Cube', shortName: 'Cube' },
  'mini-cube': { name: 'Mini Cube', shortName: 'Mini Cube' },
  'block-1x2': { name: '1×2 Brick', shortName: 'Short Brick' },
  'block-2x2': { name: '2×2 Brick', shortName: 'Square Brick' },
  'block-2x4': { name: '2×4 Brick', shortName: 'Large Brick' },
  'beam-long': { name: '1×6 Beam', shortName: 'Long Beam' },
  'plate-1x1': { name: '1×1 Plate', shortName: 'Small Plate' },
  'plate-1x2': { name: '1×2 Plate', shortName: 'Plate' },
  'plate-3x3': { name: '3×3 Plate', shortName: 'Square Plate' },
  'plate-1x6': { name: '1×6 Plate', shortName: 'Long Plate' },
  cylinder: { name: 'Cylinder', shortName: 'Cylinder' },
  'cone-1': { name: '1-unit Cone', shortName: 'Small Cone' },
  'cone-2': { name: '2-unit Cone', shortName: 'Large Cone' },
  disc: { name: 'Thin Disc', shortName: 'Disc' },
  rod: { name: 'Straight Rod', shortName: 'Rod' },
  ring: { name: 'Hollow Ring', shortName: 'Ring' },
  'triangle-prism': { name: 'Triangular Prism', shortName: 'Triangle' },
  'right-triangle-prism': { name: 'Right Triangular Prism', shortName: 'Right Triangle' },
  wedge: { name: 'Wedge', shortName: 'Slope' },
  'roof-wedge': { name: 'Double-slope Roof', shortName: 'Roof' },
  'trapezoid-prism': { name: 'Trapezoidal Prism', shortName: 'Trapezoid' },
  'half-cylinder': { name: 'Half Cylinder', shortName: 'Half Round' },
  hemisphere: { name: 'Hemisphere', shortName: 'Hemisphere' },
  sphere: { name: 'Sphere', shortName: 'Sphere' },
  'frame-square': { name: 'Square Frame', shortName: 'Square Frame' },
  'frame-circle': { name: 'Circular Frame', shortName: 'Round Frame' },
  'frame-arch': { name: 'Arch Frame', shortName: 'Arch' },
  'block-concave-arc': { name: 'Concave Arc Block', shortName: 'Inner Curve' },
  'block-sphere-octant-cutout': { name: 'Concave Sphere Corner', shortName: 'Inner Corner' },
  'quarter-cylinder': { name: 'Quarter Cylinder', shortName: 'Quarter Round' },
  wheel: { name: 'Wheel', shortName: 'Wheel' },
  axle: { name: 'Axle', shortName: 'Axle' },
  hinge: { name: 'Right-angle Hinge', shortName: 'Hinge' },
  'wheel-large': { name: 'Large Wheel', shortName: 'Large Wheel' },
  'circular-handle': { name: 'Circular Handle', shortName: 'Round Handle' },
};

export function getBrickDisplayName(
  definition: Pick<BrickDefinition, 'id' | 'name' | 'shortName'>,
  locale: Locale,
  compact = false,
): string {
  if (locale === 'zh') return compact ? definition.shortName : definition.name;
  const names = ENGLISH_BRICK_NAMES[definition.id];
  if (!names) return compact ? definition.shortName : definition.name;
  return compact ? names.shortName : names.name;
}
