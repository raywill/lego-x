import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { Vector3 } from 'three';

import {
  directionForArrow,
  resolveViewGridAxes,
} from '../../editor/movement/keyboardMoveEngine';
import { useEditorStore } from '../../store/editorStore';
import type { Vec3Tuple } from '../../types/model';

const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);

export function KeyboardMovement() {
  const { camera } = useThree();

  useEffect(() => {
    const cameraRight = new Vector3();
    const cameraForward = new Vector3();
    const cameraUp = new Vector3();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!ARROW_KEYS.has(event.key) || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.matches('input, textarea, select, [contenteditable="true"]')
        || target?.closest('[role="menu"]')
      ) return;

      const state = useEditorStore.getState();
      if (!state.selectedId || state.drag) return;
      event.preventDefault();

      cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
      camera.getWorldDirection(cameraForward).normalize();
      cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
      const axes = resolveViewGridAxes(
        cameraRight.toArray() as Vec3Tuple,
        cameraForward.toArray() as Vec3Tuple,
        cameraUp.toArray() as Vec3Tuple,
      );
      state.moveSelectedByGridStep(directionForArrow(
        event.key as 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown',
        axes,
      ));
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [camera]);

  return null;
}
