import { Boxes, GripVertical } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { BRICK_DEFINITIONS } from '../../bricks/catalog';
import { getBrickGroundY } from '../../bricks/geometry';
import { useEditorStore } from '../../store/editorStore';
import type { BrickCategory } from '../../types/model';
import { BrickGlyph } from './BrickGlyph';

const categoryNames: Record<BrickCategory, string> = {
  blocks: '方块与板',
  round: '圆形',
  slopes: '斜面与三角',
  curves: '弧形',
  frames: '框与圆角',
  mechanical: '转动零件',
};

export function BrickPalette() {
  const startPaletteDrag = useEditorStore((state) => state.startPaletteDrag);
  const addBrick = useEditorStore((state) => state.addBrick);
  const activeDefinitionId = useEditorStore((state) => state.drag?.definitionId);
  const pendingTouch = useRef<{
    definitionId: string;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const pending = pendingTouch.current;
      if (!pending || pending.pointerId !== event.pointerId) return;
      const dx = event.clientX - pending.startX;
      const dy = event.clientY - pending.startY;
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        pendingTouch.current = null;
        return;
      }
      startPaletteDrag(
        pending.definitionId,
        [pending.startX, pending.startY],
        pending.pointerId,
      );
      pendingTouch.current = null;
    };
    const end = (event: PointerEvent) => {
      if (pendingTouch.current?.pointerId === event.pointerId) pendingTouch.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [startPaletteDrag]);

  return (
    <aside className="palette-panel" aria-label="积木篮">
      <div className="palette-title">
        <span className="palette-title-icon"><Boxes size={20} /></span>
        <div>
          <strong>积木篮</strong>
          <small><span className="palette-desktop-hint">拖到搭建区</span><span className="palette-mobile-hint">横滑选形状 · 向下拖入</span></small>
        </div>
      </div>

      {(Object.keys(categoryNames) as BrickCategory[]).map((category) => {
        const pieces = BRICK_DEFINITIONS.filter((piece) => piece.category === category);
        return (
          <section className="palette-category" key={category}>
            <h2>{categoryNames[category]}<span>{pieces.length}</span></h2>
            <div className="palette-grid">
              {pieces.map((definition) => (
                <button
                  type="button"
                  className={`palette-card ${activeDefinitionId === definition.id ? 'is-dragging' : ''}`}
                  key={definition.id}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    if (event.pointerType === 'touch') {
                      pendingTouch.current = {
                        definitionId: definition.id,
                        pointerId: event.pointerId,
                        startX: event.clientX,
                        startY: event.clientY,
                      };
                      return;
                    }
                    event.preventDefault();
                    startPaletteDrag(
                      definition.id,
                      [event.clientX, event.clientY],
                      event.pointerId,
                    );
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    const offset = (useEditorStore.getState().bricks.length % 5) * 14 - 28;
                    addBrick(definition.id, [offset, getBrickGroundY(definition), 0]);
                  }}
                  title={`拖动${definition.name}到搭建区`}
                  aria-label={`拖动${definition.name}到搭建区`}
                >
                  <span className="palette-drag-handle" aria-hidden="true"><GripVertical size={14} /></span>
                  <span className="brick-glyph" style={{ '--brick-color': definition.color } as React.CSSProperties}><BrickGlyph definition={definition} /></span>
                  <span className="palette-card-name">{definition.shortName}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </aside>
  );
}
