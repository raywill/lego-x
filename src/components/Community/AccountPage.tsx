import { Check, KeyRound, Layers3, LoaderCircle, LogOut, Repeat2, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authClient } from '../../community/authClient';
import { usePageMeta } from '../../app/usePageMeta';
import { communityApi, finishRecovery, finishRegistration, startRecovery, startRegistration } from '../../community/api';
import { notifyAuthChanged, useCurrentUser } from '../../community/useCurrentUser';
import { localePath, plural, tr, useLocale } from '../../i18n/locale';
import type { CurrentUser, PublicProfile } from '../../../shared/community';

export function AccountPage() {
  const locale = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, refresh } = useCurrentUser();
  const [nickname, setNickname] = useState(() => tr(locale, '小小创作者', 'Little Maker'));
  const [guardianPin, setGuardianPin] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newRecovery, setNewRecovery] = useState<string | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  usePageMeta({
    title: tr(locale, '账户与我的作品｜数字积木 Digital Bricks', 'My Builds & Account — Digital Bricks'),
    description: tr(locale, '使用设备 Passkey 进入数字积木作品空间。', 'Sign in with a device passkey to access your Digital Bricks creator space.'),
    canonicalPath: localePath('/account', locale),
    robots: 'noindex, nofollow',
  });
  const next = new URLSearchParams(location.search).get('next');
  const requestedMode = new URLSearchParams(location.search).get('mode');
  const [mode, setMode] = useState<'login' | 'register' | 'recover'>(requestedMode === 'register' ? 'register' : 'login');
  const afterLogin = next?.startsWith('/') && !next.startsWith('//') ? next : localePath('/account', locale);
  const returnsToPublishing = new URL(afterLogin, window.location.origin).searchParams.get('publish') === '1';
  const chooseMode = (nextMode: 'login' | 'register' | 'recover') => {
    setMode(nextMode);
    setMessage('');
  };

  const register = async () => {
    if (busy) return;
    setBusy(true); setMessage(tr(locale, '正在准备安全钥匙…', 'Preparing your passkey…'));
    try {
      const start = await startRegistration(nickname, guardianPin);
      const result = await authClient.passkey.addPasskey({ context: start.context, name: tr(locale, '我的第一台设备', 'My first device'), createSession: true });
      if (!result.data) throw new Error(result.error?.message || tr(locale, 'Passkey 注册没有完成', 'Passkey registration wasn’t completed'));
      const completed = await finishRegistration();
      setNewRecovery(completed.recoveryCode);
      setRecoveryCopied(false);
      setMessage(tr(locale, '账户已经创建。请把恢复资料保存好。', 'Your account is ready. Save your recovery code now.'));
      notifyAuthChanged();
      void refresh();
    } catch (error) { setMessage(tr(locale, error instanceof Error ? error.message : '注册失败，请再试一次', 'Registration failed. Please try again.')); }
    finally { setBusy(false); }
  };

  const login = async () => {
    if (busy) return;
    setBusy(true); setMessage(tr(locale, '请在设备上选择 Digital Bricks 的 Passkey…', 'Choose the Digital Bricks passkey on your device…'));
    try {
      const result = await authClient.signIn.passkey();
      if (result.error) throw new Error(result.error.message || tr(locale, '登录没有完成', 'Sign-in wasn’t completed'));
      notifyAuthChanged();
      navigate(afterLogin);
    } catch (error) { setMessage(tr(locale, error instanceof Error ? error.message : '登录失败，请再试一次', 'Sign-in failed. Please try again.')); }
    finally { setBusy(false); }
  };

  const recover = async () => {
    if (busy) return;
    setBusy(true); setMessage(tr(locale, '正在验证恢复资料…', 'Checking your recovery code…'));
    try {
      const start = await startRecovery(recoveryCode);
      const result = await authClient.passkey.addPasskey({ context: start.context, name: tr(locale, '恢复后的设备', 'Recovered device'), createSession: true });
      if (!result.data) throw new Error(result.error?.message || tr(locale, '新 Passkey 没有完成', 'The new passkey wasn’t created'));
      const completed = await finishRecovery(result.data.id);
      setNewRecovery(completed.recoveryCode);
      setRecoveryCopied(false);
      setMessage(tr(locale, '恢复成功。旧设备钥匙已撤销，请保存新的恢复资料。', 'Account recovered. The old device key was revoked. Save your new recovery code.'));
      notifyAuthChanged();
      void refresh();
    } catch (error) { setMessage(tr(locale, error instanceof Error ? error.message : '恢复失败，请检查恢复资料', 'Recovery failed. Check your recovery code and try again.')); }
    finally { setBusy(false); }
  };

  const copyRecoveryCode = async () => {
    if (!newRecovery) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard is unavailable');
      await navigator.clipboard.writeText(newRecovery);
      setRecoveryCopied(true);
    } catch {
      setRecoveryCopied(false);
      setMessage(tr(locale, '没有自动复制成功，请手动选中恢复资料保存。', 'Couldn’t copy automatically. Select and save the recovery code manually.'));
    }
  };

  if (loading) return <main className="community-page account-page"><header className="community-header"><Link to={localePath('/', locale)} className="community-logo">{tr(locale, '数字积木', 'Digital Bricks')}</Link><Link to={localePath('/plaza', locale)}>{tr(locale, '作品广场', 'Gallery')}</Link></header><p className="community-empty">{tr(locale, '正在打开我的空间…', 'Opening your space…')}</p></main>;
  if (user && !newRecovery) return <MySpace user={user} />;

  return (
    <main className="community-page account-page">
      <header className="community-header"><Link to={localePath('/', locale)} className="community-logo">{tr(locale, '数字积木', 'Digital Bricks')}</Link><Link to={localePath('/plaza', locale)}>{tr(locale, '作品广场', 'Gallery')}</Link></header>
      <section className="account-card">
        <div className="account-hero"><KeyRound size={28} /><div><h1>{tr(locale, '进入数字积木', 'Sign in to Digital Bricks')}</h1><p>{tr(locale, '用设备自带的安全钥匙登录，孩子不用记复杂账号。', 'Use your device’s passkey so there’s no username or password to remember.')}</p></div></div>
        {mode === 'login' && <>
          <button className="community-primary wide" type="button" onClick={() => void login()} disabled={busy}><KeyRound size={18} />{tr(locale, '使用 Passkey 登录', 'Sign In with a Passkey')}</button>
          <div className="account-entry-links" aria-label={tr(locale, '账户帮助', 'Account help')}>
            <button type="button" onClick={() => chooseMode('register')} disabled={busy}>{tr(locale, '新用户注册', 'Create an Account')}</button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={() => chooseMode('recover')} disabled={busy}>{tr(locale, '找回密码', 'Recover Account')}</button>
          </div>
        </>}
        {mode === 'register' && <>
          <button className="community-quiet" type="button" onClick={() => chooseMode('login')} disabled={busy}>← {tr(locale, '返回登录', 'Back to Sign In')}</button>
          <div className="account-divider"><span>{tr(locale, '新用户注册', 'Create an Account')}</span></div>
          <label>{tr(locale, '给自己取个昵称', 'Choose a display name')}<input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={40} placeholder={tr(locale, '例如：小火箭', 'e.g. Rocket Builder')} /></label>
          <label>{tr(locale, '设置 6 位监护 PIN', 'Set a 6-digit guardian PIN')}<input value={guardianPin} onChange={(event) => setGuardianPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} placeholder={tr(locale, '首次发布作品时使用', 'Used the first time you publish')} /></label>
          <button className="community-secondary wide" type="button" onClick={() => void register()} disabled={busy || guardianPin.length !== 6 || !nickname.trim()}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <ShieldCheck size={18} />}{tr(locale, '创建 Passkey 账户', 'Create Passkey Account')}</button>
        </>}
        {mode === 'recover' && <>
          <button className="community-quiet" type="button" onClick={() => chooseMode('login')} disabled={busy}>← {tr(locale, '返回登录', 'Back to Sign In')}</button>
          <div className="account-divider"><span>{tr(locale, '找回账户', 'Recover Account')}</span></div>
          <label>{tr(locale, '输入一次性恢复资料', 'Enter your one-time recovery code')}<textarea value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} rows={3} placeholder="LX-…" /></label>
          <button className="community-secondary wide" type="button" onClick={() => void recover()} disabled={busy || !recoveryCode.trim()}>{busy ? <LoaderCircle className="is-spinning" size={18} /> : <KeyRound size={18} />}{tr(locale, '用恢复资料登记新设备', 'Add This Device with a Recovery Code')}</button>
        </>}
        {newRecovery && <div className="recovery-box"><strong>{tr(locale, '请现在保存新的恢复资料', 'Save your new recovery code now')}</strong><code>{newRecovery}</code><button type="button" onClick={() => void copyRecoveryCode()}>{recoveryCopied ? <><Check size={15} />{tr(locale, '已复制', 'Copied')}</> : tr(locale, '复制恢复资料', 'Copy Recovery Code')}</button>{returnsToPublishing && <button className="recovery-continue" type="button" onClick={() => navigate(afterLogin)}>{tr(locale, '我已保存，继续发布作品', 'Saved—Continue Publishing')}</button>}</div>}
        {message && <p className="community-message" role="status">{message}</p>}
        {mode !== 'login' && <p className="account-note">{tr(locale, '恢复资料只显示一次。它是找回账户的钥匙，请由家长保存。', 'This recovery code is shown only once. Ask a parent or guardian to keep it safe.')}</p>}
        <p className="account-privacy"><a href={localePath('/privacy.html', locale)}>{tr(locale, '数据与隐私说明', 'Privacy')}</a></p>
      </section>
    </main>
  );
}

