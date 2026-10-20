import { Home, Layers3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePageMeta } from './app/usePageMeta';
import { useWebMcpTools } from './app/useWebMcpTools';
import { BrickPalette } from './components/BrickPalette/BrickPalette';
import { BrickScene } from './components/Scene/BrickScene';
import { TextTools } from './components/Selection/TextTools';
import { useTextToolStore } from './store/textToolStore';
import type { CameraView } from './components/Scene/CameraRig';
import { isSnapToastMessage } from './components/Scene/DragInteraction';
import { SelectionToolbar } from './components/Selection/SelectionToolbar';
import { TopToolbar } from './components/Toolbar/TopToolbar';
import { PrintWarnings } from './components/Warnings/PrintWarnings';
import { PublishDialog } from './components/Community/PublishDialog';
import { PRINT_BED } from './config/brickConfig';
import { checkPrintability } from './editor/printability';
import { localePath, plural, stripLocalePrefix, tr, useLocale, type Locale } from './i18n/locale';
import { useEditorStore } from './store/editorStore';

const viewLabels = (locale: Locale): Array<[CameraView, string]> => [
  ['top', tr(locale, '顶视', 'Top')],
  ['front', tr(locale, '正视', 'Front')],
  ['side', tr(locale, '侧视', 'Side')],
];

let aiSkillHintLogged = false;

function logAiSkillHint(locale: Locale) {
  if (aiSkillHintLogged || stripLocalePrefix(window.location.pathname) !== '/') return;
  aiSkillHintLogged = true;
  const skillUrl = `${window.location.origin}/digital-bricks-modeling-skill.md`;
  const message = tr(
    locale,
    '%c## Digital Bricks\n\n%cStep1: 把下面整段指令复制给 ChatGPT 或其他 AI：\n----\n\n请阅读[' + skillUrl + '](' + skillUrl + ')，并严格遵循其中的规则，为 Digital Bricks 生成一个 .legox 模型文件。只使用 Skill 中已有的积木，不要新增积木定义、STL、网格或说明文字。请只返回完整、有效的 .legox 文件，最好能直接下载。\n\n模型文件的具体要求如下：生成一座小房子，包含墙、底板和屋顶。\n\n%cStep2: 导入\n----\n\n将 AI 返回的内容保存为 xxx.legox，然后回到数字积木顶部点击“打开”导入。',
    '%c## Digital Bricks\n\n%cStep 1: Copy the full prompt below into ChatGPT or another AI.\n----\n\nRead [' + skillUrl + '](' + skillUrl + ') and follow its rules exactly to generate a .legox model file for Digital Bricks. Use only the brick types defined in the Skill. Do not add brick definitions, STL data, meshes, or explanatory text. Return only a complete, valid .legox file.\n\nModel request: build a small house with walls, a base, and a roof.\n\n%cStep 2: Open the file\n----\n\nSave the response as xxx.legox, return to Digital Bricks, and click “Open” in the top toolbar.',
  );
  console.info(
    message,
    'color:#000;font-size:16px;font-weight:800;',
    'color:#000;font-size:13px;line-height:1.7;',
    'color:#000;font-size:13px;line-height:1.7;',
  );
}

function CameraControls({ view, onChange }: { view: CameraView; onChange: (view: CameraView) => void }) {
  const locale = useLocale();
  return (
    <div className="camera-controls" aria-label={tr(locale, '观察方向', 'Camera views')}>
      {viewLabels(locale).map(([key, label]) => (
        <button type="button" className={view === key ? 'active' : ''} onClick={() => onChange(key)} key={key}>{label}</button>
      ))}
      <button type="button" className={`home-button ${view === 'home' ? 'active' : ''}`} onClick={() => onChange('home')} aria-label={tr(locale, '回到默认视角', 'Reset view')} title={tr(locale, '回到默认视角', 'Reset view')}><Home size={17} /></button>
    </div>
  );
}

