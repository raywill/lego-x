import { useEffect, useMemo } from 'react';
import { CanvasTexture, DoubleSide, LinearFilter, SRGBColorSpace } from 'three';
import { PLACEMENT_GRID, PRINT_BED } from '../../config/brickConfig';

function createBedTexture(): CanvasTexture {
  const pixelsPerMillimeter = 2;
  const canvas = document.createElement('canvas');
  canvas.width = PRINT_BED.width * pixelsPerMillimeter;
  canvas.height = PRINT_BED.depth * pixelsPerMillimeter;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to draw print bed guides.');

  context.fillStyle = '#eef2f8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const step = PLACEMENT_GRID * pixelsPerMillimeter;
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width: number) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.strokeStyle = color;
    context.lineWidth = width;
    context.stroke();
  };

  for (let x = 0, index = 0; x <= canvas.width; x += step, index += 1) {
    const landmark = index % 10 === 0;
    const wholeBrick = index % 2 === 0;
    line(
      x,
      0,
      x,
      canvas.height,
      landmark ? '#8b98ad' : wholeBrick ? '#bdc6d3' : '#d8dee8',
      landmark ? 3 : wholeBrick ? 1.5 : 0.8,
    );
  }
  for (let y = 0, index = 0; y <= canvas.height; y += step, index += 1) {
    const landmark = index % 10 === 0;
    const wholeBrick = index % 2 === 0;
    line(
      0,
      y,
      canvas.width,
      y,
      landmark ? '#8b98ad' : wholeBrick ? '#bdc6d3' : '#d8dee8',
      landmark ? 3 : wholeBrick ? 1.5 : 0.8,
    );
  }

  line(0, canvas.height / 2, canvas.width, canvas.height / 2, '#6859d2', 6);
  line(canvas.width / 2, 0, canvas.width / 2, canvas.height, '#e0a13e', 6);
  context.beginPath();
  context.arc(canvas.width / 2, canvas.height / 2, 8, 0, Math.PI * 2);
  context.strokeStyle = '#4c426f';
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = '#6757e8';
  context.lineWidth = 5;
  context.strokeRect(2.5, 2.5, canvas.width - 5, canvas.height - 5);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function PrintBed() {
  const halfWidth = PRINT_BED.width / 2;
  const halfDepth = PRINT_BED.depth / 2;
  const bedTexture = useMemo(createBedTexture, []);
  useEffect(() => () => bedTexture.dispose(), [bedTexture]);

  return (
    <group>
      <mesh position={[0, -1.45, 0]} receiveShadow>
        <boxGeometry args={[PRINT_BED.width + 6, 2.6, PRINT_BED.depth + 6]} />
        <meshStandardMaterial color="#cfd7e6" roughness={0.92} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[PRINT_BED.width, PRINT_BED.depth]} />
        <meshStandardMaterial map={bedTexture} roughness={0.95} side={DoubleSide} />
      </mesh>
      <mesh position={[-halfWidth - 3, 0, -halfDepth - 3]}>
        <sphereGeometry args={[2.1, 14, 14]} />
        <meshStandardMaterial color="#ffcd3c" />
      </mesh>
    </group>
  );
}
