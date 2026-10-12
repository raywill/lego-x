import {
  ArrowDown,
  ArrowUp,
  BoxSelect,
  Check,
  ChevronDown,
  Copy,
  Move,
  MousePointer2,
  Palette,
  RotateCcw,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getBrickDefinition } from '../../bricks/catalog';
import { getBrickDisplayName } from '../../i18n/brickNames';
import { tr, useLocale } from '../../i18n/locale';
import { useEditorStore } from '../../store/editorStore';

const COLOR_CHOICES = [
  { nameZh: '红色', nameEn: 'Red', value: '#f15b64' },
  { nameZh: '橙色', nameEn: 'Orange', value: '#ff914d' },
  { nameZh: '黄色', nameEn: 'Yellow', value: '#f4c542' },
  { nameZh: '绿色', nameEn: 'Green', value: '#58c96f' },
  { nameZh: '蓝色', nameEn: 'Blue', value: '#43a7df' },
  { nameZh: '紫色', nameEn: 'Purple', value: '#8871e8' },
  { nameZh: '粉色', nameEn: 'Pink', value: '#e76db6' },
  { nameZh: '白色', nameEn: 'White', value: '#f3f4f8' },
  { nameZh: '灰色', nameEn: 'Gray', value: '#8b92a3' },
  { nameZh: '黑色', nameEn: 'Black', value: '#343746' },
] as const;

