import { Layers3, Repeat2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { communityApi } from '../../community/api';
import { usePageMeta } from '../../app/usePageMeta';
import { localePath, plural, tr, useLocale } from '../../i18n/locale';
import type { PublicProfile } from '../../../shared/community';
import { AccountLink } from './AccountLink';

export function ProfilePage() {
  const locale = useLocale();
  const { publicId = '' } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [message, setMessage] = useState(() => tr(locale, '正在打开个人空间…', 'Opening creator space…'));
  usePageMeta({
    title: profile
      ? tr(locale, `${profile.nickname} 的数字积木作品`, `${profile.nickname}’s Builds — Digital Bricks`)
      : tr(locale, '创作者空间｜数字积木 Digital Bricks', 'Creator Space — Digital Bricks'),
    description: profile
      ? tr(locale, `浏览 ${profile.nickname} 公开发布的数字积木作品，并从喜欢的作品开始二创。`, `Explore public Digital Bricks creations by ${profile.nickname} and remix a build you like.`)
      : tr(locale, '浏览数字积木创作者公开发布的 3D 积木作品。', 'Explore public 3D brick creations from Digital Bricks makers.'),
    canonicalPath: localePath(`/u/${encodeURIComponent(publicId)}`, locale),
  });
  useEffect(() => {
    setMessage(tr(locale, '正在打开个人空间…', 'Opening creator space…'));
    void communityApi.profile(publicId)
      .then((value) => { setProfile(value); setMessage(''); })
      .catch((error) => setMessage(tr(locale, error instanceof Error ? error.message : '个人空间暂时不可用', 'This creator space is temporarily unavailable.')));
  }, [locale, publicId]);
  return <main className="community-page"><header className="community-header"><Link to={localePath('/', locale)} className="community-logo">{tr(locale, '数字积木', 'Digital Bricks')}</Link><nav><Link to={localePath('/plaza', locale)}>{tr(locale, '作品广场', 'Gallery')}</Link><AccountLink /></nav></header>{profile ? <><section className="profile-hero"><div className="profile-avatar">{profile.nickname.slice(0, 1)}</div><div><span className="eyebrow">CREATOR SPACE</span><h1>{profile.nickname}</h1><p>{tr(locale, `${profile.works.length} 件公开作品`, `${profile.works.length} ${plural(locale, profile.works.length, 'public creation', 'public creations')}`)}</p></div></section><section className="work-grid">{profile.works.map((work) => <Link className="work-card" key={work.id} to={localePath(`/w/${work.id}`, locale)}><div className="work-thumb"><img src={work.thumbnailUrl} alt={tr(locale, `${work.title} 缩略图`, `${work.title} preview`)} loading="lazy" decoding="async" /></div><div className="work-card-body"><h2>{work.title}</h2><div className="work-stats"><span><Layers3 size={14} />{work.brickCount}</span><span><Repeat2 size={14} />{work.remixes}</span></div></div></Link>)}</section></> : <p className="community-empty">{message}</p>}</main>;
}
