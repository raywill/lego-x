import { CheckCircle2, Copy, ExternalLink, KeyRound, LoaderCircle, Save, Share2, ShieldCheck, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { loadTextFont } from '../../editor/text/textGeometry';
import { useNavigate } from 'react-router-dom';
import { communityApi } from '../../community/api';
import { copyShareLink, shareLink } from '../../community/share';
import { captureProjectThumbnail } from '../../community/thumbnail';
import { useCurrentUser } from '../../community/useCurrentUser';
import { BRICK_CATALOG_VERSION } from '../../config/brickConfig';
import { localePath, tr, useLocale } from '../../i18n/locale';
import { useEditorStore } from '../../store/editorStore';
import type { PublishedProject, PublicWork } from '../../../shared/community';

export function PublishDialog({ onClose }: { onClose: () => void }) {
  const locale = useLocale();
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  const [title, setTitle] = useState(() => tr(locale, '我的数字积木作品', 'My Digital Bricks Creation'));
  const [guardianPin, setGuardianPin] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [publishedWork, setPublishedWork] = useState<PublicWork | null>(null);
  const bricks = useEditorStore((state) => state.bricks);
  const connections = useEditorStore((state) => state.connections);
  const texts = useEditorStore((state) => state.texts);
  const provenance = useEditorStore((state) => state.provenance);
  const saveProject = useEditorStore((state) => state.saveProject);
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let active = true;
    void (texts.length ? loadTextFont() : Promise.resolve()).then(() => {
      if (active) setPreview(captureProjectThumbnail(bricks, texts));
    }).catch((error) => { if (active) setMessage(String(error)); });
    return () => { active = false; };
  }, [bricks, texts]);
  const needsPin = !user?.guardianApproved;

  const continueAfterLogin = (register = false) => {
    saveProject();
    const next = encodeURIComponent(localePath('/?publish=1', locale));
    navigate(localePath(`/account?next=${next}${register ? '&mode=register' : ''}`, locale));
  };

  const saveLocally = () => {
    saveProject();
    onClose();
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true); setMessage(tr(locale, '正在生成作品缩略图…', 'Generating a preview…'));
    try {
      const project: PublishedProject = {
        version: 2,
        catalogVersion: BRICK_CATALOG_VERSION,
        bricks,
        connections,
        texts,
        ...(provenance ? { provenance } : {}),
      };
      if (texts.length) await loadTextFont();
      const work = await communityApi.publish({ title, project, thumbnail: captureProjectThumbnail(bricks, texts), ...(needsPin ? { guardianPin } : {}) });
      setPublishedWork(work);
      setMessage('');
    } catch (error) { setMessage(tr(locale, error instanceof Error ? error.message : '发布失败，请再试一次', 'Publishing failed. Please try again.')); }
    finally { setBusy(false); }
  };

  const publishedPath = publishedWork
    ? localePath(`/w/${publishedWork.id}?utm_source=publish_success&utm_medium=product&utm_campaign=community`, locale)
    : '';

  const sharePublishedWork = async () => {
    if (!publishedWork) return;
    try {
      const result = await shareLink({
        title: tr(locale, `${publishedWork.title}｜数字积木`, `${publishedWork.title} — Digital Bricks`),
        text: tr(locale, `我用数字积木搭了“${publishedWork.title}”，你也可以在这个作品上继续搭。`, `I built “${publishedWork.title}” with Digital Bricks. Open it and make your own remix.`),
        url: publishedPath,
      }, tr(locale, '无法复制链接', 'Unable to copy link'));
      if (result === 'copied') setMessage(tr(locale, '作品链接已复制，可以发给朋友了。', 'Link copied—ready to share.'));
    } catch {
      setMessage(tr(locale, '暂时无法自动分享，请使用“复制链接”。', 'Automatic sharing is unavailable. Use “Copy Link” instead.'));
    }
  };

  const copyPublishedWork = async () => {
    if (!publishedWork) return;
    try {
      await copyShareLink(publishedPath, tr(locale, '无法复制链接', 'Unable to copy link'));
      setMessage(tr(locale, '作品链接已复制。', 'Link copied.'));
    } catch {
      setMessage(tr(locale, '暂时无法自动复制，请打开作品后复制浏览器地址。', 'Couldn’t copy the link. Open the creation and copy its browser address.'));
    }
  };

  if (loading) return <PublishModal onClose={onClose}><div className="modal-icon"><ShieldCheck size={25} /></div><h2 id="publish-title">{tr(locale, '准备发布作品', 'Getting Ready to Publish')}</h2><p>{tr(locale, '正在确认你的登录状态…', 'Checking your sign-in status…')}</p></PublishModal>;

  if (!user) return <PublishModal onClose={onClose}>
    <div className="modal-icon"><ShieldCheck size={25} /></div>
    <h2 id="publish-title">{tr(locale, '把作品发布到作品广场', 'Publish to the Gallery')}</h2>
    <p>{tr(locale, '登录后，你可以分享这个作品；其他小朋友还能在它的基础上继续搭建。', 'Sign in to share this creation and let others remix it.')}</p>
    <img className="publish-preview" src={preview} alt={tr(locale, '当前作品预览', 'Current creation preview')} />
    <p className="publish-local-note">{tr(locale, '作品会先保存在这台设备，登录不会弄丢它。', 'Your creation is saved on this device before you sign in.')}</p>
    <div className="publish-gate-actions">
      <button className="community-primary wide" type="button" onClick={() => continueAfterLogin()}><KeyRound size={18} />{tr(locale, '使用 Passkey 登录后发布', 'Sign In with a Passkey')}</button>
      <button className="community-secondary wide" type="button" onClick={() => continueAfterLogin(true)}>{tr(locale, '新用户注册', 'Create an Account')}</button>
      <button className="community-quiet wide" type="button" onClick={saveLocally}><Save size={17} />{tr(locale, '先保存在本机', 'Save Locally')}</button>
    </div>
  </PublishModal>;

  if (publishedWork) return <PublishModal onClose={onClose}>
    <div className="modal-icon publish-success-icon"><CheckCircle2 size={27} /></div>
    <h2 id="publish-title">{tr(locale, '作品已发布', 'Published')}</h2>
    <p>{tr(locale, `“${publishedWork.title}”已经出现在作品广场。现在分享出去，朋友打开链接就能直接二创。`, `“${publishedWork.title}” is now in the Gallery. Share it so friends can open it and start remixing.`)}</p>
    <img className="publish-preview" src={preview} alt={tr(locale, `${publishedWork.title} 作品预览`, `${publishedWork.title} preview`)} />
    <div className="publish-gate-actions">
      <button className="community-primary wide" type="button" onClick={() => void sharePublishedWork()}><Share2 size={18} />{tr(locale, '分享作品', 'Share')}</button>
      <button className="community-secondary wide" type="button" onClick={() => navigate(publishedPath)}><ExternalLink size={18} />{tr(locale, '查看作品页', 'View Creation')}</button>
      <button className="community-quiet wide" type="button" onClick={() => void copyPublishedWork()}><Copy size={17} />{tr(locale, '复制链接', 'Copy Link')}</button>
    </div>
    {message && <p className="community-message" role="status">{message}</p>}
  </PublishModal>;

  return <PublishModal onClose={onClose}>
    <div className="modal-icon"><ShieldCheck size={25} /></div>
    <h2 id="publish-title">{tr(locale, '发布到作品空间', 'Publish Your Creation')}</h2>
    <p>{tr(locale, '公开后，其他小朋友可以浏览、喜欢，也可以在你的作品上继续搭建。', 'Once public, others can view, like, and remix your creation.')}</p>
    <label>{tr(locale, '作品名字', 'Creation name')}<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></label>
    {needsPin && <label>{tr(locale, '监护 PIN', 'Guardian PIN')}<input value={guardianPin} onChange={(event) => setGuardianPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder={tr(locale, '首次发布需要家长确认', 'Required the first time you publish')} /></label>}
    <p className="publish-consent">{tr(locale, '公开作品默认允许站内二创，系统会自动保留原作者署名。', 'Public creations can be remixed in Digital Bricks. The original creator is always credited.')}</p>
    <button className="community-primary wide" type="button" onClick={() => void publish()} disabled={busy || !title.trim() || (needsPin && guardianPin.length !== 6)}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <ShieldCheck size={18} />}{tr(locale, '确认发布', 'Publish')}</button>
    {message && <p className="community-message">{message}</p>}
  </PublishModal>;
}

function PublishModal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const locale = useLocale();
  return <div className="community-modal-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="community-modal" role="dialog" aria-modal="true" aria-labelledby="publish-title"><button className="modal-close" type="button" onClick={onClose} aria-label={tr(locale, '暂不发布', 'Close without publishing')}><X size={19} /></button>{children}</section></div>;
}
