import { ArrowLeft, Heart, Repeat2, Flag, LoaderCircle, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePageMeta } from '../../app/usePageMeta';
import { communityApi } from '../../community/api';
import { shareLink } from '../../community/share';
import { localePath, plural, tr, useLocale } from '../../i18n/locale';
import { useEditorStore } from '../../store/editorStore';
import type { PublicWork } from '../../../shared/community';
import { AccountLink } from './AccountLink';
import { useCurrentUser } from '../../community/useCurrentUser';

export function WorkPage() {
  const locale = useLocale();
  const { workId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useCurrentUser();
  const [work, setWork] = useState<PublicWork | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  usePageMeta({
    title: work
      ? tr(locale, `${work.title}｜${work.author.nickname} 的数字积木作品`, `${work.title} by ${work.author.nickname} — Digital Bricks`)
      : tr(locale, '作品详情｜数字积木 Digital Bricks', 'Creation — Digital Bricks'),
    description: work
      ? tr(locale, `看看 ${work.author.nickname} 用 ${work.brickCount} 块数字积木搭出的“${work.title}”，也可以从这个作品开始二创。`, `See “${work.title},” a ${work.brickCount}-brick build by ${work.author.nickname}. Remix it in your browser or start your own 3D creation.`)
      : tr(locale, '打开一件数字积木公开作品，继续二创或开始自己的 3D 搭建。', 'Open a public Digital Bricks creation, remix it, or start your own browser-based 3D build.'),
    canonicalPath: localePath(`/w/${encodeURIComponent(workId)}`, locale),
  });
  useEffect(() => {
    let active = true;
    setLoading(true);
    setWork(null);
    setMessage('');
    void communityApi.work(workId)
      .then((value) => { if (active) setWork(value); })
      .catch((error) => { if (active) setMessage(tr(locale, error instanceof Error ? error.message : '作品暂时不可用', 'This creation is temporarily unavailable.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [locale, workId]);
  if (loading) return <WorkPageSkeleton />;
  if (!work) return <main className="community-page"><CommunityHeader /><p className="community-empty">{message || tr(locale, '作品暂时不可用', 'This creation is temporarily unavailable.')}</p></main>;
  const goToLogin = () => {
    setMessage(tr(locale, '登录后就可以喜欢或举报作品。', 'Sign in to like or report a creation.'));
    navigate(localePath(`/account?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`, locale));
  };
  const handleAuthenticatedError = async (error: unknown, zhFallback: string, enFallback: string) => {
    try {
      if (!await communityApi.me()) {
        goToLogin();
        return;
      }
    } catch {
      // Preserve the original action error when session verification is unavailable.
    }
    setMessage(tr(locale, error instanceof Error ? error.message : zhFallback, enFallback));
  };
  const like = async () => {
    if (!user) { goToLogin(); return; }
    try { const result = await communityApi.like(work.id, !work.likedByViewer); setWork({ ...work, likedByViewer: result.liked, likes: work.likes + (result.liked ? 1 : -1) }); }
    catch (error) { await handleAuthenticatedError(error, '暂时无法喜欢作品', 'Couldn’t update your like. Please try again.'); }
  };
  const remix = async () => {
    if (busy) return;
    setBusy(true);
    try { const source = await communityApi.remix(work.id); useEditorStore.getState().importProject(JSON.stringify(source.project)); navigate(localePath('/build', locale)); }
    catch (error) { setMessage(tr(locale, error instanceof Error ? error.message : '暂时无法二创', 'Couldn’t remix this creation. Please try again.')); }
    finally { setBusy(false); }
  };
  const share = async () => {
    try {
      const result = await shareLink({
        title: tr(locale, `${work.title}｜数字积木`, `${work.title} — Digital Bricks`),
        text: tr(locale, `看看 ${work.author.nickname} 用 ${work.brickCount} 块数字积木搭出的“${work.title}”`, `See “${work.title},” a ${work.brickCount}-brick build by ${work.author.nickname}.`),
        url: localePath(`/w/${work.id}?utm_source=share&utm_medium=referral&utm_campaign=community`, locale),
      }, tr(locale, '无法复制链接', 'Unable to copy link'));
      if (result === 'copied') setMessage(tr(locale, '作品链接已复制，可以发给朋友了。', 'Link copied—ready to share.'));
      if (result === 'shared') setMessage(tr(locale, '分享面板已打开。', 'Share sheet opened.'));
    } catch {
      setMessage(tr(locale, '暂时无法自动分享，请复制浏览器地址。', 'Couldn’t share automatically. Copy the browser address instead.'));
    }
  };
  const report = async () => {
    if (!user) { goToLogin(); return; }
    try { await communityApi.report(work.id, '其他'); setMessage(tr(locale, '已收到举报，谢谢你的提醒。', 'Report received. Thanks for letting us know.')); }
    catch (error) { await handleAuthenticatedError(error, '暂时无法提交举报', 'Couldn’t submit the report. Please try again.'); }
  };
  return <main className="community-page"><CommunityHeader /><section className="work-detail"><div className="work-detail-preview"><img src={work.thumbnailUrl} alt={tr(locale, `${work.title} 缩略图`, `${work.title} preview`)} /></div><div className="work-detail-info"><Link className="back-link" to={localePath('/plaza', locale)}><ArrowLeft size={16} />{tr(locale, '回到作品广场', 'Back to Gallery')}</Link><span className="eyebrow">DIGITAL BRICKS WORK</span><h1>{work.title}</h1><p>{tr(locale, '作者：', 'By ')}<Link to={localePath(`/u/${work.author.publicId}`, locale)}>{work.author.nickname}</Link></p><div className="detail-stats"><span><Heart size={17} />{work.likes}</span><span><Repeat2 size={17} />{tr(locale, `${work.remixes} 次二创`, `${work.remixes} ${plural(locale, work.remixes, 'remix', 'remixes')}`)}</span><span>{tr(locale, `${work.brickCount} 块积木`, `${work.brickCount} ${plural(locale, work.brickCount, 'brick', 'bricks')}`)}</span></div>{work.remixOf && <p className="remix-credit">{tr(locale, `灵感来源：${work.remixOf.authorNickname} 的作品`, `Based on a build by ${work.remixOf.authorNickname}`)}</p>}<div className="detail-actions"><button className="community-primary" type="button" onClick={() => void remix()} disabled={busy}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <Repeat2 size={18} />}{tr(locale, '二创这个作品', 'Remix This Build')}</button><button className="share-button" type="button" onClick={() => void share()}><Share2 size={18} />{tr(locale, '分享作品', 'Share')}</button><button className={`like-button ${work.likedByViewer ? 'liked' : ''}`} type="button" onClick={() => void like()}><Heart size={18} fill={work.likedByViewer ? 'currentColor' : 'none'} />{work.likedByViewer ? tr(locale, '已喜欢', 'Liked') : tr(locale, '喜欢', 'Like')}</button><button className="report-button" type="button" onClick={() => void report()}><Flag size={16} />{tr(locale, '举报', 'Report')}</button></div>{message && <p className="community-message" role="status">{message}</p>}</div></section></main>;
}

function CommunityHeader() {
  const locale = useLocale();
  return <header className="community-header"><Link to={localePath('/', locale)} className="community-logo">{tr(locale, '数字积木', 'Digital Bricks')}</Link><nav><Link to={localePath('/plaza', locale)}>{tr(locale, '作品广场', 'Gallery')}</Link><AccountLink /></nav></header>;
}

function WorkPageSkeleton() {
  const locale = useLocale();
  return <main className="community-page"><CommunityHeader /><section className="work-detail work-detail-skeleton" aria-busy="true" aria-label={tr(locale, '正在打开作品', 'Opening creation')}><div className="work-detail-preview skeleton-block" /><div className="work-detail-info"><span className="skeleton-line skeleton-back" /><span className="skeleton-line skeleton-eyebrow" /><span className="skeleton-line skeleton-title" /><span className="skeleton-line skeleton-author" /><div className="skeleton-stats"><span className="skeleton-line" /><span className="skeleton-line" /><span className="skeleton-line" /></div><div className="skeleton-actions"><span className="skeleton-button" /><span className="skeleton-button" /></div></div></section></main>;
}
