import { Type } from 'lucide-react';
import { tr, useLocale } from '../../i18n/locale';
import { useEditorStore } from '../../store/editorStore';
import { useTextToolStore } from '../../store/textToolStore';

/** Creation belongs in the palette; editing and placement remain on the canvas. */
export function TextPaletteSection() {
  const locale = useLocale();
  const hasBricks = useEditorStore((state) => state.bricks.length > 0);
  const placingBricks = useEditorStore((state) => Boolean(state.drag || state.groupCopy || state.groupMove));
  const usingText = useTextToolStore((state) => Boolean(state.draft || state.form));
  const openForm = useTextToolStore((state) => state.openForm);
  const hint = hasBricks
    ? tr(locale, '输入文字，再贴到积木的平面上', 'Enter text, then place it on a flat brick face')
    : tr(locale, '先放一块积木，再贴文字', 'Add a brick first, then attach text');

  return <section className="palette-category" aria-label={tr(locale, '文字', 'Text')}>
    <h2>{tr(locale, '文字', 'Text')}</h2>
    <div className="palette-grid">
      <button type="button" className="palette-card palette-text-card"
        disabled={!hasBricks || placingBricks || usingText}
        title={hint} aria-describedby="text-palette-hint" onClick={() => openForm()}>
        <span className="brick-glyph" aria-hidden="true"><Type size={36} /></span>
        <span className="palette-card-name">{tr(locale, '添加文字', 'Add text')}</span>
      </button>
    </div>
    <small id="text-palette-hint" className="palette-text-hint">{hint}</small>
  </section>;
}
