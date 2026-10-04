import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import { useCallback, useEffect, useRef } from 'react';
import { Vector3 } from 'three';

import { PRINT_BED } from '../../config/brickConfig';
import { getBrickBodyBounds } from '../../editor/grid/gridEngine';
import { useEditorStore } from '../../store/editorStore';

interface Point {
  x: number;
  y: number;
}

export function MarqueeSelection() {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const startRef = useRef<(Point & { pointerId: number }) | null>(null);
  const multiSelectMode = useEditorStore((state) => state.multiSelectMode);
  const groupCopy = useEditorStore((state) => state.groupCopy);
  const groupMove = useEditorStore((state) => state.groupMove);
  const setSelectionMarquee = useEditorStore((state) => state.setSelectionMarquee);
  const setSelectedBricks = useEditorStore((state) => state.setSelectedBricks);

  const localPoint = useCallback((clientX: number, clientY: number): Point => {
    const bounds = gl.domElement.getBoundingClientRect();
    return { x: clientX - bounds.left, y: clientY - bounds.top };
  }, [gl.domElement]);

  const finish = useCallback((end: Point) => {
    const start = startRef.current;
    startRef.current = null;
    setSelectionMarquee(null);
    if (!start || Math.hypot(end.x - start.x, end.y - start.y) < 6) return;
    const rectangle = {
      left: Math.min(start.x, end.x),
      right: Math.max(start.x, end.x),
      top: Math.min(start.y, end.y),
      bottom: Math.max(start.y, end.y),
    };
    const hits = useEditorStore.getState().bricks.filter((brick) => {
      const bounds = getBrickBodyBounds(brick);
      const corners: Vector3[] = [];
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z]) {
            corners.push(new Vector3(x, y, z).project(camera));
          }
        }
      }
      const screenX = corners.map((point) => (point.x + 1) * size.width / 2);
      const screenY = corners.map((point) => (1 - point.y) * size.height / 2);
      return Math.max(...screenX) >= rectangle.left
        && Math.min(...screenX) <= rectangle.right
        && Math.max(...screenY) >= rectangle.top
        && Math.min(...screenY) <= rectangle.bottom;
    }).map((brick) => brick.id);
    const alreadySelected = useEditorStore.getState().selectedIds;
    setSelectedBricks([...alreadySelected, ...hits]);
  }, [camera, setSelectedBricks, setSelectionMarquee, size.height, size.width]);

  useEffect(() => {
    if (!multiSelectMode || groupCopy || groupMove) return;
    const move = (event: PointerEvent) => {
      const start = startRef.current;
      if (!start || event.pointerId !== start.pointerId) return;
      const point = localPoint(event.clientX, event.clientY);
      setSelectionMarquee({
        left: Math.min(start.x, point.x),
        top: Math.min(start.y, point.y),
        width: Math.abs(point.x - start.x),
        height: Math.abs(point.y - start.y),
      });
    };
    const end = (event: PointerEvent) => {
      const start = startRef.current;
      if (!start || event.pointerId !== start.pointerId) return;
      finish(localPoint(event.clientX, event.clientY));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [finish, groupCopy, groupMove, localPoint, multiSelectMode, setSelectionMarquee]);

  const begin = (event: ThreeEvent<PointerEvent>) => {
    if (!multiSelectMode || groupCopy || groupMove || event.button !== 0) return;
    event.stopPropagation();
    const point = localPoint(event.clientX, event.clientY);
    startRef.current = { ...point, pointerId: event.pointerId };
    setSelectionMarquee({ left: point.x, top: point.y, width: 0, height: 0 });
  };

  if (!multiSelectMode || groupCopy || groupMove) return null;
  return (
    <mesh
      position={[0, 0.055, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={begin}
    >
      <planeGeometry args={[PRINT_BED.width, PRINT_BED.depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
