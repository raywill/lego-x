import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

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

  useEffect(() => {
    camera.position.set(...CAMERA_POSITIONS[view]);
    camera.lookAt(0, 18, 0);
    controls.current?.target.set(0, 18, 0);
    controls.current?.update();
  }, [camera, resetKey, view]);

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
    />
  );
}
