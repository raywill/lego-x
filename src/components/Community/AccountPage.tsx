import { KeyRound, Layers3, LoaderCircle, LogOut, Repeat2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authClient } from '../../community/authClient';
import { communityApi, finishRecovery, finishRegistration, startRecovery, startRegistration } from '../../community/api';
import { notifyAuthChanged, useCurrentUser } from '../../community/useCurrentUser';
import type { CurrentUser, PublicProfile } from '../../../shared/community';

export function AccountPage() {
  const navigate = useNavigate();
  const { user, loading, refresh } = useCurrentUser();
  const [nickname, setNickname] = useState('小小创作者');
  const [guardianPin, setGuardianPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newRecovery, setNewRecovery] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const register = async () => {
    if (busy) return;
    setBusy(true); setMessage('正在准备安全钥匙…');
    try {
      const start = await startRegistration(nickname, guardianPin);
      const result = await authClient.passkey.addPasskey({ context: start.context, name: '我的第一台设备', createSession: true });
      if (!result.data) throw new Error(result.error?.message || 'Passkey 注册没有完成');
      const completed = await finishRegistration();
      setNewRecovery(completed.recoveryCode);
      setMessage('账户已经创建。请把恢复资料保存好。');
      notifyAuthChanged();
      void refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : '注册失败，请再试一次'); }
    finally { setBusy(false); }
  };

  const login = async () => {
    if (busy) return;
    setBusy(true); setMessage('请在设备上选择 Digital Bricks 的 Passkey…');
    try {
      const result = await authClient.signIn.passkey();
      if (result.error) throw new Error(result.error.message || '登录没有完成');
      notifyAuthChanged();
      navigate('/account');
    } catch (error) { setMessage(error instanceof Error ? error.message : '登录失败，请再试一次'); }
    finally { setBusy(false); }
  };

  const recover = async () => {
    if (busy) return;
    setBusy(true); setMessage('正在验证恢复资料…');
    try {
      const start = await startRecovery(recoveryCode);
      const result = await authClient.passkey.addPasskey({ context: start.context, name: '恢复后的设备', createSession: true });
      if (!result.data) throw new Error(result.error?.message || '新 Passkey 没有完成');
      const completed = await finishRecovery(result.data.id);
      setNewRecovery(completed.recoveryCode);
      setMessage('恢复成功。旧设备钥匙已撤销，请保存新的恢复资料。');
      notifyAuthChanged();
      void refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : '恢复失败，请检查恢复资料'); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="community-page account-page"><header className="community-header"><Link to="/" className="community-logo">数字积木</Link><Link to="/plaza">作品广场</Link></header><p className="community-empty">正在打开我的空间…</p></main>;
  if (user && !newRecovery) return <MySpace user={user} />;

  return (
    <main className="community-page account-page">
      <header className="community-header"><Link to="/" className="community-logo">数字积木</Link><Link to="/plaza">作品广场</Link></header>
      <section className="account-card">
        <div className="account-hero"><KeyRound size={28} /><div><h1>进入数字积木</h1><p>用设备自带的安全钥匙登录，孩子不用记复杂账号。</p></div></div>
        <button className="community-primary wide" type="button" onClick={() => void login()} disabled={busy}><KeyRound size={18} />使用 Passkey 登录</button>
        <div className="account-divider"><span>第一次来</span></div>
        <label>给自己取个昵称<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={40} placeholder="例如：小火箭" /></label>
        <label>设置 6 位监护 PIN<input value={guardianPin} onChange={(event) => setGuardianPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="首次发布作品时使用" /></label>
        <button className="community-secondary wide" type="button" onClick={() => void register()} disabled={busy || guardianPin.length !== 6 || !nickname.trim()}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <ShieldCheck size={18} />}创建 Passkey 账户</button>
        <div className="account-divider"><span>丢失了设备</span></div>
        <label>输入一次性恢复资料<textarea value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} rows={3} placeholder="LX-…" /></label>
        <button className="community-quiet wide" type="button" onClick={() => void recover()} disabled={busy || !recoveryCode.trim()}>用恢复资料登记新设备</button>
        {newRecovery && <div className="recovery-box"><strong>请现在保存新的恢复资料</strong><code>{newRecovery}</code><button type="button" onClick={() => navigator.clipboard?.writeText(newRecovery)}>复制恢复资料</button></div>}
        {message && <p className="community-message" role="status">{message}</p>}
        <p className="account-note">恢复资料只显示一次。它是找回账户的钥匙，请由家长保存。</p>
      </section>
    </main>
  );
}

function MySpace({ user }: { user: CurrentUser }) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [message, setMessage] = useState('正在打开我的作品…');
  const [signingOut, setSigningOut] = useState(false);
  const { refresh } = useCurrentUser();
  useEffect(() => {
    void communityApi.profile(user.publicId)
      .then((value) => { setProfile(value); setMessage(''); })
      .catch((error) => setMessage(error instanceof Error ? error.message : '暂时无法读取作品'));
  }, [user.publicId]);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await authClient.signOut();
      notifyAuthChanged();
      await refresh();
    } finally { setSigningOut(false); }
  };
  return <main className="community-page my-page"><header className="community-header"><Link to="/" className="community-logo">数字积木</Link><nav><Link to="/plaza">作品广场</Link><Link className="active" to="/account">我的</Link></nav></header><section className="my-hero"><div className="profile-avatar">{user.nickname.slice(0, 1)}</div><div><span className="eyebrow">MY DIGITAL BRICKS</span><h1>{user.nickname}</h1><p>{profile ? `${profile.works.length} 件公开作品` : '我的作品空间'}</p></div><button className="signout-button" type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={16} />{signingOut ? '退出中' : '退出登录'}</button></section><section className="my-works-heading"><div><h2>我的公开作品</h2><p>发布后的作品会显示在这里，其他小朋友可以二创。</p></div><Link className="community-primary" to="/">继续搭建</Link></section>{profile?.works.length ? <section className="work-grid">{profile.works.map((work) => <Link className="work-card" key={work.id} to={`/w/${work.id}`}><div className="work-thumb"><img src={work.thumbnailUrl} alt={`${work.title} 缩略图`} /></div><div className="work-card-body"><h2>{work.title}</h2><div className="work-stats"><span><Layers3 size={14} />{work.brickCount}</span><span><Repeat2 size={14} />{work.remixes}</span></div></div></Link>)}</section> : <p className="community-empty">{message || '还没有公开作品。完成一个作品后，点击“发布”就会出现在这里。'}</p>}</main>;
}
