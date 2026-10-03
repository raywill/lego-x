import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { resolveViewGridAxes } from '../../editor/movement/keyboardMoveEngine';
import { useEditorStore } from '../../store/editorStore';
import type { Vec3Tuple } from '../../types/model';

export type CameraView = 'home' | 'top' | 'front' | 'side';

const CAMERA_POSITIONS: Record<CameraView, [number, number, number]> = {
  home: [118, 92, 132],
  top: [0, 235, 0.01],
  front: [0, 54, 205],
  side: [205, 54, 0],
};

export function CameraRig({ view, resetKey, dragging }: { view: CameraView; resetKey: number; dragging: boolean }) {
  const camera = useThree((state) => state.camera);
  const controls = useRef<OrbitControlsImpl>(null);
  const syncViewRightAxis = useCallback(() => {
    const cameraRight = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const cameraForward = camera.getWorldDirection(new Vector3()).normalize();
    const cameraUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    const axes = resolveViewGridAxes(
      cameraRight.toArray() as Vec3Tuple,
      cameraForward.toArray() as Vec3Tuple,
      cameraUp.toArray() as Vec3Tuple,
    );
    useEditorStore.getState().setViewRightAxis(axes.right);
  }, [camera]);

  useEffect(() => {
    camera.position.set(...CAMERA_POSITIONS[view]);
    camera.lookAt(0, 18, 0);
    controls.current?.target.set(0, 18, 0);
    controls.current?.update();
    syncViewRightAxis();
  }, [camera, resetKey, syncViewRightAxis, view]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enabled={!dragging}
      minDistance={45}
      maxDistance={350}
      maxPolarAngle={Math.PI / 2.02}
      enableDamping
      dampingFactor={0.1}
      screenSpacePanning
      onChange={syncViewRightAxis}
    />
  );
}
