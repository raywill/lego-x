import { KeyRound, LoaderCircle, Save, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { communityApi } from '../../community/api';
import { captureProjectThumbnail } from '../../community/thumbnail';
import { useCurrentUser } from '../../community/useCurrentUser';
import { BRICK_CATALOG_VERSION } from '../../config/brickConfig';
import { useEditorStore } from '../../store/editorStore';
import type { PublishedProject } from '../../../shared/community';

export function PublishDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  const [title, setTitle] = useState('我的数字积木作品');
  const [guardianPin, setGuardianPin] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const provenance = useEditorStore((state) => state.provenance);
  const saveProject = useEditorStore((state) => state.saveProject);
  const preview = useMemo(() => captureProjectThumbnail(bricks), [bricks]);
  const needsPin = !user?.guardianApproved;

  const continueAfterLogin = (register = false) => {
    saveProject();
    const next = encodeURIComponent('/?publish=1');
    navigate(`/account?next=${next}${register ? '&mode=register' : ''}`);
  };

  const saveLocally = () => {
    saveProject();
    onClose();
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true); setMessage('正在生成作品缩略图…');
    try {
      const project: PublishedProject = {
        version: 2,
        catalogVersion: BRICK_CATALOG_VERSION,
        bricks,
        connections,
        ...(provenance ? { provenance } : {}),
      };
      const work = await communityApi.publish({ title, project, thumbnail: captureProjectThumbnail(bricks), ...(needsPin ? { guardianPin } : {}) });
      setMessage(`已发布！作品编号：${work.id.slice(0, 8)}`);
      window.setTimeout(onClose, 900);
    } catch (error) { setMessage(error instanceof Error ? error.message : '发布失败，请再试一次'); }
    finally { setBusy(false); }
  };

  if (loading) return <PublishModal onClose={onClose}><div className="modal-icon"><ShieldCheck size={25} /></div><h2 id="publish-title">准备发布作品</h2><p>正在确认你的登录状态…</p></PublishModal>;

  if (!user) return <PublishModal onClose={onClose}>
    <div className="modal-icon"><ShieldCheck size={25} /></div>
    <h2 id="publish-title">把作品发布到作品广场</h2>
    <p>登录后，你可以分享这个作品；其他小朋友还能在它的基础上继续搭建。</p>
    <img className="publish-preview" src={preview} alt="当前作品预览" />
    <p className="publish-local-note">作品会先保存在这台设备，登录不会弄丢它。</p>
    <div className="publish-gate-actions">
      <button className="community-primary wide" type="button" onClick={() => continueAfterLogin()}><KeyRound size={18} />使用 Passkey 登录后发布</button>
      <button className="community-secondary wide" type="button" onClick={() => continueAfterLogin(true)}>新用户注册</button>
      <button className="community-quiet wide" type="button" onClick={saveLocally}><Save size={17} />先保存在本机</button>
    </div>
  </PublishModal>;

  return <PublishModal onClose={onClose}>
    <div className="modal-icon"><ShieldCheck size={25} /></div>
    <h2 id="publish-title">发布到作品空间</h2>
    <p>公开后，其他小朋友可以浏览、喜欢，也可以在你的作品上继续搭建。</p>
    <label>作品名字<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>
    {needsPin && <label>监护 PIN<input value={guardianPin} onChange={(event) => setGuardianPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="首次发布需要家长确认" /></label>}
    <p className="publish-consent">公开作品默认允许站内二创，系统会自动保留原作者署名。</p>
    <button className="community-primary wide" type="button" onClick={() => void publish()} disabled={busy || !title.trim() || (needsPin && guardianPin.length !== 6)}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <ShieldCheck size={18} />}确认发布</button>
    {message && <p className="community-message">{message}</p>}
  </PublishModal>;
}

function PublishModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return <div className="community-modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><button className="modal-close" type="button" onClick={onClose} aria-label="暂不发布"><X size={19} /></button>{children}</section></div>;
}
