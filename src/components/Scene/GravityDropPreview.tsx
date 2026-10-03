import { Line } from '@react-three/drei';
import { DoubleSide } from 'three';

import type { BrickInstance } from '../../types/model';
import { BrickObject } from './BrickObject';

export interface GravityContactFootprint {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  y: number;
}

export interface GravityDropPreviewProps {
  held: BrickInstance;
  landed: BrickInstance;
  contactFootprint: GravityContactFootprint | null;
  isSnapping: boolean;
}

const LANDED_GHOST_COLOR = '#4037a8';

/**
 * Shows where a freely placed brick will land. The child can read the dark
 * footprint and drop line without either preview participating in interaction.
 */
export function GravityDropPreview({
  held,
  landed,
  contactFootprint,
  isSnapping,
}: GravityDropPreviewProps) {
  if (isSnapping) return null;

  const landedGhost: BrickInstance = {
    ...landed,
    color: LANDED_GHOST_COLOR,
  };

  if (!contactFootprint) {
    return (
      <group name="gravity-drop-preview">
        <BrickObject brick={landedGhost} opacity={0.26} ghost />
        <BrickObject brick={held} opacity={0.48} ghost />
      </group>
    );
  }

  const minX = Math.min(contactFootprint.minX, contactFootprint.maxX);
  const maxX = Math.max(contactFootprint.minX, contactFootprint.maxX);
  const minZ = Math.min(contactFootprint.minZ, contactFootprint.maxZ);
  const maxZ = Math.max(contactFootprint.minZ, contactFootprint.maxZ);
  const width = Math.max(0.25, maxX - minX);
  const depth = Math.max(0.25, maxZ - minZ);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const planeY = contactFootprint.y + 0.035;
  const outlinePoints: [number, number, number][] = [
    [minX, planeY + 0.01, minZ],
    [maxX, planeY + 0.01, minZ],
    [maxX, planeY + 0.01, maxZ],
    [minX, planeY + 0.01, maxZ],
    [minX, planeY + 0.01, minZ],
  ];

  return (
    <group name="gravity-drop-preview">
      <BrickObject brick={landedGhost} opacity={0.27} ghost />

      <mesh
        name="gravity-contact-footprint"
        position={[centerX, planeY, centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
      >
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial
          color="#11131a"
          opacity={0.25}
          transparent
          depthWrite={false}
          side={DoubleSide}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      <Line
        name="gravity-contact-outline"
        points={outlinePoints}
        color="#11131a"
        lineWidth={1.05}
        opacity={0.42}
        transparent
        depthWrite={false}
      />

      <Line
        name="gravity-drop-line"
        points={[
          [held.position[0], held.position[1], held.position[2]],
          [held.position[0], planeY + 0.08, held.position[2]],
        ]}
        color="#171922"
        lineWidth={1.15}
        opacity={0.5}
        transparent
        depthWrite={false}
        dashed
        dashSize={1.35}
        gapSize={1.05}
      />

      <BrickObject brick={held} opacity={0.48} ghost />
    </group>
  );
}
