import { parse, Path, type Font } from 'opentype.js';

const FONT_ROOT = '/fonts/text-600-v1/';
interface FontManifest { version: number; weight: number; pages: Record<string, string> }
const pageOf = (character: string) => (character.codePointAt(0)! >> 8).toString(16);

/** Page-level caching deduplicates concurrent labels, previews and STL exports. */
export function createTextFontLoader(fetcher: typeof fetch = (...args) => fetch(...args)) {
  let manifestPromise: Promise<FontManifest> | undefined;
  const fonts = new Map<string, Font>();
  const pending = new Map<string, Promise<void>>();
  const manifest = () => {
    if (!manifestPromise) manifestPromise = fetcher(`${FONT_ROOT}manifest.json`)
      .then(async (response) => {
        if (!response.ok) throw new Error('文字资源加载失败，请重试');
        return response.json() as Promise<FontManifest>;
      }).catch((error) => { manifestPromise = undefined; throw error; });
    return manifestPromise;
  };
  const fontFor = (character: string) => {
    const font = fonts.get(pageOf(character));
    if (!font) throw new Error('文字资源尚未加载');
    if (character !== ' ' && !font.charToGlyphIndex(character)) throw new Error(`字体不支持字符：${character}`);
    return font;
  };
  return {
    fontFor,
    async load(content: string): Promise<void> {
      if (!content) return;
      const catalog = await manifest();
      const characters = [...content];
      // Reject unavailable ranges before starting any font downloads.
      for (const character of characters) {
        if (!catalog.pages[pageOf(character)]) throw new Error(`字体不支持字符：${character}`);
      }
      await Promise.all([...new Set(characters.map(pageOf))].map((page) => {
        if (fonts.has(page)) return Promise.resolve();
        if (!pending.has(page)) pending.set(page, fetcher(`${FONT_ROOT}${catalog.pages[page]}`)
          .then(async (response) => {
            if (!response.ok) throw new Error('文字资源加载失败，请重试');
            const font = parse(await response.arrayBuffer());
            fonts.set(page, font);
          }).finally(() => { pending.delete(page); }));
        return pending.get(page)!;
      }));
      characters.forEach(fontFor); // Unsupported characters must never become blank glyphs.
    },
  };
}

/** Keep kerning within each font run; every subset has identical font metrics. */
export function createGlyphPath(content: string, size: number, fontFor: (character: string) => Font): Path {
  const path = new Path();
  const options = { kerning: true, variation: { wght: 600 } };
  const runs: Array<{ font: Font; content: string }> = [];
  for (const character of content) {
    const font = fontFor(character);
    if (character !== ' ' && !font.charToGlyphIndex(character)) throw new Error(`字体不支持字符：${character}`);
    const last = runs.at(-1);
    if (last?.font === font) last.content += character;
    else runs.push({ font, content: character });
  }
  let x = 0;
  for (const run of runs) {
    path.commands.push(...run.font.getPath(run.content, x, 0, size, options).commands);
    x += run.font.getAdvanceWidth(run.content, size, options);
  }
  return path;
}

export const textFontLoader = createTextFontLoader();