export function SelectionToolbar() {
  const locale = useLocale();
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const multiSelectMode = useEditorStore((state) => state.multiSelectMode);
  const groupCopy = useEditorStore((state) => state.groupCopy);
  const groupMove = useEditorStore((state) => state.groupMove);
  const brick = useEditorStore((state) => state.bricks.find((item) => item.id === selectedId));
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const flipSelected = useEditorStore((state) => state.flipSelected);
  const setSelectedColor = useEditorStore((state) => state.setSelectedColor);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const setMultiSelectMode = useEditorStore((state) => state.setMultiSelectMode);
  const startGroupCopy = useEditorStore((state) => state.startGroupCopy);
  const startGroupMove = useEditorStore((state) => state.startGroupMove);
  const cancelGroupPlacement = useEditorStore((state) => state.cancelGroupPlacement);
  const selectBrick = useEditorStore((state) => state.selectBrick);

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

  if (groupCopy || groupMove) {
    return (
      <div className="selection-toolbar group-placement-toolbar" role="toolbar" aria-label={tr(locale, '整组放置', 'Place group')}>
        <span className="selected-name group-count"><MousePointer2 size={17} />{tr(locale, '点击场景放下', 'Click to place')}</span>
        <span className="selection-divider" />
        <button type="button" onClick={cancelGroupPlacement} aria-label={tr(locale, '取消整组放置', 'Cancel group placement')}>
          <X size={19} /><span>{tr(locale, '取消', 'Cancel')}</span>
        </button>
      </div>
    );
  }

  if (multiSelectMode || selectedIds.length > 1) {
    return (
      <div className="selection-toolbar multi-selection-toolbar" role="toolbar" aria-label={tr(locale, '多选积木操作', 'Multi-select actions')}>
        <span className="selected-name group-count"><BoxSelect size={17} />{tr(locale, `已选 ${selectedIds.length} 块`, `${selectedIds.length} selected`)}</span>
        <span className="selection-divider" />
        <button type="button" onClick={startGroupMove} disabled={selectedIds.length === 0} aria-label={tr(locale, '整体移动选中积木', 'Move selected bricks together')}>
          <Move size={19} /><span>{tr(locale, '整体移动', 'Move group')}</span>
        </button>
        <button type="button" onClick={startGroupCopy} disabled={selectedIds.length === 0} aria-label={tr(locale, '复制选中积木', 'Copy selected bricks')}>
          <Copy size={19} /><span>{tr(locale, '复制整组', 'Copy group')}</span>
        </button>
        <button type="button" onClick={() => setMultiSelectMode(false)} disabled={selectedIds.length === 0} aria-label={tr(locale, '完成多选', 'Finish selecting')}>
          <Check size={19} /><span>{tr(locale, '完成', 'Done')}</span>
        </button>
        <button type="button" onClick={() => selectBrick(null)} aria-label={tr(locale, '取消选择', 'Clear selection')}>
          <X size={19} /><span>{tr(locale, '取消', 'Cancel')}</span>
        </button>
      </div>
    );
  }

  if (!brick) return null;
  const definition = getBrickDefinition(brick.definitionId);
  const currentColor = brick.color ?? definition?.color ?? '#8b92a3';
  const displayName = definition
    ? getBrickDisplayName(definition, locale, true)
    : tr(locale, '积木', 'Brick');
  const fullName = definition
    ? getBrickDisplayName(definition, locale)
    : displayName;
  const customColorValue = /^#[0-9a-f]{6}$/i.test(currentColor) ? currentColor : '#8b92a3';
  const hasCustomColor = brick.color !== undefined
    && !COLOR_CHOICES.some((choice) => choice.value === brick.color);

  return (
    <div className="selection-toolbar" role="toolbar" aria-label={tr(locale, `${fullName}的操作`, `${fullName} actions`)}>
      <span className="selected-name"><span className="selected-swatch" style={{ background: currentColor }} />{displayName}</span>
      <span className="selection-divider" />
      <div className="color-picker" ref={colorPickerRef}>
        <button
          type="button"
          className="color-picker-trigger"
          onClick={() => setColorMenuOpen((open) => !open)}
          aria-label={tr(locale, '设置积木颜色', 'Set brick color')}
          aria-haspopup="menu"
          aria-expanded={colorMenuOpen}
          title={tr(locale, '设置颜色', 'Set color')}
        >
          <Palette size={19} />
          <span>{tr(locale, '颜色', 'Color')}</span>
          <span className="color-trigger-swatch" style={{ background: currentColor }} />
          <ChevronDown className={colorMenuOpen ? 'is-open' : ''} size={13} />
        </button>
        {colorMenuOpen && (
          <div className="color-menu" role="menu" aria-label={tr(locale, '选择积木颜色', 'Choose brick color')}>
            <div className="color-menu-title">{tr(locale, '选一个颜色', 'Choose a color')}</div>
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
                <span>{tr(locale, '原色', 'Original')}</span>
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
                    <span>{tr(locale, choice.nameZh, choice.nameEn)}</span>
                    {selected && <Check size={14} />}
                  </button>
                );
              })}
              <label className={`more-color-option ${hasCustomColor ? 'is-selected' : ''}`}>
                <span className="more-color-wheel" aria-hidden="true" />
                <span className="more-color-copy"><strong>{tr(locale, '更多', 'More')}</strong><small>{tr(locale, '任意颜色', 'Any color')}</small></span>
                <input
                  type="color"
                  value={customColorValue}
                  aria-label={tr(locale, '选择更多颜色', 'Choose a custom color')}
                  onChange={(event) => setSelectedColor(event.currentTarget.value)}
                />
                {hasCustomColor && <Check className="more-color-check" size={14} aria-hidden="true" />}
              </label>
            </div>
          </div>
        )}
      </div>
      <button type="button" onClick={() => setMultiSelectMode(true)} aria-label={tr(locale, '进入多选模式', 'Enter multi-select mode')} title={tr(locale, '逐个点选多个积木', 'Select multiple bricks one by one')}><BoxSelect size={19} /><span>{tr(locale, '多选', 'Select')}</span></button>
      <button type="button" onClick={() => rotateSelected(-1)} aria-label={tr(locale, '向左转 90°', 'Rotate left 90°')} title={tr(locale, '向左转 90°', 'Rotate left 90°')}><RotateCcw size={19} /><span>{tr(locale, '左转', 'Left')}</span></button>
      <button type="button" onClick={() => rotateSelected(1)} aria-label={tr(locale, '向右转 90°', 'Rotate right 90°')} title={tr(locale, '向右转 90°', 'Rotate right 90°')}><RotateCw size={19} /><span>{tr(locale, '右转', 'Right')}</span></button>
      <button type="button" onClick={() => flipSelected('up')} aria-label={tr(locale, '朝视图上方翻转 90°', 'Flip 90° toward the top of the view')} title={tr(locale, '朝当前视图上方翻转 90°', 'Flip 90° toward the top of the current view')}><ArrowUp size={19} /><span>{tr(locale, '上翻', 'Flip up')}</span></button>
      <button type="button" onClick={() => flipSelected('down')} aria-label={tr(locale, '朝视图下方翻转 90°', 'Flip 90° toward the bottom of the view')} title={tr(locale, '朝当前视图下方翻转 90°', 'Flip 90° toward the bottom of the current view')}><ArrowDown size={19} /><span>{tr(locale, '下翻', 'Flip down')}</span></button>
      <button type="button" onClick={duplicateSelected} aria-label={tr(locale, '复制积木', 'Duplicate brick')}><Copy size={19} /><span>{tr(locale, '复制', 'Duplicate')}</span></button>
      <button type="button" className="delete-action" onClick={deleteSelected} aria-label={tr(locale, '删除积木', 'Delete brick')}><Trash2 size={19} /><span>{tr(locale, '删除', 'Delete')}</span></button>
    </div>
  );
}
