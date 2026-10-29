import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { loadTextFont, createTextGeometry } from '../../editor/text/textGeometry';
import { textFitsSurface } from '../../editor/text/textPlacement';
import { useEditorStore } from '../../store/editorStore';
import { useTextToolStore } from '../../store/textToolStore';
import { tr, useLocale } from '../../i18n/locale';

export function TextTools() {
  const locale = useLocale();
  const form = useTextToolStore((state) => state.form);
  const setForm = useTextToolStore((state) => state.setForm);
  const open = useTextToolStore((state) => state.openForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const selectedId = useTextToolStore((state) => state.selectedId);
  const draft = useTextToolStore((state) => state.draft);
  const texts = useEditorStore((state) => state.texts);
  const selected = texts.find((text) => text.id === selectedId);
  const bricks = useEditorStore((state) => state.bricks);
  useEffect(() => { setError(''); }, [form?.id]);
  // Start loading while the child types; errors are shown only on explicit submit.
  useEffect(() => {
    if (!form?.content.trim()) return;
    const timer = window.setTimeout(() => { void loadTextFont(form.content).catch(() => {}); }, 250);
    return () => window.clearTimeout(timer);
  }, [form?.content]);
  const submit = async (reposition: boolean) => {
    if (!form || busy) return;
    setBusy(true); setError('');
    try {
      if (!form.content.trim() || [...form.content].length > 20 || /[\p{C}\p{Zl}\p{Zp}]/u.test(form.content)) throw new Error('请输入 1–20 个单行字符');
      if (texts.length >= 100 && !texts.some((text) => text.id === form.id)) throw new Error('每个作品最多 100 条文字');
      await loadTextFont(form.content);
      if (useTextToolStore.getState().form !== form) return; // Cancelled or edited while loading.
      createTextGeometry(form.content, form.size).dispose();
      const host = bricks.find((brick) => brick.id === form.hostBrickId);
      if (!reposition && host) {
        if (!textFitsSurface(form, host)) throw new Error('修改后的文字放不下，请选择小号或重新贴');
        useEditorStore.getState().putText(form);
      } else {
        useEditorStore.getState().selectBrick(null);
        useTextToolStore.getState().begin(form);
      }
      setForm(null);
    } catch (err) { if (useTextToolStore.getState().form === form) setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  return <>
    {draft && <div className="text-placement-hint">{tr(locale, '把文字贴到积木的平面上 · 松手确认 · Esc 取消', 'Place text on a flat brick face · Release to confirm · Esc to cancel')}<button onClick={() => useTextToolStore.getState().cancel()} aria-label="取消"><X size={16} /></button></div>}
    {selected && !draft && !form && <div className="selection-toolbar text-selection-toolbar" role="toolbar">
      <strong>{selected.content}</strong>
      <button onClick={() => open(selected)}>{tr(locale, '编辑文字', 'Edit text')}</button>
      <button onClick={() => useTextToolStore.getState().begin(structuredClone(selected))}>{tr(locale, '重新贴', 'Reposition')}</button>
      <button onClick={() => { useEditorStore.getState().deleteText(selected.id); useTextToolStore.getState().select(null); }}>{tr(locale, '删除', 'Delete')}</button>
      <button onClick={() => useTextToolStore.getState().select(null)} aria-label="关闭"><X size={16} /></button>
    </div>}
    {form && <div className="text-dialog-backdrop"><form className="text-dialog" role="dialog" aria-modal="true" aria-labelledby="text-dialog-title" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setForm(null); } }} onSubmit={(event) => { event.preventDefault(); void submit(false); }}>
      <h2 id="text-dialog-title">{tr(locale, '给积木贴上文字', 'Add text to a brick')}</h2>
      <label>{tr(locale, '文字内容', 'Text')}<input autoFocus value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder={tr(locale, '例如：我的小屋', 'e.g. My house')} /></label>
      <span>{tr(locale, '单行，最多 20 个字符 · 凸起 1.2 mm', 'One line, up to 20 characters · 1.2 mm raised')}</span>
      <div className="text-size-options">{([4, 6, 8] as const).map((size, index) => <button key={size} type="button" className={form.size === size ? 'active' : ''} onClick={() => setForm({ ...form, size })}>{tr(locale, ['小', '中', '大'][index], ['Small', 'Medium', 'Large'][index])}</button>)}<input type="color" aria-label="文字颜色" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} /></div>
      {error && <p role="alert">{error}</p>}
      <div className="text-dialog-actions"><button type="button" onClick={() => setForm(null)}>{tr(locale, '取消', 'Cancel')}</button>{form.hostBrickId && <button disabled={busy} type="button" onClick={() => void submit(true)}>{tr(locale, '重新贴', 'Reposition')}</button>}<button className="primary" disabled={busy} type="submit">{busy ? tr(locale, '正在生成立体文字…', 'Generating 3D text…') : form.hostBrickId ? tr(locale, '保存', 'Save') : tr(locale, '开始贴', 'Place text')}</button></div>
    </form></div>}
  </>;
}
