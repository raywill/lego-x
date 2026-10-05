import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { getBrickDefinition } from '../bricks/catalog';
import { createBrickGroup } from '../bricks/geometry';
import type { BrickInstance } from '../types/model';

const WIDTH = 640;
const HEIGHT = 480;

function disposeObject(object: Group) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => material.dispose());
  });
}

function colorfulFallback(bricks: BrickInstance[]) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return canvas.toDataURL('image/webp');
  context.fillStyle = '#edf3ff';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = '#cfd8ed';
  context.fillRect(74, 365, 492, 18);
  bricks.slice(0, 14).forEach((brick, index) => {
    const definition = getBrickDefinition(brick.definitionId);
    context.fillStyle = brick.color ?? definition?.color ?? '#6c5ce7';
    context.fillRect(118 + (index % 5) * 83, 318 - Math.floor(index / 5) * 54, 74, 48);
  });
  return canvas.toDataURL('image/webp', 0.84);
}

/** Renders an independent, colorful preview instead of reading the interactive WebGL canvas. */
export function captureProjectThumbnail(bricks: BrickInstance[]): string {
  if (!bricks.length) return colorfulFallback(bricks);
  const canvas = document.createElement('canvas');
  let renderer: WebGLRenderer | null = null;
  const assembly = new Group();
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.outputColorSpace = 'srgb';
    renderer.shadowMap.enabled = true;
    const scene = new Scene();
    scene.background = new Color('#edf3ff');
    scene.add(new AmbientLight('#ffffff', 1.65));
    const key = new DirectionalLight('#fff8e8', 2.6);
    key.position.set(90, 140, 110);
    key.castShadow = true;
    scene.add(key);
    const fill = new DirectionalLight('#c5d8ff', 1.05);
    fill.position.set(-90, 70, -80);
    scene.add(fill);
    bricks.forEach((brick) => {
      const definition = getBrickDefinition(brick.definitionId);
      if (!definition) return;
      const object = createBrickGroup(definition, { color: brick.color ?? definition.color, roughness: 0.52, metalness: 0.03 });
      object.position.set(...brick.position);
      object.rotation.set(...brick.rotation);
      object.traverse((child) => { if (child instanceof Mesh) { child.castShadow = true; child.receiveShadow = true; } });
      assembly.add(object);
    });
    if (!assembly.children.length) return colorfulFallback(bricks);
    assembly.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(assembly);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    assembly.position.set(-center.x, -bounds.min.y, -center.z);
    scene.add(assembly);
    const span = Math.max(size.x, size.y, size.z, 22);
    const camera = new OrthographicCamera(-span, span, span * 0.76, -span * 0.76, 0.1, 1000);
    camera.position.set(span * 1.45, span * 1.2, span * 1.55);
    camera.lookAt(0, Math.max(size.y * 0.3, 3), 0);
    camera.zoom = 1.2;
    camera.updateProjectionMatrix();
    const floor = new Mesh(new PlaneGeometry(span * 3, span * 3), new ShadowMaterial({ color: '#7080a5', opacity: 0.18 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    renderer.render(scene, camera);
    return canvas.toDataURL('image/webp', 0.86);
  } catch {
    return colorfulFallback(bricks);
  } finally {
    disposeObject(assembly);
    renderer?.dispose();
  }
}
