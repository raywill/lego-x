import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { MathUtils, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from 'three';
import { getBrickDefinition } from '../../bricks/catalog';
import { BRICK_UNIT, PRINT_BED } from '../../config/brickConfig';
import { hasBrickCollision } from '../../editor/collision/collisionEngine';
import { computeDropPlacement, isBrickAboveBed } from '../../editor/gravity/dropEngine';
import { isBrickOnGrid } from '../../editor/grid/gridEngine';
import {
  findBestSnap,
  getWorldConnectors,
  type WorldConnector,
} from '../../editor/snapping/snapEngine';
import { useEditorStore } from '../../store/editorStore';
import type { BrickInstance } from '../../types/model';
import { SnapHints } from './SnapHints';

const pointer = new Vector2();
const raycaster = new Raycaster();
const intersection = new Vector3();
const HOLD_LIFT = BRICK_UNIT * 1.6;
const DROP_PROBE_Y = PRINT_BED.height * 4;

function occupiedConnectorKeys(draggedBrickId: string): Set<string> {
  const keys = new Set<string>();
  for (const connection of useEditorStore.getState().connections) {
    if (connection.brickA === draggedBrickId || connection.brickB === draggedBrickId) continue;
    keys.add(`${connection.brickA}:${connection.connectorA}`);
    keys.add(`${connection.brickB}:${connection.connectorB}`);
  }
  return keys;
}

function collectTargetConnectors(draggedBrickId: string): WorldConnector[] {
  const result: WorldConnector[] = [];
  for (const brick of useEditorStore.getState().bricks) {
    if (brick.id === draggedBrickId) continue;
    const definition = getBrickDefinition(brick.definitionId);
    if (definition) result.push(...getWorldConnectors(brick, definition));
  }
  return result;
}

function isAxisAligned(normal: readonly number[]): boolean {
  return normal.filter((component) => Math.abs(component) > 1e-5).length === 1;
}

function playSnapFeedback(): void {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(520, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(180, context.currentTime + 0.065);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.11, context.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.075);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    oscillator.addEventListener('ended', () => void context.close());
  } catch {
    // Visual feedback remains available when audio is unavailable.
  }
}

