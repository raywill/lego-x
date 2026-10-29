/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'opentype.js';
import { createGlyphPath, createTextFontLoader } from './textFonts';
import { createTextGeometry, loadTextFont } from './textGeometry';
import { buildBinaryStl } from '../../export/stl';

const original = readFileSync(new URL('../../../public/fonts/NotoSansSC.ttf', import.meta.url));
const source = parse(original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength));
function assets() {
  let bytes = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const data = readFileSync(new URL(`../../../public${url}`, import.meta.url));
    bytes += data.byteLength;
    return new Response(new Uint8Array(data));
  });
  return { fetcher, bytes: () => bytes };
}
afterEach(() => vi.unstubAllGlobals());

describe('on-demand print font pages', () => {
  it('preserves every supported codepoint and uses content-addressed font URLs', () => {
    const root = new URL('../../../public/fonts/text-600-v1/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', root), 'utf8')) as { pages: Record<string, string> };
    const supported: number[] = [];
    for (const [page, filename] of Object.entries(manifest.pages)) {
      const data = readFileSync(new URL(filename, root));
      expect(filename).toBe(`${page}-${createHash('sha256').update(data).digest('hex').slice(0, 12)}.ttf`);
      const font = parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
      expect(font.unitsPerEm).toBe(source.unitsPerEm);
      expect(font.tables.fvar).toBeUndefined();
      supported.push(...Object.keys(font.tables.cmap.glyphIndexMap).map(Number));
    }
    expect(supported.sort((a, b) => a - b)).toEqual(Object.keys(source.tables.cmap.glyphIndexMap).map(Number).sort((a, b) => a - b));
  });

  it('does not request any assets for a project without text', async () => {
    const { fetcher } = assets();
    await createTextFontLoader(fetcher).load('');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('loads only the required pages, reuses them and deduplicates concurrent requests', async () => {
    const { fetcher, bytes } = assets();
    const loader = createTextFontLoader(fetcher);
    await Promise.all([loader.load('我的小屋A1'), loader.load('我的小屋B2')]);
    const urls = fetcher.mock.calls.map(([url]) => String(url));
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).not.toContain('/fonts/NotoSansSC.ttf');
    expect(urls.length).toBeLessThanOrEqual(6); // One manifest + up to five Unicode pages.
    expect(bytes()).toBeLessThan(original.byteLength * 0.05);
    const count = fetcher.mock.calls.length;
    await loader.load('我的小屋AB12');
    expect(fetcher).toHaveBeenCalledTimes(count);
  });

  it('keeps English and numbers under 100 KB on first use', async () => {
    const { fetcher, bytes } = assets();
    await createTextFontLoader(fetcher).load('My house 123!');
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(bytes()).toBeLessThan(100_000);
  });

  it('retries a failed manifest instead of permanently caching the error', async () => {
    const { fetcher } = assets();
    fetcher.mockImplementationOnce(async () => new Response(null, { status: 503 }));
    const loader = createTextFontLoader(fetcher);
    await expect(loader.load('家')).rejects.toThrow(/重试/);
    await loader.load('家');
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('manifest.json'))).toHaveLength(2);
  });

  it('retries a failed page and preserves successful pages', async () => {
    const { fetcher } = assets();
    const normalFetch = fetcher.getMockImplementation()!;
    let failed = false;
    fetcher.mockImplementation(async (url) => {
      if (!String(url).endsWith('.json') && !failed) { failed = true; return new Response(null, { status: 503 }); }
      return normalFetch(url);
    });
    const loader = createTextFontLoader(fetcher);
    await expect(loader.load('家')).rejects.toThrow(/重试/);
    await loader.load('家');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(loader.fontFor('家').charToGlyphIndex('家')).toBeGreaterThan(0);
  });

  it('rejects unsupported ranges and missing glyphs explicitly', async () => {
    const { fetcher } = assets();
    const loader = createTextFontLoader(fetcher);
    await expect(loader.load('🦄')).rejects.toThrow(/不支持字符/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(loader.load('\u0001')).rejects.toThrow(/不支持字符/);
  });

  it.each(['家', '中文', '我的小屋A1', 'AV08', '你好！'])('retains the 600-weight outlines and metrics for %s', async (content) => {
    const { fetcher } = assets();
    const loader = createTextFontLoader(fetcher);
    await loader.load(content);
    const options = { kerning: true, variation: { wght: 600 } };
    const oldPath = source.getPath(content, 0, 0, 6, options);
    const newPath = createGlyphPath(content, 6, loader.fontFor);
    const before = oldPath.getBoundingBox();
    const after = newPath.getBoundingBox();
    for (const key of ['x1', 'x2', 'y1', 'y2'] as const) expect(Math.abs(before[key] - after[key])).toBeLessThan(0.02);
    expect(newPath.commands.length).toBe(oldPath.commands.length);
    expect(loader.fontFor([...content][0]).tables.fvar).toBeUndefined();
  });

  it('uses the new pages for real mixed-language geometry and scaled STL export', async () => {
    const { fetcher } = assets();
    vi.stubGlobal('fetch', fetcher);
    await loadTextFont('家A1');
    const geometry = createTextGeometry('家A1', 6);
    expect(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y).toBeCloseTo(6);
    expect(geometry.boundingBox!.min.z).toBeCloseTo(-0.2);
    expect(geometry.boundingBox!.max.z).toBeCloseTo(1.2);
    geometry.dispose();
    const bricks = [{ id: 'host', definitionId: 'block-2x4', position: [20, 5, 10] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] }];
    const texts = [{ id: 'label', hostBrickId: 'host', content: '家A1', size: 6 as const, color: '#343746', position: [0, 5, 0] as [number, number, number], rotation: [-Math.PI / 2, 0, 0] as [number, number, number] }];
    for (const scale of [1, 0.75, 0.5, 0.25]) {
      const stl = await buildBinaryStl(bricks, scale, [], texts);
      const triangles = new DataView(stl).getUint32(80, true);
      expect(triangles).toBeGreaterThan(20);
      expect(stl.byteLength).toBe(84 + triangles * 50);
    }
  });
});
