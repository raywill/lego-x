import { useEffect, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, DoubleSide } from 'three';
import { createTextMesh, loadTextFont } from '../../editor/text/textGeometry';
import { useEditorStore } from '../../store/editorStore';
import { useTextToolStore } from '../../store/textToolStore';
import type { BrickInstance, TextDecoration } from '../../types/model';

export function TextObject({ text, host, ghost = false, valid = true, opacity = 1 }: {
  text: TextDecoration; host: BrickInstance; ghost?: boolean; valid?: boolean; opacity?: number;
}) {
  const [object, setObject] = useState<Group | null>(null);
  const selectedId = useTextToolStore((state) => state.selectedId);
  useEffect(() => {
    let active = true;
    let group: Group | null = null;
    void loadTextFont().then(() => {
      if (!active) return;
      group = new Group();
      const mesh = createTextMesh({ ...text, color: ghost ? (valid ? '#226fce' : '#e24c50') : text.color }, ghost ? 0.65 : opacity);
      if (selectedId === text.id && !ghost) {
        const material = mesh.material as import('three').MeshStandardMaterial;
        material.emissive.set('#5544bb'); material.emissiveIntensity = 0.25;
      }
      group.add(mesh);
      if (ghost) {
        const bounds = mesh.geometry.boundingBox!;
        const plate = new Mesh(new PlaneGeometry(bounds.max.x - bounds.min.x + 0.8, bounds.max.y - bounds.min.y + 0.8), new MeshBasicMaterial({
          color: valid ? '#226fce' : '#e24c50', opacity: 0.15, transparent: true, depthWrite: false, side: DoubleSide,
        }));
        plate.position.copy(mesh.position); plate.rotation.copy(mesh.rotation);
        plate.translateZ(0.015);
        group.add(plate);
      }
      setObject(group);
    }).catch((error) => { if (active) useEditorStore.getState().setToast(String(error)); });
    return () => {
      active = false;
      group?.traverse((child) => {
        if (child instanceof Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); }
      });
    };
  }, [text, ghost, valid, opacity, selectedId]);
  if (!object) return null;
  return <group position={host.position} rotation={host.rotation} onPointerDown={ghost ? undefined : (event: ThreeEvent<PointerEvent>) => {
    if (useTextToolStore.getState().draft || useEditorStore.getState().multiSelectMode) return;
    event.stopPropagation();
    useEditorStore.getState().selectBrick(null);
    useTextToolStore.getState().select(text.id);
  }}><primitive object={object} /></group>;
}
