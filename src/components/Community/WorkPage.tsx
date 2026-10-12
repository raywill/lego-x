import { ArrowLeft, Heart, Repeat2, Flag, LoaderCircle, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePageMeta } from '../../app/usePageMeta';
import { communityApi } from '../../community/api';
import { shareLink } from '../../community/share';
import { useEditorStore } from '../../store/editorStore';
import type { PublicWork } from '../../../shared/community';
import { AccountLink } from './AccountLink';
import { useCurrentUser } from '../../community/useCurrentUser';

export function WorkPage() {
  const { workId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const [work, setWork] = useState<PublicWork | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  usePageMeta({
    title: work ? `${work.title}｜${work.author.nickname} 的数字积木作品` : '作品详情｜数字积木 Digital Bricks',
    description: work ? `看看 ${work.author.nickname} 用 ${work.brickCount} 块数字积木搭出的“${work.title}”，也可以从这个作品开始二创。` : '打开一件数字积木公开作品，继续二创或开始自己的 3D 搭建。',
    canonicalPath: `/w/${encodeURIComponent(workId)}`,
  });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setWork(null);
    setMessage('');
    void communityApi.work(workId)
      .then((value) => { if (active) setWork(value); })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : '作品暂时不可用'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workId]);
  if (loading) return <WorkPageSkeleton />;
  if (!work) return <main className="community-page"><CommunityHeader /><p className="community-empty">{message || '作品暂时不可用'}</p></main>;
  const goToLogin = () => {
    setMessage('登录后就可以喜欢或举报作品。');
    navigate(`/account?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`);
  };
  const like = async () => {
    if (!user) { goToLogin(); return; }
    try { const result = await communityApi.like(work.id, !work.likedByViewer); setWork({ ...work, likedByViewer: result.liked, likes: work.likes + (result.liked ? 1 : -1) }); }
    catch (error) { if ((error instanceof Error ? error.message : '').includes('登录')) goToLogin(); else setMessage(error instanceof Error ? error.message : '暂时无法喜欢作品'); }
  };
  const remix = async () => {
    if (busy) return;
    setBusy(true);
    try { const source = await communityApi.remix(work.id); useEditorStore.getState().importProject(JSON.stringify(source.project)); navigate('/build'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '暂时无法二创'); }
    finally { setBusy(false); }
  };
  const share = async () => {
    try {
      const result = await shareLink({
        title: `${work.title}｜数字积木`,
        text: `看看 ${work.author.nickname} 用 ${work.brickCount} 块数字积木搭出的“${work.title}”`,
        url: `/w/${work.id}?utm_source=share&utm_medium=referral&utm_campaign=community`,
      });
      if (result === 'copied') setMessage('作品链接已复制，可以发给朋友了。');
      if (result === 'shared') setMessage('分享面板已打开。');
    } catch {
      setMessage('暂时无法自动分享，请复制浏览器地址。');
    }
  };
  const report = async () => {
    if (!user) { goToLogin(); return; }
    try { await communityApi.report(work.id, '其他'); setMessage('已收到举报，谢谢你的提醒。'); }
    catch (error) { if ((error instanceof Error ? error.message : '').includes('登录')) goToLogin(); else setMessage(error instanceof Error ? error.message : '暂时无法提交举报'); }
  };
  return <main className="community-page"><CommunityHeader /><section className="work-detail"><div className="work-detail-preview"><img src={work.thumbnailUrl} alt={`${work.title} 缩略图`} /></div><div className="work-detail-info"><Link className="back-link" to="/plaza"><ArrowLeft size={16} />回到作品广场</Link><span className="eyebrow">DIGITAL BRICKS WORK</span><h1>{work.title}</h1><p>作者：<Link to={`/u/${work.author.publicId}`}>{work.author.nickname}</Link></p><div className="detail-stats"><span><Heart size={17} />{work.likes}</span><span><Repeat2 size={17} />{work.remixes} 次二创</span><span>{work.brickCount} 块积木</span></div>{work.remixOf && <p className="remix-credit">灵感来源：{work.remixOf.authorNickname} 的作品</p>}<div className="detail-actions"><button className="community-primary" type="button" onClick={() => void remix()} disabled={busy}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <Repeat2 size={18} />}二创这个作品</button><button className="share-button" type="button" onClick={() => void share()}><Share2 size={18} />分享作品</button><button className={`like-button ${work.likedByViewer ? 'liked' : ''}`} type="button" onClick={() => void like()}><Heart size={18} fill={work.likedByViewer ? 'currentColor' : 'none'} />{work.likedByViewer ? '已喜欢' : '喜欢'}</button><button className="report-button" type="button" onClick={() => void report()}><Flag size={16} />举报</button></div>{message && <p className="community-message" role="status">{message}</p>}</div></section></main>;
}

function CommunityHeader() {
  return <header className="community-header"><Link to="/" className="community-logo">数字积木</Link><nav><Link to="/plaza">作品广场</Link><AccountLink /></nav></header>;
}

function WorkPageSkeleton() {
  return <main className="community-page"><CommunityHeader /><section className="work-detail work-detail-skeleton" aria-busy="true" aria-label="正在打开作品"><div className="work-detail-preview skeleton-block" /><div className="work-detail-info"><span className="skeleton-line skeleton-back" /><span className="skeleton-line skeleton-eyebrow" /><span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-author" /><div className="skeleton-stats"><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div><div className="skeleton-actions"><span className="skeleton-button" /><span className="skeleton-button" /></div></div></section></main>;
}
