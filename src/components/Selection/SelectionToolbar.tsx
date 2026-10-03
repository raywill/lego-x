import { Check, ChevronDown, Copy, Palette, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getBrickDefinition } from '../../bricks/catalog';
import { useEditorStore } from '../../store/editorStore';

const COLOR_CHOICES = [
  { name: '红色', value: '#f15b64' },
  { name: '橙色', value: '#ff914d' },
  { name: '黄色', value: '#f4c542' },
  { name: '绿色', value: '#58c96f' },
  { name: '蓝色', value: '#43a7df' },
  { name: '紫色', value: '#8871e8' },
  { name: '粉色', value: '#e76db6' },
  { name: '白色', value: '#f3f4f8' },
  { name: '灰色', value: '#8b92a3' },
  { name: '黑色', value: '#343746' },
] as const;

export function SelectionToolbar() {
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const selectedId = useEditorStore((state) => state.selectedId);
  const brick = useEditorStore((state) => state.bricks.find((item) => item.id === selectedId));
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const setSelectedColor = useEditorStore((state) => state.setSelectedColor);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);

  useEffect(() => setColorMenuOpen(false), [selectedId]);

  useEffect(() => {
    if (!colorMenuOpen) return;
    const closeWhenClickingAway = (event: PointerEvent) => {
      if (!colorPickerRef.current?.contains(event.target as Node)) setColorMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeWhenClickingAway);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenClickingAway);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [colorMenuOpen]);

  if (!brick) return null;
  const definition = getBrickDefinition(brick.definitionId);
  const currentColor = brick.color ?? definition?.color ?? '#8b92a3';
  const customColorValue = /^#[0-9a-f]{6}$/i.test(currentColor) ? currentColor : '#8b92a3';
  const hasCustomColor = brick.color !== undefined
    && !COLOR_CHOICES.some((choice) => choice.value === brick.color);

  return (
    <div className="selection-toolbar" role="toolbar" aria-label={`${definition?.name ?? '积木'}的操作`}>
      <span className="selected-name"><span className="selected-swatch" style={{ background: currentColor }} />{definition?.shortName}</span>
      <span className="selection-divider" />
      <div className="color-picker" ref={colorPickerRef}>
        <button
          type="button"
          className="color-picker-trigger"
          onClick={() => setColorMenuOpen((open) => !open)}
          aria-label="设置积木颜色"
          aria-haspopup="menu"
          aria-expanded={colorMenuOpen}
          title="设置颜色"
        >
          <Palette size={19} />
          <span>颜色</span>
          <span className="color-trigger-swatch" style={{ background: currentColor }} />
          <ChevronDown className={colorMenuOpen ? 'is-open' : ''} size={13} />
        </button>
        {colorMenuOpen && (
          <div className="color-menu" role="menu" aria-label="选择积木颜色">
            <div className="color-menu-title">选一个颜色</div>
            <div className="color-grid">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={brick.color === undefined}
                className={brick.color === undefined ? 'is-selected' : ''}
                onClick={() => {
                  setSelectedColor(undefined);
                  setColorMenuOpen(false);
                }}
              >
                <span className="color-dot original-color" style={{ background: definition?.color }} />
                <span>原色</span>
                {brick.color === undefined && <Check size={14} />}
              </button>
              {COLOR_CHOICES.map((choice) => {
                const selected = brick.color === choice.value;
                return (
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={selected ? 'is-selected' : ''}
                    key={choice.value}
                    onClick={() => {
                      setSelectedColor(choice.value);
                      setColorMenuOpen(false);
                    }}
                  >
                    <span className="color-dot" style={{ background: choice.value }} />
                    <span>{choice.name}</span>
                    {selected && <Check size={14} />}
                  </button>
                );
              })}
              <label className={`more-color-option ${hasCustomColor ? 'is-selected' : ''}`}>
                <span className="more-color-wheel" aria-hidden="true" />
                <span className="more-color-copy"><strong>更多</strong><small>任意颜色</small></span>
                <input
                  type="color"
                  value={customColorValue}
                  aria-label="选择更多颜色"
                  onChange={(event) => setSelectedColor(event.currentTarget.value)}
                />
                {hasCustomColor && <Check className="more-color-check" size={14} aria-hidden="true" />}
              </label>
            </div>
          </div>
        )}
      </div>
      <button type="button" onClick={() => rotateSelected(-1)} aria-label="向左转 90°" title="向左转 90°"><RotateCcw size={19} /><span>左转</span></button>
      <button type="button" onClick={() => rotateSelected(1)} aria-label="向右转 90°" title="向右转 90°"><RotateCw size={19} /><span>右转</span></button>
      <button type="button" onClick={duplicateSelected} aria-label="复制积木"><Copy size={19} /><span>复制</span></button>
      <button type="button" className="delete-action" onClick={deleteSelected} aria-label="删除积木"><Trash2 size={19} /><span>删除</span></button>
    </div>
  );
}
