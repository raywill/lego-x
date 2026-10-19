/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'opentype.js';
import { Box3, Euler, Group, Vector3 } from 'three';
import type { BrickInstance, TextDecoration } from '../../types/model';
import { createTextGeometry, setTextFont } from './textGeometry';
import { textFitsSurface, textRotationForNormal } from './textPlacement';
import { deserializeProject, serializeProject } from '../projectModel';
import { validatePublishedProject } from '../../../shared/community';
import { validateTexts } from '../../../shared/texts';
import { buildBinaryStl } from '../../export/stl';
import { addTextsToAssembly } from './textAssembly';
import { useEditorStore } from '../../store/editorStore';
import { bricksOverlap } from '../collision/collisionEngine';

const host: BrickInstance = { id: 'base', definitionId: 'cube-1', position: [5, 5, 5], rotation: [0, 0, 0] };
const label: TextDecoration = { id: 'label', hostBrickId: 'base', content: 'A', size: 4, color: '#343746', position: [0, 5, 0], rotation: [-Math.PI / 2, 0, 0] };

beforeAll(() => {
  const bytes = readFileSync(new URL('../../../public/fonts/NotoSansSC.ttf', import.meta.url));
  setTextFont(parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)));
});

function stlVolume(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  let sum = 0;
  for (let triangle = 0; triangle < view.getUint32(80, true); triangle++) {
    const offset = 84 + triangle * 50 + 12;
    const point = (index: number) => new Vector3(...([0, 1, 2].map((axis) => view.getFloat32(offset + index * 12 + axis * 4, true)) as [number, number, number]));
    sum += point(0).dot(point(1).cross(point(2))) / 6;
  }
  return Math.abs(sum);
}

describe('raised text geometry and attachment', () => {
  it.each(['家', '中文', 'AB08', '你好！'])('creates real solid glyphs for %s at fixed relief depth', (content) => {
    const geometry = createTextGeometry(content, 6);
    const bounds = geometry.boundingBox!;
    expect(bounds.max.y - bounds.min.y).toBeCloseTo(6, 5);
    expect(bounds.min.z).toBeCloseTo(-0.2, 5);
    expect(bounds.max.z).toBeCloseTo(1.2, 5);
    expect(geometry.getAttribute('position').count).toBeGreaterThan(20);
    geometry.dispose();
  });

  it('rejects unsupported glyphs and invisible text', () => {
    expect(() => createTextGeometry('🦄', 6)).toThrow(/不支持/);
    expect(() => createTextGeometry('   ', 6)).toThrow();
  });

  it('accepts flat top and side faces but rejects edges, slopes, curved surfaces and holes', () => {
    expect(textFitsSurface(label, host)).toBe(true);
    expect(textFitsSurface({ ...label, position: [0, 0, 5], rotation: [0, 0, 0] }, host)).toBe(true);
    expect(textFitsSurface({ ...label, position: [5, 5, 0] }, host)).toBe(false);
    expect(textFitsSurface({ ...label, position: [0, 5, 0], rotation: [-Math.PI / 4, 0, 0] }, host)).toBe(false);
    expect(textFitsSurface({ ...label, position: [0, 10, 0] }, { ...host, definitionId: 'sphere' })).toBe(false);
    expect(textFitsSurface({ ...label, position: [0, 0, 5], rotation: [0, 0, 0] }, { ...host, definitionId: 'frame-square' })).toBe(false);
  });

  it.each([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]])('orients glyphs outward for face %j', (x, y, z) => {
    const normal = new Vector3(x, y, z);
    const transformed = new Vector3(0, 0, 1).applyEuler(new Euler(...textRotationForNormal(normal)));
    expect(transformed.distanceTo(normal)).toBeLessThan(1e-6);
  });

  it('follows its host transform without altering brick collisions', () => {
    const shifted = { ...host, position: [25, 5, 5] as [number, number, number], rotation: [0, 0, Math.PI / 2] as [number, number, number] };
    const assembly = new Group();
    addTextsToAssembly(assembly, [shifted], [label]); assembly.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(assembly);
    expect(bounds.min.x).toBeCloseTo(18.8, 4);
    expect(bricksOverlap(host, { ...host, id: 'touching', position: [5, 15, 5] })).toBe(false);
  });

  it.each([1, 0.75, 0.5, 0.25])('exports raised text as a union and scales every dimension at %s', async (scale) => {
    const plain = await buildBinaryStl([host], scale);
    const decorated = await buildBinaryStl([host], scale, [], [label]);
    expect(stlVolume(decorated)).toBeGreaterThan(stlVolume(plain));
    const ratio = stlVolume(decorated) / (scale ** 3);
    expect(ratio).toBeGreaterThan(1000);
    expect(ratio).toBeLessThan(1100);
  });

  it('removes covered glyphs from the STL boundary instead of retaining internal shells', async () => {
    const cover: BrickInstance = { ...host, id: 'cover', position: [5, 15, 5] };
    const buffer = await buildBinaryStl([host, cover], 1, [], [label]);
    expect(stlVolume(buffer)).toBeCloseTo(2000, 3);
    // Triangulation may split the outside faces; every triangle must still lie
    // on an outside face of the resulting rectangular solid, never inside it.
    const view = new DataView(buffer);
    for (let triangle = 0; triangle < view.getUint32(80, true); triangle++) {
      const onBoundary = ([0, 1, 2] as const).some((axis) => [0, axis === 1 ? 20 : 10].some((face) =>
        [0, 1, 2].every((vertex) => Math.abs(view.getFloat32(84 + triangle * 50 + 12 + vertex * 12 + axis * 4, true) - face) < 1e-5)));
      expect(onBoundary).toBe(true);
    }
  });

  it.each(['家', '中文', 'AB08', '你好！'])('unions %s into an actual printable solid', async (content) => {
    const wideHost = { ...host, definitionId: 'block-2x4', position: [20, 5, 10] as [number, number, number] };
    const plain = await buildBinaryStl([wideHost]);
    const decorated = await buildBinaryStl([wideHost], 1, [], [{ ...label, content }]);
    expect(stlVolume(decorated)).toBeGreaterThan(stlVolume(plain));
    expect(stlVolume(decorated)).toBeLessThan(stlVolume(plain) + 150);
  });
});

