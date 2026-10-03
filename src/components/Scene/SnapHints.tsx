import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import type { SnapCandidate, WorldConnector } from '../../editor/snapping/snapEngine';

function ConnectorMarker({ connector }: { connector: WorldConnector }) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const scale = 1 + Math.sin(clock.elapsedTime * 7) * 0.13;
    ref.current.scale.setScalar(scale);
  });

  const hollow = connector.connector.type === 'socket' || connector.connector.type === 'hole';
  const sideMagnet = connector.connector.type === 'magnet';
  return (
    <group ref={ref} position={connector.position} quaternion={connector.quaternion}>
      {sideMagnet ? (
        <mesh>
          <boxGeometry args={[4.8, 0.9, 4.8]} />
          <meshBasicMaterial color="#4f7cff" transparent opacity={0.98} depthTest={false} />
        </mesh>
      ) : hollow ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.5, 0.72, 12, 28]} />
          <meshBasicMaterial color="#4f7cff" transparent opacity={0.98} depthTest={false} />
        </mesh>
      ) : (
        <mesh>
          <sphereGeometry args={[2.15, 16, 16]} />
          <meshBasicMaterial color="#4f7cff" transparent opacity={0.98} depthTest={false} />
        </mesh>
      )}
    </group>
  );
}

export function SnapHints({
  candidate,
}: {
  candidate: SnapCandidate | null;
}) {
  const displayedConnectors = new Map<string, WorldConnector>();
  candidate?.contacts.forEach(({ target }) => {
    displayedConnectors.set(`${target.brickId}:${target.connectorId}`, target);
  });
  return (
    <group renderOrder={20}>
      {[...displayedConnectors].map(([key, connector]) => (
        <ConnectorMarker connector={connector} key={key} />
      ))}
    </group>
  );
}
