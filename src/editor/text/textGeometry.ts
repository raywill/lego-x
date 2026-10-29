import type { Font } from 'opentype.js';
import { ExtrudeGeometry, Mesh, MeshStandardMaterial, ShapePath } from 'three';
import type { TextDecoration } from '../../types/model';
import { createGlyphPath, textFontLoader } from './textFonts';

export const TEXT_EMBED_MM = 0.2;
export const TEXT_RELIEF_MM = 1.2;
let loadedFont: Font | undefined;
const geometryCache = new Map<string, ExtrudeGeometry>();

export function setTextFont(font: Font): void {
  geometryCache.forEach((geometry) => geometry.dispose());
  geometryCache.clear();
  loadedFont = font;
}

export function loadTextFont(content: string): Promise<void> {
  return loadedFont ? Promise.resolve() : textFontLoader.load(content);
}

/** The same solid glyphs are used in the editor, thumbnails, and STL. */
export function createTextGeometry(content: string, size: number): ExtrudeGeometry {
  const key = `${size}:${content}`;
  const cached = geometryCache.get(key);
  if (cached) return cached.clone();
  const geometry = buildTextGeometry(content, size);
  if (geometryCache.size >= 32) {
    const oldest = geometryCache.keys().next().value!;
    geometryCache.get(oldest)!.dispose(); geometryCache.delete(oldest);
  }
  geometryCache.set(key, geometry);
  return geometry.clone();
}

function buildTextGeometry(content: string, size: number): ExtrudeGeometry {
  const path = createGlyphPath(content, size, (character) => loadedFont ?? textFontLoader.fontFor(character));
  const shape = new ShapePath();
  for (const command of path.commands) {
    switch (command.type) {
      case 'M': shape.moveTo(command.x, -command.y); break;
      case 'L': shape.lineTo(command.x, -command.y); break;
      case 'Q': shape.quadraticCurveTo(command.x1, -command.y1, command.x, -command.y); break;
      case 'C': shape.bezierCurveTo(command.x1, -command.y1, command.x2, -command.y2, command.x, -command.y); break;
      case 'Z': shape.currentPath?.closePath(); break;
    }
  }
  const geometry = new ExtrudeGeometry(shape.toShapes(), {
    depth: TEXT_EMBED_MM + TEXT_RELIEF_MM, bevelEnabled: false, curveSegments: 5,
  });
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox!;
  if (bounds.isEmpty()) { geometry.dispose(); throw new Error('请输入可见文字'); }
  geometry.translate(-(bounds.min.x + bounds.max.x) / 2, -(bounds.min.y + bounds.max.y) / 2, -TEXT_EMBED_MM);
  const factor = size / (bounds.max.y - bounds.min.y);
  geometry.scale(factor, factor, 1);
  geometry.computeBoundingBox();
  return geometry;
}

export function createTextMesh(text: TextDecoration, opacity = 1): Mesh {
  const mesh = new Mesh(createTextGeometry(text.content, text.size), new MeshStandardMaterial({
    color: text.color, roughness: 0.7, transparent: opacity < 1, opacity,
  }));
  mesh.position.set(...text.position);
  mesh.rotation.set(...text.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
