import type { TextDecoration } from '../src/types/model';

export function validateTexts(value: unknown, hostIds: ReadonlySet<string>): TextDecoration[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error('文字数据不正确，最多 100 条');
  const ids = new Set<string>();
  return value.map((raw): TextDecoration => {
    if (!raw || typeof raw !== 'object') throw new Error('文字数据不正确');
    const text = raw as TextDecoration;
    if (typeof text.id !== 'string' || !text.id || ids.has(text.id)
      || !hostIds.has(text.hostBrickId)
      || typeof text.content !== 'string' || !text.content.trim()
      || [...text.content].length > 20 || /[\p{C}\p{Zl}\p{Zp}]/u.test(text.content)
      || ![4, 6, 8].includes(text.size)
      || typeof text.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(text.color)
      || ![text.position, text.rotation].every((tuple) => Array.isArray(tuple) && tuple.length === 3
        && tuple.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 1e6))) {
      throw new Error('文字内容、尺寸、颜色或贴合位置不正确');
    }
    ids.add(text.id);
    return { ...text, position: [...text.position], rotation: [...text.rotation] };
  });
}