function OnboardingHint() {
  const usingText = useTextToolStore((state) => Boolean(state.draft || state.selectedId || state.form));
  const locale = useLocale();
  const count = useEditorStore((state) => state.bricks.length);
  const dragging = useEditorStore((state) => Boolean(state.drag));
  const selectedId = useEditorStore((state) => state.selectedId);
  if (dragging || selectedId || count > 1 || usingText) return null;
  return (
    <div className="scene-hint">
      {count === 0 ? (
        <><strong>{tr(locale, '拖一个积木进来', 'Drag in a brick')}</strong><span>{tr(locale, '从左边选一个喜欢的形状', 'Choose a shape from the tray on the left')}</span></>
      ) : (
        <><strong>{tr(locale, '拖到上方，松手会落下', 'Drag another brick above it, then release')}</strong><span>{tr(locale, '自动对齐格子', 'Pieces align to the grid')} · <b>●</b> {tr(locale, '靠近', 'snaps into')} <b>○</b> {tr(locale, '会卡住', '')}</span></>
      )}
    </div>
  );
}

function SnapLegend() {
  const locale = useLocale();
  const drag = useEditorStore((state) => state.drag);
  if (!drag?.overScene) return null;
  const ready = Boolean(drag.candidate?.committable);
  if (drag.drop && !ready) {
    return (
      <div className="snap-legend gravity-legend" aria-live="polite">
        <span className="drop-arrow">↓</span>
        <span className="snap-instruction">
          {drag.drop.supportBrickId
            ? tr(locale, '松手 · 落到深色面', 'Release · drop on the highlighted surface')
            : tr(locale, '松手 · 落到底板', 'Release · drop on the build plate')}
        </span>
      </div>
    );
  }
  const isSideSnap = drag.candidate?.source.connector.type === 'magnet';
  if (isSideSnap) {
    return (
      <div className={`snap-legend is-side ${ready ? 'is-ready' : ''}`} aria-live="polite">
        <span className="side-face">▣ <small>{tr(locale, '侧面', 'Side')}</small></span>
        <span className="snap-instruction">{ready ? tr(locale, '松手 · 贴住！', 'Release · Snap!') : tr(locale, '让两个侧面靠近', 'Bring the two sides together')}</span>
        <span className="side-face">▣ <small>{tr(locale, '侧面', 'Side')}</small></span>
      </div>
    );
  }
  return (
    <div className={`snap-legend ${ready ? 'is-ready' : ''}`} aria-live="polite">
      <span className="male-dot">● <small>{tr(locale, '凸点', 'Stud')}</small></span>
      <span className="snap-instruction">{ready ? tr(locale, '松手 · 咔哒！', 'Release · Snap!') : tr(locale, '让连接点靠近', 'Bring the connectors together')}</span>
      <span className="female-dot">○ <small>{tr(locale, '凹槽', 'Socket')}</small></span>
    </div>
  );
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const locale = useLocale();
  const [view, setView] = useState<CameraView>('home');
  const [viewResetKey, setViewResetKey] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const toast = useEditorStore((state) => state.toast);
  const setToast = useEditorStore((state) => state.setToast);
  const warnings = useMemo(() => checkPrintability(bricks, connections), [bricks, connections, locale]);
  usePageMeta({
    title: tr(locale, '数字积木 Digital Bricks｜在线 3D 积木建模与 STL 导出', 'Digital Bricks — Browser 3D Builder & STL Export'),
    description: tr(locale, '在浏览器里像搭积木一样完成 3D 创作：拖拽吸附、AI 生成 .legox、一键导出 STL，并在作品广场分享和二创。无需安装。', 'Build 3D models with snap-together digital bricks in your browser. No install or sign-up required. Export STL files, share creations, and remix others.'),
    canonicalPath: localePath(stripLocalePrefix(location.pathname) === '/' ? '/' : '/build', locale),
    image: locale === 'en' ? '/social-preview-en.png' : '/social-preview.png',
    locale,
  });
  useWebMcpTools();

  useEffect(() => { logAiSkillHint(locale); }, [locale]);

  useEffect(() => {
    if (new URLSearchParams(location.search).get('publish') !== '1') return;
    setPublishOpen(true);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) return;
      const state = useEditorStore.getState();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo(); else state.undo();
      } else if (event.key === 'Escape' && (state.groupCopy || state.groupMove)) {
        event.preventDefault();
        state.cancelGroupPlacement();
      } else if (event.key === 'Escape' && state.multiSelectMode) {
        event.preventDefault();
        state.setMultiSelectMode(false);
      } else if (
        (event.code === 'Space' || event.key === ' ')
        && state.selectedId
        && !state.drag
        && !state.groupCopy
        && !state.groupMove
        && !target?.closest('button, [role="menu"], select')
      ) {
        event.preventDefault();
        state.lowerSelectionOneLevel();
      } else if (
        (event.key === 'Delete' || event.key === 'Backspace')
        && state.selectedId
        && !state.multiSelectMode
      ) {
        event.preventDefault();
        state.deleteSelected();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2300);
    return () => window.clearTimeout(timer);
  }, [setToast, toast]);

  return (
    <main className="app-shell">
      <TopToolbar onPublish={() => setPublishOpen(true)} />
      <section className="workspace">
        <BrickPalette />
        <div className="scene-panel">
          <BrickScene view={view} resetKey={viewResetKey} />
          <TextTools />
          <SelectionOverlay />
          <OnboardingHint />
          <SnapLegend />
          <CameraControls view={view} onChange={(nextView) => {
            setView(nextView);
            setViewResetKey((key) => key + 1);
          }} />
          <PrintWarnings warnings={warnings} />
          <SelectionToolbar />
          <div className="bed-label">
            <span className="bed-dot" />
            <span>{tr(locale, '打印底板 · 大格 1×1 · 细线半格', 'Print bed · Major grid 1×1 · Minor grid ½')} · {PRINT_BED.width} × {PRINT_BED.depth} mm</span>
          </div>
          <div className="scene-count" aria-label={tr(locale, `${bricks.length}块积木，${connections.length}处连接`, `${bricks.length} ${plural(locale, bricks.length, 'brick', 'bricks')}, ${connections.length} ${plural(locale, connections.length, 'connection', 'connections')}`)}>
            <Layers3 size={15} /><span>{tr(locale, `${bricks.length} 块`, `${bricks.length} ${plural(locale, bricks.length, 'brick', 'bricks')}`)}</span><i /><span>{tr(locale, `${connections.length} 处卡接`, `${connections.length} ${plural(locale, connections.length, 'connection', 'connections')}`)}</span>
          </div>
        </div>
      </section>
      {toast && <div className={`toast ${isSnapToastMessage(toast) ? 'snap-toast' : ''}`} role="status">{toast}</div>}
      {publishOpen && <PublishDialog onClose={() => setPublishOpen(false)} />}
    </main>
  );
}

function SelectionOverlay() {
  const locale = useLocale();
  const selectedId = useEditorStore((state) => state.selectedId);
  const multiSelectMode = useEditorStore((state) => state.multiSelectMode);
  const groupCopy = useEditorStore((state) => state.groupCopy);
  const groupMove = useEditorStore((state) => state.groupMove);
  const dragging = useEditorStore((state) => Boolean(state.drag));
  if (groupCopy || groupMove || dragging || !selectedId) return null;
  return (
    <div className="multi-select-hint">
      {multiSelectMode
        ? tr(locale, '逐个点击积木来选择或取消 · 按空格可以下移', 'Click bricks to select or deselect · Press Space to move down')
        : tr(locale, '方向键移动 · 顶住墙继续按可以上移 · 空格下移', 'Arrow keys to move · Keep pressing against a wall to climb · Space to move down')}
    </div>
  );
}
