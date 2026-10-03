import { ChevronDown, Download, FolderOpen, LoaderCircle, RotateCcw, RotateCw, Save, Sparkles } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { downloadLegoxFile, isLegoxFilename } from '../../editor/projectFile';
import { downloadStl } from '../../export/stl';
import { useEditorStore } from '../../store/editorStore';

function showLabel(action: string) {
  return <span className="action-label">{action}</span>;
}

const printScales = [
  { value: 1, label: '1×', hint: '原大小' },
  { value: 0.75, label: '0.75×', hint: '缩小一点' },
  { value: 0.5, label: '0.5×', hint: '一半大小' },
  { value: 0.25, label: '0.25×', hint: '迷你大小' },
] as const;

type PrintScale = (typeof printScales)[number]['value'];

export function TopToolbar() {
  const [exporting, setExporting] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearProject = useEditorStore((state) => state.clearProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const importProject = useEditorStore((state) => state.importProject);
  const setToast = useEditorStore((state) => state.setToast);

  const startNew = () => {
    if (bricks.length && !window.confirm('要清空画板，开始一个新作品吗？')) return;
    clearProject();
  };

  useEffect(() => {
    if (!printMenuOpen) return;
    const closeWhenClickingAway = (event: PointerEvent) => {
      if (!printMenuRef.current?.contains(event.target as Node)) setPrintMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPrintMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeWhenClickingAway);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeWhenClickingAway);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [printMenuOpen]);

  const exportProject = async (scale: PrintScale) => {
    if (exporting) return;
    setPrintMenuOpen(false);
    setExporting(true);
    setToast(`正在按 ${scale}× 合成实体…`);
    try {
      const suffix = scale === 1 ? '' : `-${scale}x`;
      await downloadStl(bricks, `我的数字积木${suffix}.stl`, scale);
      setToast(`${scale}× 打印文件好了，辅助凸点已去掉`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导出失败，请再试一次');
    } finally {
      setExporting(false);
    }
  };

  const saveProjectFile = () => {
    try {
      saveProject();
      downloadLegoxFile({ bricks, connections });
      setToast('.legox 作品文件已保存');
    } catch {
      setToast('作品文件保存失败，请再试一次');
    }
  };

  const openProjectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!isLegoxFilename(file.name)) {
      setToast('请选择 .legox 作品文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast('这个作品文件太大了');
      return;
    }
    try {
      const opened = importProject(await file.text());
      if (!opened) return;
      saveProject();
      setToast(`${file.name} 已打开`);
    } catch {
      setToast('无法读取这个 .legox 文件');
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
          <button type="button" onClick={saveProjectFile} aria-label="保存 legox 作品文件" title="下载 .legox 作品文件"><Save size={18} />{showLabel('保存')}</button>
          <button type="button" onClick={() => projectFileRef.current?.click()} aria-label="打开 legox 作品文件" title="从电脑打开 .legox 作品文件"><FolderOpen size={18} />{showLabel('打开')}</button>
          <input
            ref={projectFileRef}
            type="file"
            accept=".legox,application/x-legox+json"
            hidden
            onChange={(event) => void openProjectFile(event)}
          />
          <div className="print-action" ref={printMenuRef}>
            <button
              type="button"
              className="primary"
              onClick={() => setPrintMenuOpen((open) => !open)}
              disabled={!bricks.length || exporting}
              aria-label={exporting ? '正在合并打印文件' : '选择比例并下载打印文件'}
              aria-haspopup="menu"
              aria-expanded={printMenuOpen}
              title="选择比例，下载 STL 打印文件"
            >
              {exporting ? <LoaderCircle className="is-spinning" size={18} /> : <Download size={18} />}
              {showLabel(exporting ? '合并中' : '去打印')}
              {!exporting && <ChevronDown className={`print-chevron ${printMenuOpen ? 'is-open' : ''}`} size={15} />}
            </button>
            {printMenuOpen && (
              <div className="print-scale-menu" role="menu" aria-label="选择打印比例">
                <div className="print-scale-title">选一个打印大小</div>
                {printScales.map((option) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={option.value}
                    onClick={() => void exportProject(option.value)}
                    aria-label={`按 ${option.value} 倍导出`}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.hint}</span>
                    <Download size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
