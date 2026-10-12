import { Heart, Layers3, Repeat2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityApi } from '../../community/api';
import { usePageMeta } from '../../app/usePageMeta';
import { localePath, tr, useLocale } from '../../i18n/locale';
import { AccountLink } from './AccountLink';
import type { PublicWorkSummary } from '../../../shared/community';

export function PlazaPage() {
  const locale = useLocale();
  const [works, setWorks] = useState<PublicWorkSummary[]>([]);
  const [message, setMessage] = useState(() => tr(locale, '正在寻找有趣作品…', 'Finding interesting builds…'));
  usePageMeta({
    title: tr(locale, '作品广场｜数字积木 Digital Bricks', 'Community Gallery — Digital Bricks'),
    description: tr(locale, '浏览数字积木创作者的公开作品，选择喜欢的作品继续二创，或从第一块积木开始搭建。', 'Explore public Digital Bricks creations, remix a build you like, or start your own browser-based 3D model.'),
    canonicalPath: localePath('/plaza', locale),
  });
  useEffect(() => {
    setMessage(tr(locale, '正在寻找有趣作品…', 'Finding interesting builds…'));
    void communityApi.plaza()
      .then((result) => {
        setWorks(result.works);
        setMessage(result.works.length ? '' : tr(locale, '广场还在等待第一批作品。', 'The Gallery is waiting for its first creations.'));
      })
      .catch((error) => setMessage(tr(locale, error instanceof Error ? error.message : '作品广场暂时不可用', 'The Gallery is temporarily unavailable.')));
  }, [locale]);
  return (
    <main className="community-page">
      <header className="community-header"><Link to={localePath('/', locale)} className="community-logo">{tr(locale, '数字积木', 'Digital Bricks')}</Link><nav><Link className="active" to={localePath('/plaza', locale)}>{tr(locale, '作品广场', 'Gallery')}</Link><AccountLink /></nav></header>
      <section className="community-title"><div><span className="eyebrow">DIGITAL BRICKS COMMUNITY</span><h1>{tr(locale, '作品广场', 'Gallery')}</h1><p>{tr(locale, '看看别人怎样用同一盒数字积木，搭出完全不同的想法。', 'See how people turn the same set of digital bricks into completely different ideas.')}</p></div><Link className="community-primary" to={localePath('/build', locale)}>{tr(locale, '开始搭建', 'Start Building')}</Link></section>
      {message && <p className="community-empty">{message}</p>}
      <section className="work-grid">{works.map((work, index) => <WorkCard key={work.id} work={work} rank={index + 1} locale={locale} />)}</section>
    </main>
  );
}

function WorkCard({ work, rank, locale }: { work: PublicWorkSummary; rank: number; locale: ReturnType<typeof useLocale> }) {
  return <Link className="work-card" to={localePath(`/w/${work.id}`, locale)}><div className="work-thumb"><img src={work.thumbnailUrl} alt={tr(locale, `${work.title} 缩略图`, `${work.title} preview`)} loading="lazy" decoding="async" /><span className="work-rank">#{rank}</span></div><div className="work-card-body"><h2>{work.title}</h2><p>{tr(locale, `作者：${work.author.nickname}`, `By ${work.author.nickname}`)}</p><div className="work-stats"><span><Heart size={14} />{work.likes}</span><span><Repeat2 size={14} />{work.remixes}</span><span><Layers3 size={14} />{work.brickCount}</span></div></div></Link>;
}
