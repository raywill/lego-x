import { ChevronDown, Download, FolderOpen, Globe2, LoaderCircle, RotateCcw, RotateCw, Save, Sparkles, UserRound } from 'lucide-react';
import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '../../community/useCurrentUser';
import {
  LEGOX_DEFAULT_FILENAME,
  isLegoxFilename,
  isSavePickerCancellation,
  saveLegoxFile,
  supportsLegoxSavePicker,
  withLegoxExtension,
} from '../../editor/projectFile';
import { downloadStl } from '../../export/stl';
import { localePath, switchLocalePath, tr, useLocale } from '../../i18n/locale';
import { useEditorStore } from '../../store/editorStore';

function showLabel(action: string) {
  return <span className="action-label">{action}</span>;
}

const PRINT_SCALES = [
  { value: 1, label: '1×', hintZh: '原大小', hintEn: 'Full size' },
  { value: 0.75, label: '0.75×', hintZh: '缩小一点', hintEn: 'A little smaller' },
  { value: 0.5, label: '0.5×', hintZh: '一半大小', hintEn: 'Half size' },
  { value: 0.25, label: '0.25×', hintZh: '迷你大小', hintEn: 'Mini size' },
] as const;

type PrintScale = (typeof PRINT_SCALES)[number]['value'];

