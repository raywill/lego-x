import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';

import { useEditorStore } from '../../store/editorStore';

export function GroupPlacementInteraction() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const active = useEditorStore((state) => Boolean(state.groupCopy || state.groupMove));
  const raycaster = useMemo(() => new Raycaster(), []);
  const ground = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);

  useEffect(() => {
    if (!active) return;
    const move = (event: PointerEvent) => {
      const bounds = gl.domElement.getBoundingClientRect();
      const pointer = new Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.ray.intersectPlane(ground, new Vector3());
      if (hit) useEditorStore.getState().updateGroupPlacement([hit.x, hit.z]);
    };
    const place = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      useEditorStore.getState().commitGroupPlacement();
    };
    gl.domElement.addEventListener('pointermove', move);
    gl.domElement.addEventListener('pointerdown', place, true);
    return () => {
      gl.domElement.removeEventListener('pointermove', move);
      gl.domElement.removeEventListener('pointerdown', place, true);
    };
  }, [active, camera, gl.domElement, ground, raycaster]);

  return null;
}