export function DragInteraction() {
  const { camera, gl } = useThree();
  const drag = useEditorStore((state) => state.drag);

  useEffect(() => {
    const canvas = gl.domElement;
    let dropAnimationFrame: number | null = null;

    const animateGravityDrop = (completedDrag: NonNullable<ReturnType<typeof useEditorStore.getState>['drag']>) => {
      const drop = completedDrag.drop;
      if (!drop) {
        useEditorStore.getState().commitDrag();
        return;
      }
      useEditorStore.getState().beginDropAnimation();
      const startPreview: BrickInstance = {
        ...completedDrag.preview,
        position: [...completedDrag.preview.position],
        rotation: [...completedDrag.preview.rotation],
      };
      const fallDistance = Math.max(0, startPreview.position[1] - drop.position[1]);
      const duration = MathUtils.clamp(150 + fallDistance * 2.8, 170, 340);
      const startedAt = performance.now();

      const step = (now: number) => {
        const state = useEditorStore.getState();
        const current = state.drag;
        if (
          !current
          || current.phase !== 'dropping'
          || current.brickId !== completedDrag.brickId
        ) return;
        const progress = MathUtils.clamp((now - startedAt) / duration, 0, 1);
        // Quadratic acceleration reads as gravity without introducing physics.
        const eased = progress * progress;
        const preview: BrickInstance = {
          ...startPreview,
          position: [
            drop.position[0],
            MathUtils.lerp(startPreview.position[1], drop.position[1], eased),
            drop.position[2],
          ],
          rotation: [...drop.rotation],
        };
        state.updateDropAnimationPreview(preview);
        if (progress < 1) {
          dropAnimationFrame = window.requestAnimationFrame(step);
        } else {
          dropAnimationFrame = null;
          useEditorStore.getState().commitDrag();
        }
      };

      dropAnimationFrame = window.requestAnimationFrame(step);
    };

    const updateFromPointer = (event: PointerEvent) => {
      const state = useEditorStore.getState();
      const activeDrag = state.drag;
      if (!activeDrag || activeDrag.phase !== 'dragging') return;
      if (activeDrag.pointerId !== null && event.pointerId !== activeDrag.pointerId) return;
      event.preventDefault();

      const pointerTravel = activeDrag.pointerStart
        ? Math.hypot(
            event.clientX - activeDrag.pointerStart[0],
            event.clientY - activeDrag.pointerStart[1],
          )
        : Number.POSITIVE_INFINITY;
      if (activeDrag.source === 'brick' && pointerTravel < 4) return;

      const bounds = canvas.getBoundingClientRect();
      const overScene = event.clientX >= bounds.left
        && event.clientX <= bounds.right
        && event.clientY >= bounds.top
        && event.clientY <= bounds.bottom;
      if (!overScene) {
        state.updateDragPreview(activeDrag.preview, null, false, pointerTravel >= 4, null);
        return;
      }

      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const dragPlane = new Plane(new Vector3(0, 1, 0), -activeDrag.planeY);
      if (!raycaster.ray.intersectPlane(dragPlane, intersection)) return;

      const dropProbe: BrickInstance = {
        ...activeDrag.preview,
        position: [
          intersection.x + activeDrag.grabOffset[0],
          DROP_PROBE_Y,
          intersection.z + activeDrag.grabOffset[2],
        ],
        rotation: [...activeDrag.freeRotation],
      };
      const drop = computeDropPlacement(dropProbe, state.bricks);
      const landedPreview: BrickInstance = {
        ...dropProbe,
        position: [...drop.position],
        rotation: [...drop.rotation],
      };
      const heldPreview: BrickInstance = {
        ...landedPreview,
        position: [
          landedPreview.position[0],
          Math.max(activeDrag.planeY + HOLD_LIFT, landedPreview.position[1] + HOLD_LIFT),
          landedPreview.position[2],
        ],
      };
      const definition = getBrickDefinition(landedPreview.definitionId);
      if (!definition) return;
      const targets = collectTargetConnectors(activeDrag.brickId);
      const occupied = occupiedConnectorKeys(activeDrag.brickId);
      const nearestCandidate = findBestSnap({
        dragged: landedPreview,
        draggedDefinition: definition,
        targets,
        occupiedConnectorKeys: occupied,
        preserveDraggedRotation: true,
        distanceResolver: (source, target) => {
          const sourceScreen = new Vector3(...source.position).project(camera);
          const targetScreen = new Vector3(...target.position).project(camera);
          const pixels = Math.hypot(
            (sourceScreen.x - targetScreen.x) * bounds.width * 0.5,
            (sourceScreen.y - targetScreen.y) * bounds.height * 0.5,
          );
          if (!(camera instanceof PerspectiveCamera)) return pixels * 0.14;
          const depth = camera.position.distanceTo(new Vector3(...target.position));
          const visibleHeight = 2 * Math.tan(MathUtils.degToRad(camera.fov) / 2) * depth;
          return pixels * (visibleHeight / bounds.height);
        },
        transformValidator: (transform, target, source) => {
          const transformed: BrickInstance = {
            ...landedPreview,
            position: [...transform.position],
            rotation: [...transform.rotation],
          };
          // Axis-aligned connectors must pass the full body-overlap check.
          // Sloped connector pairs are trusted at their exact mating surface,
          // because their axis-aligned bounds overlap even when the solids do not.
          const slopedContact = !isAxisAligned(source.normal) || !isAxisAligned(target.normal);
          const ignoredTargets = slopedContact
            ? new Set([target.brickId])
            : new Set<string>();
          return isBrickOnGrid(transformed)
            && !hasBrickCollision(transformed, state.bricks, ignoredTargets);
        },
      });
      const snappedPreview = nearestCandidate?.committable
        ? {
            ...landedPreview,
            position: nearestCandidate.transform.position,
            rotation: nearestCandidate.transform.rotation,
          }
        : null;
      // A connector below the print bed is never a valid target. Rejecting the
      // candidate preserves the connection geometry instead of lifting it and
      // silently breaking the snap.
      const candidate = snappedPreview && (
        !isBrickAboveBed(snappedPreview) || !isBrickOnGrid(snappedPreview)
      )
        ? null
        : nearestCandidate;
      const displayedPreview: BrickInstance = candidate?.committable
        ? { ...landedPreview, position: candidate.transform.position, rotation: candidate.transform.rotation }
        : heldPreview;
      state.updateDragPreview(
        displayedPreview,
        candidate,
        true,
        pointerTravel >= 4,
        candidate?.committable ? null : drop,
      );
    };

    const finishDrag = (event: PointerEvent) => {
      const beforeUpdate = useEditorStore.getState().drag;
      if (!beforeUpdate) return;
      if (beforeUpdate.phase !== 'dragging') return;
      if (beforeUpdate.pointerId !== null && event.pointerId !== beforeUpdate.pointerId) return;
      const endTravel = beforeUpdate.pointerStart
        ? Math.hypot(
            event.clientX - beforeUpdate.pointerStart[0],
            event.clientY - beforeUpdate.pointerStart[1],
          )
        : Number.POSITIVE_INFINITY;
      if (beforeUpdate.source === 'brick' && endTravel < 4) {
        useEditorStore.getState().cancelDrag();
        return;
      }
      const state = useEditorStore.getState();
      const completedDrag = state.drag;
      if (!completedDrag) return;
      if (!completedDrag.overScene) {
        state.cancelDrag();
      } else {
        const snapped = Boolean(completedDrag.candidate?.committable);
        if (snapped) {
          state.commitDrag();
          playSnapFeedback();
          state.setToast('咔哒！积木卡住了');
        } else if (completedDrag.drop) {
          animateGravityDrop(completedDrag);
        } else {
          state.commitDrag();
        }
      }
    };

    const cancelDrag = (event: Event) => {
      const activeDrag = useEditorStore.getState().drag;
      if (!activeDrag) return;
      if (
        event instanceof PointerEvent
        && activeDrag.pointerId !== null
        && event.pointerId !== activeDrag.pointerId
      ) return;
      if (dropAnimationFrame !== null) {
        window.cancelAnimationFrame(dropAnimationFrame);
        dropAnimationFrame = null;
      }
      if (activeDrag.phase === 'dropping') useEditorStore.getState().commitDrag();
      else useEditorStore.getState().cancelDrag();
    };

    window.addEventListener('pointermove', updateFromPointer, { passive: false });
    window.addEventListener('pointerup', finishDrag);
    window.addEventListener('pointercancel', cancelDrag);
    window.addEventListener('blur', cancelDrag);
    return () => {
      if (dropAnimationFrame !== null) window.cancelAnimationFrame(dropAnimationFrame);
      const activeDrag = useEditorStore.getState().drag;
      if (activeDrag?.phase === 'dropping') useEditorStore.getState().commitDrag();
      window.removeEventListener('pointermove', updateFromPointer);
      window.removeEventListener('pointerup', finishDrag);
      window.removeEventListener('pointercancel', cancelDrag);
      window.removeEventListener('blur', cancelDrag);
    };
  }, [camera, gl]);

  useEffect(() => {
    gl.domElement.style.cursor = drag ? 'grabbing' : 'grab';
    return () => {
      gl.domElement.style.cursor = '';
    };
  }, [drag, gl]);

  if (!drag?.overScene) return null;
  return <SnapHints candidate={drag.candidate} />;
}
