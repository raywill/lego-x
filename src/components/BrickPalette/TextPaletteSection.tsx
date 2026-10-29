import { Type } from 'lucide-react';
import { createPortal } from 'react-dom';
import { tr, useLocale } from '../../i18n/locale';
import { useEditorStore } from '../../store/editorStore';
import { useTextToolStore } from '../../store/textToolStore';
import { useTextPaletteDrag } from './useTextPaletteDrag';

/** Creation belongs in the palette; editing and placement remain on the canvas. */
export function TextPaletteSection() {
  const locale = useLocale();
  const hasBricks = useEditorStore((state) => state.bricks.length > 0);
  const placingBricks = useEditorStore((state) => Boolean(state.drag || state.groupCopy || state.groupMove));
  const usingText = useTextToolStore((state) => Boolean(state.draft || state.form));
  const openForm = useTextToolStore((state) => state.openForm);
  const disabled = !hasBricks || placingBricks || usingText;
  const { ghost, onPointerDown, onClick } = useTextPaletteDrag(disabled, openForm);
  const hint = hasBricks
    ? tr(locale, '拖到搭建区或点击，输入文字', 'Drag to the build area or click to enter text')
    : tr(locale, '先放一块积木，再贴文字', 'Add a brick first, then attach text');

  return <section className="palette-category" aria-label={tr(locale, '文字', 'Text')}>
    <h2>{tr(locale, '文字', 'Text')}</h2>
    <div className="palette-grid">
      <button type="button" className="palette-card palette-text-card"
        disabled={disabled}
        title={hint} aria-describedby="text-palette-hint" onPointerDown={onPointerDown} onClick={onClick}>
        <span className="brick-glyph" aria-hidden="true"><Type size={36} /></span>
        <span className="palette-card-name">{tr(locale, '添加文字', 'Add text')}</span>
      </button>
    </div>
    <small id="text-palette-hint" className="palette-text-hint">{hint}</small>
    {ghost && createPortal(<div className={`text-palette-ghost ${ghost.overCanvas ? 'is-ready' : ''}`}
      style={{ left: ghost.x + 14, top: ghost.y + 14 }} aria-hidden="true">
      <Type size={30} /><span>{ghost.overCanvas
        ? tr(locale, '松手输入文字', 'Release to enter text')
        : tr(locale, '拖到搭建区', 'Drag to the build area')}</span>
    </div>, document.body)}
  </section>;
}
