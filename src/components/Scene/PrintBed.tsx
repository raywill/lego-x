import { Grid, Line, RoundedBox } from '@react-three/drei';
import { PRINT_BED } from '../../config/brickConfig';

export function PrintBed() {
  const halfWidth = PRINT_BED.width / 2;
  const halfDepth = PRINT_BED.depth / 2;
  const border: [number, number, number][] = [
    [-halfWidth, 0.16, -halfDepth],
    [halfWidth, 0.16, -halfDepth],
    [halfWidth, 0.16, halfDepth],
    [-halfWidth, 0.16, halfDepth],
    [-halfWidth, 0.16, -halfDepth],
  ];

  return (
    <group>
      <RoundedBox args={[PRINT_BED.width + 6, 2.6, PRINT_BED.depth + 6]} radius={3} smoothness={3} position={[0, -1.45, 0]} receiveShadow>
        <meshStandardMaterial color="#cfd7e6" roughness={0.92} />
      </RoundedBox>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <planeGeometry args={[PRINT_BED.width, PRINT_BED.depth]} />
        <meshStandardMaterial color="#eef2f8" roughness={0.95} />
      </mesh>
      <Grid
        args={[PRINT_BED.width, PRINT_BED.depth]}
        position={[0, 0.035, 0]}
        cellColor="#c4ccda"
        sectionColor="#98a5ba"
        cellSize={10}
        sectionSize={50}
        fadeDistance={360}
        fadeStrength={0}
        infiniteGrid={false}
      />
      <Line points={border} color="#6757e8" lineWidth={2.1} />
      <mesh position={[-halfWidth - 3, 0, -halfDepth - 3]}>
        <sphereGeometry args={[2.1, 14, 14]} />
        <meshStandardMaterial color="#ffcd3c" />
      </mesh>
    </group>
  );
}
