import { ArrowRight, Bot, Download, Layers3, MousePointer2, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import { type MouseEvent, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { trackCampaignNavigation } from '../../analytics/CampaignPageTracker';
import { usePageMeta } from '../../app/usePageMeta';
import { localePath, switchLocalePath, tr, useLocale } from '../../i18n/locale';

const AI_PROMPT_ZH = '请阅读 https://bricks.reactshare.cn/digital-bricks-modeling-skill.md，并严格遵循其中的规则，为 Digital Bricks 生成一个 .legox 模型文件。只使用 Skill 中已有的积木，不要新增积木定义、STL、网格或说明文字。请只返回完整、有效的 .legox 文件。模型要求：生成一座带门窗和屋顶的小房子。';
const AI_PROMPT_EN = 'Read https://bricks.reactshare.cn/digital-bricks-modeling-skill.md and follow its rules exactly to create a .legox model for Digital Bricks. Use only the bricks defined in the skill. Do not add new brick definitions, STL data, meshes, or explanatory text. Return only a complete, valid .legox file. Model request: build a small house with a door, windows, and a roof.';

const features = [
  { icon: MousePointer2, titleZh: '拖放就会卡住', titleEn: 'Drag, drop, and snap', bodyZh: '连接点自动吸附，松手后按重力落位；不用先学复杂的 3D 软件。', bodyEn: 'Connectors snap together and gravity settles each brick. No complex 3D software to learn.' },
  { icon: Download, titleZh: '作品可以打印', titleEn: 'Print what you build', bodyZh: '自动合并成无内部接缝的实体，按需要的比例导出 STL。', bodyEn: 'Merge your model into a clean solid and export an STL at the size you need.' },
  { icon: Share2, titleZh: '分享，也能二创', titleEn: 'Share and remix', bodyZh: '发布到作品广场，朋友无需登录就能从你的作品继续搭建。', bodyEn: 'Publish to the gallery so friends can keep building from your creation without signing in.' },
  { icon: ShieldCheck, titleZh: '先创作，再决定注册', titleEn: 'Create before signing up', bodyZh: '搭建、保存 .legox 和导出 STL 都可以在本机完成。', bodyEn: 'Build, save .legox files, and export STL files locally without an account.' },
];

export function LandingPage() {
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const locale = useLocale();
  const aiPrompt = tr(locale, AI_PROMPT_ZH, AI_PROMPT_EN);
  const targetLocale = locale === 'zh' ? 'en' : 'zh';
  const languagePath = `${switchLocalePath(location.pathname, targetLocale)}${location.search}${location.hash}`;
  usePageMeta({
    title: tr(locale, '像搭积木一样做 3D 模型，还能直接打印｜数字积木', 'Build Printable 3D Models with Digital Bricks'),
    description: tr(locale, '专为孩子和创客设计的浏览器 3D 搭建工具。无需安装、无需先注册，拖放即可创作；完成后导出 STL、发布或继续二创。', 'A free browser-based 3D brick builder for kids, families, and makers. Drag, snap, export STL files, share your creations, and remix community builds.'),
    canonicalPath: localePath('/start', locale),
    locale,
  });

  const attributedPath = (pathname: string, content: string) => {
    const incoming = new URLSearchParams(location.search);
    const params = new URLSearchParams();

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term'].forEach((key) => {
      const value = incoming.get(key);
      if (value) params.set(key, value);
    });

    params.set('utm_content', content);

    return `${localePath(pathname, locale)}?${params.toString()}`;
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(aiPrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  const trackNavigation = (event: MouseEvent<HTMLAnchorElement>, destination: string) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    trackCampaignNavigation(destination, 'start');
  };

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link to={localePath('/', locale)} className="landing-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><strong>{tr(locale, '数字积木', 'Digital Bricks')}</strong></Link>
        <nav aria-label={tr(locale, '主要导航', 'Main navigation')}><Link to={attributedPath('/plaza', 'landing_nav_plaza')} onClick={(event) => trackNavigation(event, attributedPath('/plaza', 'landing_nav_plaza'))}>{tr(locale, '作品广场', 'Gallery')}</Link><a href={localePath('/privacy.html', locale)}>{tr(locale, '数据与隐私', 'Data & privacy')}</a><Link className="landing-nav-cta" to={languagePath} aria-label={tr(locale, '切换到英文', 'Switch to Chinese')}>{locale === 'zh' ? 'EN' : '中文'}</Link><Link className="landing-nav-cta" to={attributedPath('/build', 'landing_nav')} onClick={(event) => trackNavigation(event, attributedPath('/build', 'landing_nav'))}>{tr(locale, '开始搭建', 'Start building')}</Link></nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><Sparkles size={15} />{tr(locale, '免费 · 无需安装 · 无需先注册', 'Free · No install · No sign-up')}</span>
          <h1>{tr(locale, '像搭积木一样做 3D 模型，', 'Build 3D models like stacking bricks,')}<em>{tr(locale, '还能直接打印', 'then print them for real')}</em></h1>
          <p>{tr(locale, '专为孩子、家长和创客设计的浏览器 3D 搭建工具。拖一拖就能自动落位和卡接，完成后保存、分享，或导出 STL 变成真实作品。', 'A browser-based 3D building tool for kids, parents, and makers. Drag bricks into place, snap them together, then save, share, or export an STL to make it real.')}</p>
          <div className="landing-actions">
            <Link className="landing-primary" to={attributedPath('/build', 'landing_hero')} onClick={(event) => trackNavigation(event, attributedPath('/build', 'landing_hero'))}>{tr(locale, '立即开始搭建', 'Start building now')}<ArrowRight size={19} /></Link>
            <Link className="landing-secondary" to={attributedPath('/plaza', 'landing_hero_plaza')} onClick={(event) => trackNavigation(event, attributedPath('/plaza', 'landing_hero_plaza'))}>{tr(locale, '看看大家的作品', 'Explore the gallery')}</Link>
          </div>
          <small>{tr(locale, '搭建和导出不需要账户，作品默认保存在当前浏览器。', 'Build and export without an account. Your work stays in this browser by default.')}</small>
        </div>
        <div className="landing-hero-media">
          <img src={locale === 'en' ? '/social-preview-en.png' : '/social-preview.png'} alt={tr(locale, '数字积木从浏览器 3D 搭建到 STL 打印的功能示意', 'Digital Bricks browser-based 3D building and STL printing')} fetchPriority="high" />
        </div>
      </section>

      <section className="landing-features" aria-labelledby="landing-features-title">
        <div className="landing-section-heading"><span>{tr(locale, '从第一块到实物', 'FROM FIRST BRICK TO REAL OBJECT')}</span><h2 id="landing-features-title">{tr(locale, '把建模门槛换成搭积木的直觉', '3D modeling with the simplicity of building bricks')}</h2></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, titleZh, titleEn, bodyZh, bodyEn }) => <article key={titleEn}><Icon size={25} /><h3>{tr(locale, titleZh, titleEn)}</h3><p>{tr(locale, bodyZh, bodyEn)}</p></article>)}</div>
      </section>

      <section className="landing-ai">
        <div className="landing-ai-copy"><span className="landing-kicker"><Bot size={15} />AI + DIGITAL BRICKS</span><h2>{tr(locale, '让 AI 先搭一个草稿，你再亲手改', 'Let AI build a draft, then make it yours')}</h2><p>{tr(locale, '把公开建模规则交给 ChatGPT 或其他 AI，让它生成标准 ', 'Give the public modeling rules to ChatGPT or another AI and ask for a standard ')}<code>.legox</code>{tr(locale, ' 作品文件；回到编辑器点“打开”，就能继续移动、换色和打印。', ' model file. Open it in the editor to move bricks, change colors, and print.')}</p><ol><li>{tr(locale, '复制下面的建模提示词', 'Copy the modeling prompt below')}</li><li>{tr(locale, '交给能读取公开网址的 AI', 'Send it to an AI that can read public links')}</li><li>{tr(locale, '下载 .legox，在数字积木里打开', 'Download the .legox file and open it in Digital Bricks')}</li></ol><a href="/digital-bricks-modeling-skill.md">{tr(locale, '查看完整 AI 建模规则', 'Read the full AI modeling rules')}</a></div>
        <div className="landing-prompt-card"><div><Layers3 size={19} /><strong>{tr(locale, '小房子示例提示词', 'Sample small-house prompt')}</strong></div><p>{aiPrompt}</p><button type="button" onClick={() => void copyPrompt()}>{copied ? tr(locale, '已复制，可以交给 AI 了', 'Copied — ready for AI') : tr(locale, '复制提示词', 'Copy prompt')}</button></div>
      </section>

      <section className="landing-final-cta"><span>{tr(locale, '准备好第一块了吗？', 'READY TO PLACE YOUR FIRST BRICK?')}</span><h2>{tr(locale, '现在就把脑海里的东西搭出来', 'Build what you imagine')}</h2><Link className="landing-primary" to={attributedPath('/build', 'landing_bottom')} onClick={(event) => trackNavigation(event, attributedPath('/build', 'landing_bottom'))}>{tr(locale, '打开 3D 画板', 'Open the 3D builder')}<ArrowRight size={19} /></Link></section>

      <footer className="landing-footer"><span>{tr(locale, 'Digital Bricks · 原创数字积木连接系统', 'Digital Bricks · An original digital brick system')}</span><div><Link to={attributedPath('/plaza', 'landing_footer_plaza')} onClick={(event) => trackNavigation(event, attributedPath('/plaza', 'landing_footer_plaza'))}>{tr(locale, '作品广场', 'Gallery')}</Link><a href={localePath('/privacy.html', locale)}>{tr(locale, '数据与隐私', 'Data & privacy')}</a><a href="https://github.com/raywill/lego-x">GitHub</a></div></footer>
    </main>
  );
}
