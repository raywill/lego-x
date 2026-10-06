import { ChevronDown, Download, FolderOpen, Globe2, LoaderCircle, RotateCcw, RotateCw, Save, Sparkles, UserRound } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  LEGOX_DEFAULT_FILENAME,
  isLegoxFilename,
  isSavePickerCancellation,
  saveLegoxFile,
  supportsLegoxSavePicker,
  withLegoxExtension,
} from '../../editor/projectFile';
import { downloadStl } from '../../export/stl';
import { useEditorStore } from '../../store/editorStore';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../community/useCurrentUser';

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

export function TopToolbar({ onPublish }: { onPublish?: () => void }) {
  const { user } = useCurrentUser();
  const [exporting, setExporting] = useState(false);
  const [savingProjectFile, setSavingProjectFile] = useState(false);
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
      const hasMiniCube = bricks.some((brick) => brick.definitionId === 'mini-cube');
      const miniWarning = hasMiniCube && scale <= 0.5 ? '；迷你方块可能太小，打印前请确认' : '';
      setToast(`${scale}× 打印文件好了，辅助凸点已去掉${miniWarning}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : '导出失败，请再试一次');
    } finally {
      setExporting(false);
    }
  };

  const saveProjectFile = async () => {
    if (savingProjectFile) return;
    let filename = LEGOX_DEFAULT_FILENAME;
    if (!supportsLegoxSavePicker()) {
      const requestedName = window.prompt('给作品起个名字', LEGOX_DEFAULT_FILENAME);
      if (requestedName === null) return;
      filename = withLegoxExtension(requestedName);
    }
    setSavingProjectFile(true);
    try {
      const method = await saveLegoxFile({ bricks, connections }, filename);
      saveProject();
      setToast(method === 'picker'
        ? '作品已保存到你选择的位置'
        : `${filename} 已下载`);
    } catch (error) {
      if (isSavePickerCancellation(error)) return;
      setToast('作品文件保存失败，请再试一次');
    } finally {
      setSavingProjectFile(false);
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
          <button type="button" onClick={() => projectFileRef.current?.click()} aria-label="打开 legox 作品文件" title="从电脑打开 .legox 作品文件"><FolderOpen size={18} />{showLabel('打开')}</button>
          <button
            type="button"
            onClick={() => void saveProjectFile()}
            disabled={savingProjectFile}
            aria-label={savingProjectFile ? '正在保存 legox 作品文件' : '另存为 legox 作品文件'}
            title="设置文件名和保存位置"
          >
            {savingProjectFile ? <LoaderCircle className="is-spinning" size={18} /> : <Save size={18} />}
            {showLabel(savingProjectFile ? '保存中' : '保存')}
          </button>
          <input
            ref={projectFileRef}
            type="file"
            accept=".legox,application/x-legox+json"
            hidden
            onChange={(event) => void openProjectFile(event)}
          />
        </div>
        <span className="toolbar-divider" />
        <nav className="action-group community-actions" aria-label="社区导航">
          <Link className="community-toolbar-link" to="/plaza" title="打开作品广场"><Globe2 size={17} />作品广场</Link>
          <Link className="community-toolbar-link" to="/account" title={user ? '查看我的作品和账户' : '登录或创建账户'}><UserRound size={17} />{user ? '我的' : '账户'}</Link>
        </nav>
        <span className="toolbar-divider" />
        <div className="action-group outcome-actions" aria-label="完成作品">
          {onPublish && <button type="button" className="publish-toolbar-button" onClick={onPublish} disabled={!bricks.length} title="发布当前作品"><Globe2 size={17} />发布</button>}
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
