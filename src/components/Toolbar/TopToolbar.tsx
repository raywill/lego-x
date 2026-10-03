import { Download, FolderOpen, LoaderCircle, RotateCcw, RotateCw, Save, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { downloadStl } from '../../export/stl';
import { useEditorStore } from '../../store/editorStore';

function showLabel(action: string) {
  return <span className="action-label">{action}</span>;
}

export function TopToolbar() {
  const [exporting, setExporting] = useState(false);
  const bricks = useEditorStore((state) => state.bricks);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearProject = useEditorStore((state) => state.clearProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const loadProject = useEditorStore((state) => state.loadProject);
  const setToast = useEditorStore((state) => state.setToast);

  const startNew = () => {
    if (bricks.length && !window.confirm('要清空画板，开始一个新作品吗？')) return;
    clearProject();
  };

  const exportProject = async () => {
    if (exporting) return;
    setExporting(true);
    setToast('正在合成实体，辅助凸点不会打印…');
    try {
      await downloadStl(bricks);
      setToast('打印文件好了，辅助凸点已去掉');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导出失败，请再试一次');
    } finally {
      setExporting(false);
    }
  };

  return (
    <header className="topbar">
      <div className="brand" aria-label="数字积木">
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <strong>数字积木</strong>
      </div>

      <div className="top-actions" aria-label="项目操作">
        <div className="action-group history-actions">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label="撤销" title="撤销（Ctrl/Cmd + Z）">
            <RotateCcw size={19} />{showLabel('撤销')}
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label="重做" title="重做（Ctrl/Cmd + Shift + Z）">
            <RotateCw size={19} />{showLabel('重做')}
          </button>
        </div>
        <span className="toolbar-divider" />
        <div className="action-group project-actions">
          <button type="button" onClick={startNew} aria-label="新建作品" title="清空画板，开始新作品"><Sparkles size={18} />{showLabel('新建')}</button>
          <button type="button" onClick={saveProject} aria-label="保存作品"><Save size={18} />{showLabel('保存')}</button>
          <button type="button" onClick={loadProject} aria-label="读取作品"><FolderOpen size={18} />{showLabel('读取')}</button>
          <button type="button" className="primary" onClick={() => void exportProject()} disabled={!bricks.length || exporting} aria-label={exporting ? '正在合并打印文件' : '下载打印文件'} title="下载 STL 打印文件">
            {exporting ? <LoaderCircle className="is-spinning" size={18} /> : <Download size={18} />}
            {showLabel(exporting ? '合并中' : '去打印')}
          </button>
        </div>
      </div>
    </header>
  );
}
