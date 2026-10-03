import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Mesh, MeshStandardMaterial } from 'three';
import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import type { BrickInstance } from '../../types/model';

interface BrickObjectProps {
  brick: BrickInstance;
  selected?: boolean;
  opacity?: number;
  ghost?: boolean;
  onPointerDown?: (event: ThreeEvent<PointerEvent>, brick: BrickInstance) => void;
}

export function BrickObject({
  brick,
  selected = false,
  opacity = 1,
  ghost = false,
  onPointerDown,
}: BrickObjectProps) {
  const definition = getBrickDefinition(brick.definitionId);
  const object = useMemo(() => {
    if (!definition) return null;
    const group = createBrickGroup(definition, {
      color: brick.color ?? definition.color,
      opacity,
      transparent: opacity < 1,
    });
    group.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.castShadow = opacity >= 0.8;
      child.receiveShadow = opacity >= 0.8;
      if (selected) {
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          if (!(material instanceof MeshStandardMaterial)) return;
          material.emissive.set('#4d3fc4');
          material.emissiveIntensity = 0.2;
        });
      }
    });
    return group;
  }, [brick.color, definition, opacity, selected]);

  useEffect(() => () => {
    object?.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    });
  }, [object]);

  if (!definition || !object) return null;

  return (
    <group
      position={brick.position}
      rotation={brick.rotation}
      onPointerDown={ghost || !onPointerDown ? undefined : (event) => onPointerDown(event, brick)}
    >
      <primitive object={object} />
      {selected && !ghost && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -definition.size[1] / 2 - 0.26, 0]}>
          <ringGeometry args={[
            Math.max(definition.size[0], definition.size[2]) * 0.62,
            Math.max(definition.size[0], definition.size[2]) * 0.78,
            40,
          ]} />
          <meshBasicMaterial color="#6656e4" transparent opacity={0.72} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
