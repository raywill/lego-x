import { LoaderCircle, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { communityApi } from '../../community/api';
import { captureProjectThumbnail } from '../../community/thumbnail';
import { BRICK_CATALOG_VERSION } from '../../config/brickConfig';
import { useEditorStore } from '../../store/editorStore';
import type { PublishedProject } from '../../../shared/community';

export function PublishDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('我的数字积木作品');
  const [guardianPin, setGuardianPin] = useState('');
  const [needsPin, setNeedsPin] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const provenance = useEditorStore((state) => state.provenance);
  useEffect(() => { void communityApi.me().then((user) => setNeedsPin(!user?.guardianApproved)).catch(() => setMessage('请先登录，再发布作品。')); }, []);
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
      const work = await communityApi.publish({ title, project, thumbnail: captureProjectThumbnail(), ...(needsPin ? { guardianPin } : {}) });
      setMessage(`已发布！作品编号：${work.id.slice(0, 8)}`);
      window.setTimeout(onClose, 900);
    } catch (error) { setMessage(error instanceof Error ? error.message : '发布失败，请再试一次'); }
    finally { setBusy(false); }
  };
  return <div className="community-modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><button className="modal-close" type="button" onClick={onClose} aria-label="关闭"><X size={19} /></button><div className="modal-icon"><ShieldCheck size={25} /></div><h2 id="publish-title">发布到作品空间</h2><p>公开后，其他小朋友可以浏览、喜欢，也可以在你的作品上继续搭建。</p><label>作品名字<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>{needsPin && <label>监护 PIN<input value={guardianPin} onChange={(event) => setGuardianPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="首次发布需要家长确认" /></label>}<p className="publish-consent">公开作品默认允许站内二创，系统会自动保留原作者署名。</p><button className="community-primary wide" type="button" onClick={() => void publish()} disabled={busy || !title.trim() || (needsPin && guardianPin.length !== 6)}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <ShieldCheck size={18} />}确认发布</button>{message && <p className="community-message">{message}</p>}</section></div>;
}
