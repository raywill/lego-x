import { Copy, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { getBrickDefinition } from '../../bricks/catalog';
import { useEditorStore } from '../../store/editorStore';

export function SelectionToolbar() {
  const selectedId = useEditorStore((state) => state.selectedId);
  const brick = useEditorStore((state) => state.bricks.find((item) => item.id === selectedId));
  const rotateSelected = useEditorStore((state) => state.rotateSelected);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);

  if (!brick) return null;
  const definition = getBrickDefinition(brick.definitionId);

  return (
    <div className="selection-toolbar" role="toolbar" aria-label={`${definition?.name ?? '积木'}的操作`}>
      <span className="selected-name"><span className="selected-swatch" style={{ background: brick.color ?? definition?.color }} />{definition?.shortName}</span>
      <span className="selection-divider" />
      <button type="button" onClick={() => rotateSelected(-1)} aria-label="向左转 90°" title="向左转 90°"><RotateCcw size={19} /><span>左转</span></button>
      <button type="button" onClick={() => rotateSelected(1)} aria-label="向右转 90°" title="向右转 90°"><RotateCw size={19} /><span>右转</span></button>
      <button type="button" onClick={duplicateSelected} aria-label="复制积木"><Copy size={19} /><span>复制</span></button>
      <button type="button" className="delete-action" onClick={deleteSelected} aria-label="删除积木"><Trash2 size={19} /><span>删除</span></button>
    </div>
  );
}