function MySpace({ user }: { user: CurrentUser }) {
  const locale = useLocale();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [message, setMessage] = useState(() => tr(locale, '正在打开我的作品…', 'Opening your creations…'));
  const [signingOut, setSigningOut] = useState(false);
  const { refresh } = useCurrentUser();
  useEffect(() => {
    setMessage(tr(locale, '正在打开我的作品…', 'Opening your creations…'));
    void communityApi.profile(user.publicId)
      .then((value) => { setProfile(value); setMessage(''); })
      .catch((error) => setMessage(tr(locale, error instanceof Error ? error.message : '暂时无法读取作品', 'Couldn’t load your creations.')));
  }, [locale, user.publicId]);
  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await authClient.signOut();
      notifyAuthChanged();
      await refresh();
    } finally { setSigningOut(false); }
  };
  const removeWork = async (workId: string, title: string) => {
    if (!window.confirm(tr(locale, `确定要删除“${title}”吗？\n它会从广场和你的空间隐藏；已有二创作品不会受影响。`, `Remove “${title}”?\nIt will be hidden from the Gallery and your space. Existing remixes will remain available.`))) return;
    try {
      await communityApi.unpublish(workId);
      setProfile((current) => current ? { ...current, works: current.works.filter((work) => work.id !== workId) } : current);
      setMessage(tr(locale, '作品已删除。', 'Creation removed.'));
    } catch (error) { setMessage(tr(locale, error instanceof Error ? error.message : '暂时无法删除作品', 'Couldn’t remove this creation.')); }
  };
  return <main className="community-page my-page"><header className="community-header"><Link to={localePath('/', locale)} className="community-logo">{tr(locale, '数字积木', 'Digital Bricks')}</Link><nav><Link to={localePath('/plaza', locale)}>{tr(locale, '作品广场', 'Gallery')}</Link><Link className="active" to={localePath('/account', locale)}>{tr(locale, '我的', 'My Builds')}</Link></nav></header><section className="my-hero"><div className="profile-avatar">{user.nickname.slice(0, 1)}</div><div><span className="eyebrow">MY DIGITAL BRICKS</span><h1>{user.nickname}</h1><p>{profile ? tr(locale, `${profile.works.length} 件公开作品`, `${profile.works.length} ${plural(locale, profile.works.length, 'public creation', 'public creations')}`) : tr(locale, '我的作品空间', 'My Creator Space')}</p></div><button className="signout-button" type="button" onClick={() => void signOut()} disabled={signingOut}><LogOut size={16} />{signingOut ? tr(locale, '退出中', 'Signing out…') : tr(locale, '退出登录', 'Sign Out')}</button></section><section className="my-works-heading"><div><h2>{tr(locale, '我的公开作品', 'My Public Creations')}</h2><p>{tr(locale, '发布后的作品会显示在这里，其他小朋友可以二创。', 'Your published creations appear here for others to remix.')}</p></div><Link className="community-primary" to={localePath('/build', locale)}>{tr(locale, '继续搭建', 'Keep Building')}</Link></section>{profile?.works.length ? <section className="work-grid">{profile.works.map((work) => <article className="work-card my-work-card" key={work.id}><Link className="my-work-main" to={localePath(`/w/${work.id}`, locale)}><div className="work-thumb"><img src={work.thumbnailUrl} alt={tr(locale, `${work.title} 缩略图`, `${work.title} preview`)} /></div><div className="work-card-body"><h2>{work.title}</h2><div className="work-stats"><span><Layers3 size={14} />{work.brickCount}</span><span><Repeat2 size={14} />{work.remixes}</span></div></div></Link><button className="delete-work-button" type="button" onClick={() => void removeWork(work.id, work.title)}><Trash2 size={15} />{tr(locale, '删除作品', 'Remove')}</button></article>)}</section> : <p className="community-empty">{message || tr(locale, '还没有公开作品。完成一个作品后，点击“发布”就会出现在这里。', 'No public creations yet. Finish a build and choose “Publish” to add it here.')}</p>}</main>;
}
