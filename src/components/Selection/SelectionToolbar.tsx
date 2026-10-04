import {
  ArrowDown,
  ArrowUp,
  BoxSelect,
  Check,
  ChevronDown,
  Copy,
  Link2,
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
  const selectConnectedBricks = useEditorStore((state) => state.selectConnectedBricks);
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
      <div className="selection-toolbar group-placement-toolbar" role="toolbar" aria-label="整组放置">
        <span className="selected-name group-count"><MousePointer2 size={17} />点击场景放下</span>
        <span className="selection-divider" />
        <button type="button" onClick={cancelGroupPlacement} aria-label="取消整组放置">
          <X size={19} /><span>取消</span>
        </button>
      </div>
    );
  }

  if (multiSelectMode || selectedIds.length > 1) {
    return (
      <div className="selection-toolbar multi-selection-toolbar" role="toolbar" aria-label="多选积木操作">
        <span className="selected-name group-count"><BoxSelect size={17} />已选 {selectedIds.length} 块</span>
        <span className="selection-divider" />
        <button type="button" onClick={selectConnectedBricks} disabled={selectedIds.length === 0} aria-label="选中所有相连积木">
          <Link2 size={19} /><span>选相连</span>
        </button>
        <button type="button" onClick={startGroupMove} disabled={selectedIds.length === 0} aria-label="整体移动选中积木">
          <Move size={19} /><span>整体移动</span>
        </button>
        <button type="button" onClick={startGroupCopy} disabled={selectedIds.length === 0} aria-label="复制选中积木">
          <Copy size={19} /><span>复制整组</span>
        </button>
        <button type="button" onClick={() => setMultiSelectMode(false)} disabled={selectedIds.length === 0} aria-label="完成多选">
          <Check size={19} /><span>完成</span>
        </button>
        <button type="button" onClick={() => selectBrick(null)} aria-label="取消选择">
          <X size={19} /><span>取消</span>
        </button>
      </div>
    );
  }

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
      <button type="button" onClick={() => setMultiSelectMode(true)} aria-label="进入多选模式" title="圈选或点选多个积木"><BoxSelect size={19} /><span>多选</span></button>
      <button type="button" onClick={selectConnectedBricks} aria-label="选择所有相连积木" title="选择所有相连积木"><Link2 size={19} /><span>选相连</span></button>
      <button type="button" onClick={() => rotateSelected(-1)} aria-label="向左转 90°" title="向左转 90°"><RotateCcw size={19} /><span>左转</span></button>
      <button type="button" onClick={() => rotateSelected(1)} aria-label="向右转 90°" title="向右转 90°"><RotateCw size={19} /><span>右转</span></button>
      <button type="button" onClick={() => flipSelected('up')} aria-label="朝视图上方翻转 90°" title="朝当前视图上方翻转 90°"><ArrowUp size={19} /><span>上翻</span></button>
      <button type="button" onClick={() => flipSelected('down')} aria-label="朝视图下方翻转 90°" title="朝当前视图下方翻转 90°"><ArrowDown size={19} /><span>下翻</span></button>
      <button type="button" onClick={duplicateSelected} aria-label="复制积木"><Copy size={19} /><span>复制</span></button>
      <button type="button" className="delete-action" onClick={deleteSelected} aria-label="删除积木"><Trash2 size={19} /><span>删除</span></button>
    </div>
  );
}