describe('text project lifecycle', () => {
  beforeEach(() => useEditorStore.setState({ bricks: [], connections: [], texts: [], past: [], future: [], selectedId: null, selectedIds: [], multiSelectMode: false, groupCopy: null, groupMove: null, drag: null }));

  it('preserves text in local and published v2 files and accepts legacy files', () => {
    const project = { bricks: [host], connections: [], texts: [label], catalogVersion: 2 };
    expect(deserializeProject(serializeProject(project)).texts).toEqual([label]);
    expect(validatePublishedProject({ ...project, version: 2 }).texts).toEqual([label]);
    expect(deserializeProject('{"version":1,"bricks":[],"connections":[]}').texts ?? []).toEqual([]);
  });

  it('validates host IDs, text limits, transforms, colors and sizes', () => {
    for (const invalid of [{ ...label, hostBrickId: 'missing' }, { ...label, content: 'a\nb' }, { ...label, content: 'x'.repeat(21) }, { ...label, size: 5 }, { ...label, color: 'red' }, { ...label, position: [NaN, 0, 0] }]) {
      expect(() => validateTexts([invalid], new Set(['base']))).toThrow();
    }
    expect(() => validateTexts(Array.from({ length: 101 }, (_, i) => ({ ...label, id: `label-${i}` })), new Set(['base']))).toThrow();
  });

  it('edits, deletes, and restores text through undo/redo', () => {
    useEditorStore.setState({ bricks: [host] });
    useEditorStore.getState().putText(label);
    useEditorStore.getState().putText({ ...label, content: '家' });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().texts[0].content).toBe('A');
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().texts[0].content).toBe('家');
    useEditorStore.getState().deleteText(label.id);
    expect(useEditorStore.getState().texts).toEqual([]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().texts).toHaveLength(1);
  });

  it('copies text with a brick and deletes it with its host, while undo restores it', () => {
    useEditorStore.setState({ bricks: [host], texts: [label], selectedId: host.id, selectedIds: [host.id] });
    const id = useEditorStore.getState().duplicateSelected();
    expect(useEditorStore.getState().texts).toHaveLength(2);
    expect(useEditorStore.getState().texts[1].hostBrickId).toBe(id);
    expect(useEditorStore.getState().texts[1].id).not.toBe(label.id);
    useEditorStore.getState().deleteSelected();
    expect(useEditorStore.getState().texts).toEqual([label]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().texts).toHaveLength(2);
  });

  it('copies a selected group with remapped text hosts and saves/opens all text', () => {
    useEditorStore.setState({ bricks: [host], texts: [label], selectedId: host.id, selectedIds: [host.id] });
    useEditorStore.getState().startGroupCopy();
    useEditorStore.getState().commitGroupPlacement();
    const state = useEditorStore.getState();
    expect(state.texts).toHaveLength(2);
    expect(state.bricks.some((brick) => brick.id === state.texts[1].hostBrickId)).toBe(true);
    const saved = serializeProject(state);
    state.clearProject();
    expect(useEditorStore.getState().texts).toEqual([]);
    state.importProject(saved);
    expect(useEditorStore.getState().texts).toHaveLength(2);
  });
});
