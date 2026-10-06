import { Home, Layers3 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWebMcpTools } from './app/useWebMcpTools';
import { BrickPalette } from './components/BrickPalette/BrickPalette';
import { BrickScene } from './components/Scene/BrickScene';
import type { CameraView } from './components/Scene/CameraRig';
import { SelectionToolbar } from './components/Selection/SelectionToolbar';
import { TopToolbar } from './components/Toolbar/TopToolbar';
import { PrintWarnings } from './components/Warnings/PrintWarnings';
import { PublishDialog } from './components/Community/PublishDialog';
import { PRINT_BED } from './config/brickConfig';
import { checkPrintability } from './editor/printability';
import { useEditorStore } from './store/editorStore';

const viewLabels: Array<[CameraView, string]> = [
  ['top', '顶视'],
  ['front', '正视'],
  ['side', '侧视'],
];

let aiSkillHintLogged = false;

function logAiSkillHint() {
  if (aiSkillHintLogged || window.location.pathname !== '/') return;
  aiSkillHintLogged = true;
  const skillUrl = `${window.location.origin}/digital-bricks-modeling-skill.md`;
  console.info(
    '%cDigital Bricks · AI 建模 Skill 已就绪\n%c1. 打开并复制：' + skillUrl
      + '\n2. 在 ChatGPT 或其他 LLM 新建对话，先粘贴整份 Skill。'
      + '\n3. 描述想搭的东西，并要求只返回完整 .legox JSON。'
      + '\n4. 将 JSON 保存为 xxx.legox，回到数字积木顶部点“打开”导入。\n%cSkill 已包含积木目录、网格、吸附、无重叠与打印约束。',
    'color:#5d50da;font-size:14px;font-weight:800;',
    'color:#3d3853;font-size:12px;line-height:1.7;',
    'color:#746d8c;font-size:12px;',
  );
}

function CameraControls({ view, onChange }: { view: CameraView; onChange: (view: CameraView) => void }) {
  return (
    <div className="camera-controls" aria-label="观察方向">
      {viewLabels.map(([key, label]) => (
        <button type="button" className={view === key ? 'active' : ''} onClick={() => onChange(key)} key={key}>{label}</button>
      ))}
      <button type="button" className={`home-button ${view === 'home' ? 'active' : ''}`} onClick={() => onChange('home')} aria-label="回到默认视角" title="回到默认视角"><Home size={17} /></button>
    </div>
  );
}

function OnboardingHint() {
  const count = useEditorStore((state) => state.bricks.length);
  const dragging = useEditorStore((state) => Boolean(state.drag));
  const selectedId = useEditorStore((state) => state.selectedId);
  if (dragging || selectedId || count > 1) return null;
  return (
    <div className="scene-hint">
      {count === 0 ? (
        <><strong>拖一个积木进来</strong><span>从左边选一个喜欢的形状</span></>
      ) : (
        <><strong>拖到上方，松手会落下</strong><span>自动对齐格子 · <b>●</b> 靠近 <b>○</b> 会卡住</span></>
      )}
    </div>
  );
}

function SnapLegend() {
  const drag = useEditorStore((state) => state.drag);
  if (!drag?.overScene) return null;
  const ready = Boolean(drag.candidate?.committable);
  if (drag.drop && !ready) {
    return (
      <div className="snap-legend gravity-legend" aria-live="polite">
        <span className="drop-arrow">↓</span>
        <span className="snap-instruction">
          {drag.drop.supportBrickId ? '松手 · 落到深色面' : '松手 · 落到底板'}
        </span>
      </div>
    );
  }
  const isSideSnap = drag.candidate?.source.connector.type === 'magnet';
  if (isSideSnap) {
    return (
      <div className={`snap-legend is-side ${ready ? 'is-ready' : ''}`} aria-live="polite">
        <span className="side-face">▣ <small>侧面</small></span>
        <span className="snap-instruction">{ready ? '松手 · 贴住！' : '让两个侧面靠近'}</span>
        <span className="side-face">▣ <small>侧面</small></span>
      </div>
    );
  }
  return (
    <div className={`snap-legend ${ready ? 'is-ready' : ''}`} aria-live="polite">
      <span className="male-dot">● <small>凸点</small></span>
      <span className="snap-instruction">{ready ? '松手 · 咔哒！' : '让连接点靠近'}</span>
      <span className="female-dot">○ <small>凹槽</small></span>
    </div>
  );
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [view, setView] = useState<CameraView>('home');
  const [viewResetKey, setViewResetKey] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const toast = useEditorStore((state) => state.toast);
  const setToast = useEditorStore((state) => state.setToast);
  const warnings = useMemo(() => checkPrintability(bricks, connections), [bricks, connections]);
  useWebMcpTools();

  useEffect(() => { logAiSkillHint(); }, []);

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
            <span>打印底板 · 大格 1×1 · 细线半格 · {PRINT_BED.width} × {PRINT_BED.depth} mm</span>
          </div>
          <div className="scene-count" aria-label={`${bricks.length}块积木，${connections.length}处连接`}>
            <Layers3 size={15} /><span>{bricks.length} 块</span><i /><span>{connections.length} 处卡接</span>
          </div>
        </div>
      </section>
      {toast && <div className={`toast ${toast.startsWith('咔哒') ? 'snap-toast' : ''}`} role="status">{toast}</div>}
      {publishOpen && <PublishDialog onClose={() => setPublishOpen(false)} />}
    </main>
  );
}

function SelectionOverlay() {
  const selectedId = useEditorStore((state) => state.selectedId);
  const multiSelectMode = useEditorStore((state) => state.multiSelectMode);
  const groupCopy = useEditorStore((state) => state.groupCopy);
  const groupMove = useEditorStore((state) => state.groupMove);
  const dragging = useEditorStore((state) => Boolean(state.drag));
  if (groupCopy || groupMove || dragging || !selectedId) return null;
  return (
    <div className="multi-select-hint">
      {multiSelectMode
        ? '逐个点击积木来选择或取消 · 按空格可以下移'
        : '方向键移动 · 顶住墙继续按可以上移 · 空格下移'}
    </div>
  );
}
