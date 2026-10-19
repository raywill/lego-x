import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Color, Euler, Matrix3, Mesh, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import { getBrickDefinition } from '../../bricks/catalog';
import { createBrickGroup } from '../../bricks/geometry';
import { textFitsSurface, textRotationForNormal } from '../../editor/text/textPlacement';
import { useEditorStore } from '../../store/editorStore';
import { useTextToolStore } from '../../store/textToolStore';
import { TextObject } from './TextObject';

export function TextInteraction() {
  const { camera, gl } = useThree();
  const bricks = useEditorStore((state) => state.bricks);
  const draft = useTextToolStore((state) => state.draft);
  const preview = useTextToolStore((state) => state.preview);
  const valid = useTextToolStore((state) => state.valid);
  useEffect(() => {
    if (!draft) return;
    const bodies = bricks.flatMap((brick) => {
      const definition = getBrickDefinition(brick.definitionId);
      if (!definition) return [];
      const object = createBrickGroup(definition, { includeConnectorGeometry: false });
      object.position.set(...brick.position); object.rotation.set(...brick.rotation); object.updateMatrixWorld(true);
      object.traverse((child) => { child.userData.hostBrickId = brick.id; });
      return [object];
    });
    const ray = new Raycaster();
    let pointerDown = false;
    const move = (event: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const over = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!over) { useTextToolStore.getState().showPreview(null, false); return; }
      ray.setFromCamera(new Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hit = ray.intersectObjects(bodies, true)[0];
      if (!hit?.face) {
        const point = ray.ray.at(100, new Vector3());
        const rotation = new Euler().setFromQuaternion(camera.quaternion);
        useTextToolStore.getState().showPreview({ ...draft, hostBrickId: '', position: point.toArray(), rotation: [rotation.x, rotation.y, rotation.z] }, false);
        return;
      }
      const host = bricks.find((brick) => brick.id === hit.object.userData.hostBrickId)!;
      const inverse = new Quaternion().setFromEuler(new Euler(...host.rotation)).invert();
      const localPoint = hit.point.clone().sub(new Vector3(...host.position)).applyQuaternion(inverse);
      const normal = hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().applyQuaternion(inverse);
      const text = { ...draft, hostBrickId: host.id, position: localPoint.toArray() as [number, number, number], rotation: textRotationForNormal(normal) };
      if (!draft.hostBrickId && draft.color === '#343746') {
        const hostColor = new Color(host.color ?? getBrickDefinition(host.definitionId)?.color ?? '#888888');
        if (0.2126 * hostColor.r + 0.7152 * hostColor.g + 0.0722 * hostColor.b < 0.25) text.color = '#f3f4f8';
      }
      useTextToolStore.getState().showPreview(text, textFitsSurface(text, host));
    };
    const down = (event: PointerEvent) => { if (event.button !== 0) return; pointerDown = true; move(event); };
    const up = (event: PointerEvent) => {
      if (!pointerDown) return;
      pointerDown = false; move(event);
      const state = useTextToolStore.getState();
      if (state.preview && state.valid) {
        useEditorStore.getState().putText(state.preview);
        state.select(state.preview.id); state.cancel();
      } else {
        useEditorStore.getState().setToast('这里放不下文字，请换个平整面或选择小号');
        state.cancel();
      }
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') useTextToolStore.getState().cancel(); };
    const cancel = () => useTextToolStore.getState().cancel();
    gl.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('keydown', key);
    return () => {
      gl.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', key);
      bodies.forEach((body) => body.traverse((child) => {
        if (child instanceof Mesh) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach((material) => material.dispose()); }
      }));
    };
  }, [bricks, camera, draft, gl]);
  const host = bricks.find((brick) => brick.id === preview?.hostBrickId);
  const freeHost = { id: '', definitionId: '', position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] };
  return preview ? <TextObject text={preview} host={host ?? freeHost} ghost valid={valid} /> : null;
}
