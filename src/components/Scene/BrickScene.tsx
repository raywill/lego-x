import { ContactShadows } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useCallback } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useEditorStore } from '../../store/editorStore';
import type { BrickInstance } from '../../types/model';
import { BrickObject } from './BrickObject';
import { CameraRig, type CameraView } from './CameraRig';
import { DragInteraction } from './DragInteraction';
import { GravityDropPreview } from './GravityDropPreview';
import { PrintBed } from './PrintBed';
import { SmartDropCamera } from './SmartDropCamera';

function SceneContents({ view, resetKey }: { view: CameraView; resetKey: number }) {
  const bricks = useEditorStore((state) => state.bricks);
  const selectedId = useEditorStore((state) => state.selectedId);
  const drag = useEditorStore((state) => state.drag);
  const selectBrick = useEditorStore((state) => state.selectBrick);
  const startBrickDrag = useEditorStore((state) => state.startBrickDrag);

  const startDrag = useCallback((event: ThreeEvent<PointerEvent>, brick: BrickInstance) => {
    if (event.button !== 0) return;
    if (useEditorStore.getState().drag) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    selectBrick(brick.id);
    startBrickDrag(
      brick.id,
      [event.clientX, event.clientY],
      event.pointerId,
      [
        brick.position[0] - event.point.x,
        0,
        brick.position[2] - event.point.z,
      ],
    );
  }, [selectBrick, startBrickDrag]);

  const hiddenBrickId = drag?.source === 'brick' ? drag.brickId : null;
  const isSnapping = Boolean(drag?.candidate?.committable);
  const landed = drag?.drop
    ? {
        ...drag.preview,
        position: [...drag.drop.position] as BrickInstance['position'],
        rotation: [...drag.drop.rotation] as BrickInstance['rotation'],
      }
    : null;

  return (
    <>
      <color attach="background" args={['#f4f7fd']} />
      <fog attach="fog" args={['#f4f7fd', 260, 440]} />
      <ambientLight intensity={1.45} />
      <hemisphereLight args={['#f9fbff', '#aeb8cc', 1.25]} />
      <directionalLight
        castShadow
        position={[95, 145, 85]}
        intensity={2.15}
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
        shadow-camera-left={-150}
        shadow-camera-right={150}
        shadow-camera-top={130}
        shadow-camera-bottom={-130}
      />
      <PrintBed />
      {bricks.map((brick) => brick.id === hiddenBrickId ? null : (
        <BrickObject
          brick={brick}
          selected={brick.id === selectedId}
          onPointerDown={startDrag}
          key={brick.id}
        />
      ))}
      {drag?.overScene && landed ? (
        <GravityDropPreview
          held={drag.preview}
          landed={landed}
          contactFootprint={{ ...drag.drop!.contact, y: drag.drop!.supportY }}
          isSnapping={isSnapping}
        />
      ) : drag?.overScene ? (
        <BrickObject brick={drag.preview} opacity={0.68} selected ghost />
      ) : null}
      <DragInteraction />
      <ContactShadows position={[0, 0.08, 0]} opacity={0.2} scale={235} blur={2.3} far={130} />
      <CameraRig view={view} resetKey={resetKey} dragging={Boolean(drag)} />
      <SmartDropCamera
        active={Boolean(drag?.overScene && drag.drop)}
        heldPosition={drag?.overScene ? drag.preview.position : null}
        landedPosition={drag?.drop?.position ?? null}
        contactNormal={[0, 1, 0]}
        interactionSignal={drag?.brickId}
        resetSignal={resetKey}
      />
    </>
  );
}

export function BrickScene({ view, resetKey }: { view: CameraView; resetKey: number }) {
  const selectBrick = useEditorStore((state) => state.selectBrick);
  return (
    <Canvas
      shadows="basic"
      dpr={[1, 1.75]}
      camera={{ position: [118, 92, 132], fov: 41, near: 0.1, far: 700 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      onPointerMissed={() => selectBrick(null)}
    >
      <SceneContents view={view} resetKey={resetKey} />
    </Canvas>
  );
}
