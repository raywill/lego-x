import { Heart, Layers3, Repeat2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { communityApi } from '../../community/api';
import type { PublicWorkSummary } from '../../../shared/community';

export function PlazaPage() {
  const [works, setWorks] = useState<PublicWorkSummary[]>([]);
  const [message, setMessage] = useState('正在寻找有趣作品…');
  useEffect(() => { void communityApi.plaza().then((result) => { setWorks(result.works); setMessage(result.works.length ? '' : '广场还在等待第一批作品。'); }).catch((error) => setMessage(error instanceof Error ? error.message : '作品广场暂时不可用')); }, []);
  return (
    <main className="community-page">
      <header className="community-header"><Link to="/" className="community-logo">数字积木</Link><nav><Link className="active" to="/plaza">作品广场</Link><Link to="/account">账户</Link></nav></header>
      <section className="community-title"><div><span className="eyebrow">DIGITAL BRICKS COMMUNITY</span><h1>作品广场</h1><p>看看别人怎样用同一盒数字积木，搭出完全不同的想法。</p></div><Link className="community-primary" to="/">开始搭建</Link></section>
      {message && <p className="community-empty">{message}</p>}
      <section className="work-grid">{works.map((work, index) => <WorkCard key={work.id} work={work} rank={index + 1} />)}</section>
    </main>
  );
}

function WorkCard({ work, rank }: { work: PublicWorkSummary; rank: number }) {
  return <Link className="work-card" to={`/w/${work.id}`}><div className="work-thumb"><img src={work.thumbnailUrl} alt="" /><span className="work-rank">#{rank}</span></div><div className="work-card-body"><h2>{work.title}</h2><p>作者：{work.author.nickname}</p><div className="work-stats"><span><Heart size={14} />{work.likes}</span><span><Repeat2 size={14} />{work.remixes}</span><span><Layers3 size={14} />{work.brickCount}</span></div></div></Link>;
}
