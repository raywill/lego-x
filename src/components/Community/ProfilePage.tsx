import { Layers3, Repeat2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { communityApi } from '../../community/api';
import type { PublicProfile } from '../../../shared/community';

export function ProfilePage() {
  const { publicId = '' } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [message, setMessage] = useState('正在打开个人空间…');
  useEffect(() => { void communityApi.profile(publicId).then((value) => { setProfile(value); setMessage(''); }).catch((error) => setMessage(error instanceof Error ? error.message : '个人空间暂时不可用')); }, [publicId]);
  return <main className="community-page"><header className="community-header"><Link to="/" className="community-logo">数字积木</Link><nav><Link to="/plaza">作品广场</Link><Link to="/account">账户</Link></nav></header>{profile ? <><section className="profile-hero"><div className="profile-avatar">{profile.nickname.slice(0, 1)}</div><div><span className="eyebrow">CREATOR SPACE</span><h1>{profile.nickname}</h1><p>{profile.works.length} 件公开作品</p></div></section><section className="work-grid">{profile.works.map((work) => <Link className="work-card" key={work.id} to={`/w/${work.id}`}><div className="work-thumb"><img src={work.thumbnailUrl} alt="" /></div><div className="work-card-body"><h2>{work.title}</h2><div className="work-stats"><span><Layers3 size={14} />{work.brickCount}</span><span><Repeat2 size={14} />{work.remixes}</span></div></div></Link>)}</section></> : <p className="community-empty">{message}</p>}</main>;
}