export function TopToolbar({ onPublish }: { onPublish?: () => void }) {
  const locale = useLocale();
  const location = useLocation();
  const { user } = useCurrentUser();
  const [exporting, setExporting] = useState(false);
  const [savingProjectFile, setSavingProjectFile] = useState(false);
  const [printMenuOpen, setPrintMenuOpen] = useState(false);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const texts = useEditorStore((state) => state.texts);
  const canUndo = useEditorStore((state) => state.past.length > 0);
  const canRedo = useEditorStore((state) => state.future.length > 0);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const clearProject = useEditorStore((state) => state.clearProject);
  const saveProject = useEditorStore((state) => state.saveProject);
  const importProject = useEditorStore((state) => state.importProject);
  const setToast = useEditorStore((state) => state.setToast);
  const targetLocale = locale === 'zh' ? 'en' : 'zh';
  const languagePath = `${switchLocalePath(location.pathname, targetLocale)}${location.search}${location.hash}`;

  const startNew = () => {
    if (bricks.length && !window.confirm(tr(locale, '要清空画板，开始一个新作品吗？', 'Clear the canvas and start a new project?'))) return;
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
    setToast(tr(locale, `正在按 ${scale}× 合成实体…`, `Merging model at ${scale}×…`));
    try {
      const suffix = scale === 1 ? '' : `-${scale}x`;
      await downloadStl(bricks, `${tr(locale, '我的数字积木', 'my-digital-bricks')}${suffix}.stl`, scale, connections, texts);
      const hasMiniCube = bricks.some((brick) => brick.definitionId === 'mini-cube');
      const miniWarning = hasMiniCube && scale <= 0.5
        ? tr(locale, '；迷你方块可能太小，打印前请确认', '; mini cubes may be too small, so check before printing')
        : '';
      setToast(tr(locale, `${scale}× 打印文件好了，辅助凸点已去掉${miniWarning}`, `${scale}× STL is ready with guide studs removed${miniWarning}`));
    } catch (error) {
      setToast(locale === 'zh' && error instanceof Error
        ? error.message
        : tr(locale, '导出失败，请再试一次', 'Export failed. Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  const saveProjectFile = async () => {
    if (savingProjectFile) return;
    const defaultFilename = tr(locale, LEGOX_DEFAULT_FILENAME, 'my-digital-bricks.legox');
    let filename = defaultFilename;
    if (!supportsLegoxSavePicker()) {
      const requestedName = window.prompt(tr(locale, '给作品起个名字', 'Name your project'), defaultFilename);
      if (requestedName === null) return;
      filename = withLegoxExtension(requestedName.trim() || defaultFilename);
    }
    setSavingProjectFile(true);
    try {
      const method = await saveLegoxFile({ bricks, connections, texts }, filename);
      saveProject();
      setToast(method === 'picker'
        ? tr(locale, '作品已保存到你选择的位置', 'Project saved to the selected location')
        : tr(locale, `${filename} 已下载`, `${filename} downloaded`));
    } catch (error) {
      if (isSavePickerCancellation(error)) return;
      setToast(tr(locale, '作品文件保存失败，请再试一次', 'Could not save the project file. Please try again.'));
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
      setToast(tr(locale, '请选择 .legox 作品文件', 'Choose a .legox project file'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setToast(tr(locale, '这个作品文件太大了', 'This project file is too large'));
      return;
    }
    try {
      const opened = importProject(await file.text());
      if (!opened) return;
      saveProject();
      setToast(tr(locale, `${file.name} 已打开`, `${file.name} opened`));
    } catch {
      setToast(tr(locale, '无法读取这个 .legox 文件', 'Could not read this .legox file'));
    }
  };

  return (
    <header className="topbar">
      <div className="brand" aria-label={tr(locale, '数字积木', 'Digital Bricks')}>
        <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
        <strong>{tr(locale, '数字积木', 'Digital Bricks')}</strong>
      </div>

      <div className="top-actions" aria-label={tr(locale, '项目操作', 'Project actions')}>
        <div className="action-group history-actions">
          <button type="button" onClick={undo} disabled={!canUndo} aria-label={tr(locale, '撤销', 'Undo')} title={tr(locale, '撤销（Ctrl/Cmd + Z）', 'Undo (Ctrl/Cmd + Z)')}>
            <RotateCcw size={19} />{showLabel(tr(locale, '撤销', 'Undo'))}
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} aria-label={tr(locale, '重做', 'Redo')} title={tr(locale, '重做（Ctrl/Cmd + Shift + Z）', 'Redo (Ctrl/Cmd + Shift + Z)')}>
            <RotateCw size={19} />{showLabel(tr(locale, '重做', 'Redo'))}
          </button>
        </div>
        <span className="toolbar-divider" />
        <div className="action-group project-actions">
          <button type="button" onClick={startNew} aria-label={tr(locale, '新建作品', 'New project')} title={tr(locale, '清空画板，开始新作品', 'Clear the canvas and start a new project')}><Sparkles size={18} />{showLabel(tr(locale, '新建', 'New'))}</button>
          <button type="button" onClick={() => projectFileRef.current?.click()} aria-label={tr(locale, '打开 legox 作品文件', 'Open a .legox project file')} title={tr(locale, '从电脑打开 .legox 作品文件', 'Open a .legox project file from your computer')}><FolderOpen size={18} />{showLabel(tr(locale, '打开', 'Open'))}</button>
          <button
            type="button"
            onClick={() => void saveProjectFile()}
            disabled={savingProjectFile}
            aria-label={savingProjectFile ? tr(locale, '正在保存 legox 作品文件', 'Saving .legox project file') : tr(locale, '另存为 legox 作品文件', 'Save as a .legox project file')}
            title={tr(locale, '设置文件名和保存位置', 'Choose a file name and save location')}
          >
            {savingProjectFile ? <LoaderCircle className="is-spinning" size={18} /> : <Save size={18} />}
            {showLabel(savingProjectFile ? tr(locale, '保存中', 'Saving') : tr(locale, '保存', 'Save'))}
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
        <div className="action-group outcome-actions" aria-label={tr(locale, '完成作品', 'Finish project')}>
          {onPublish && <button type="button" className="publish-toolbar-button" onClick={onPublish} disabled={!bricks.length} title={tr(locale, '发布当前作品', 'Publish this project')}><Globe2 size={17} />{showLabel(tr(locale, '发布', 'Publish'))}</button>}
          <div className="print-action" ref={printMenuRef}>
            <button
              type="button"
              className="primary"
              onClick={() => setPrintMenuOpen((open) => !open)}
              disabled={!bricks.length || exporting}
              aria-label={exporting ? tr(locale, '正在合并打印文件', 'Merging print file') : tr(locale, '选择比例并下载打印文件', 'Choose a scale and download the print file')}
              aria-haspopup="menu"
              aria-expanded={printMenuOpen}
              title={tr(locale, '选择比例，下载 STL 打印文件', 'Choose a scale and download an STL print file')}
            >
              {exporting ? <LoaderCircle className="is-spinning" size={18} /> : <Download size={18} />}
              {showLabel(exporting ? tr(locale, '合并中', 'Preparing') : tr(locale, '去打印', 'Export STL'))}
              {!exporting && <ChevronDown className={`print-chevron ${printMenuOpen ? 'is-open' : ''}`} size={15} />}
            </button>
            {printMenuOpen && (
              <div className="print-scale-menu" role="menu" aria-label={tr(locale, '选择打印比例', 'Choose export scale')}>
                <div className="print-scale-title">{tr(locale, '选一个打印大小', 'Choose an STL size')}</div>
                {PRINT_SCALES.map((option) => (
                  <button
                    type="button"
                    role="menuitem"
                    key={option.value}
                    onClick={() => void exportProject(option.value)}
                    aria-label={tr(locale, `按 ${option.value} 倍导出`, `Export at ${option.value}×`)}
                  >
                    <strong>{option.label}</strong>
                    <span>{tr(locale, option.hintZh, option.hintEn)}</span>
                    <Download size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="toolbar-divider" />
        <nav className="action-group community-actions" aria-label={tr(locale, '社区导航', 'Community navigation')}>
          <Link className="community-toolbar-link" to={localePath('/plaza', locale)} title={tr(locale, '打开作品广场', 'Open the gallery')}><Globe2 size={17} />{tr(locale, '作品广场', 'Gallery')}</Link>
          <Link className="community-toolbar-link" to={localePath('/account', locale)} title={user ? tr(locale, '查看我的作品和账户', 'View my projects and account') : tr(locale, '登录或创建账户', 'Sign in or create an account')}><UserRound size={17} />{user ? tr(locale, '我的', 'Mine') : tr(locale, '账户', 'Account')}</Link>
          <Link className="community-toolbar-link language-toolbar-link" to={languagePath} aria-label={tr(locale, '切换到英文', 'Switch to Chinese')} title={tr(locale, '切换到英文', 'Switch to Chinese')}>{locale === 'zh' ? 'EN' : '中文'}</Link>
        </nav>
      </div>
    </header>
  );
}
