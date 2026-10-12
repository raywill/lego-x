import { ArrowRight, Bot, Download, Layers3, MousePointer2, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePageMeta } from '../../app/usePageMeta';

const AI_PROMPT = '请阅读 https://bricks.reactshare.cn/digital-bricks-modeling-skill.md，并严格遵循其中的规则，为 Digital Bricks 生成一个 .legox 模型文件。只使用 Skill 中已有的积木，不要新增积木定义、STL、网格或说明文字。请只返回完整、有效的 .legox 文件。模型要求：生成一座带门窗和屋顶的小房子。';

const features = [
  { icon: MousePointer2, title: '拖放就会卡住', body: '连接点自动吸附，松手后按重力落位；不用先学复杂的 3D 软件。' },
  { icon: Download, title: '作品可以打印', body: '自动合并成无内部接缝的实体，按需要的比例导出 STL。' },
  { icon: Share2, title: '分享，也能二创', body: '发布到作品广场，朋友无需登录就能从你的作品继续搭建。' },
  { icon: ShieldCheck, title: '先创作，再决定注册', body: '搭建、保存 .legox 和导出 STL 都可以在本机完成。' },
];

export function LandingPage() {
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  usePageMeta({
    title: '像搭积木一样做 3D 模型，还能直接打印｜数字积木',
    description: '专为孩子和创客设计的浏览器 3D 搭建工具。无需安装、无需先注册，拖放即可创作；完成后导出 STL、发布或继续二创。',
    canonicalPath: '/start',
  });

  const attributedPath = (pathname: string, content: string) => {
    const incoming = new URLSearchParams(location.search);
    const params = new URLSearchParams();

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term'].forEach((key) => {
      const value = incoming.get(key);
      if (value) params.set(key, value);
    });

    if (!params.has('utm_source')) {
      params.set('utm_source', 'landing');
      params.set('utm_medium', 'product');
      params.set('utm_campaign', 'launch_202610');
    }
    params.set('utm_content', content);

    return `${pathname}?${params.toString()}`;
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(AI_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="landing-brand"><span className="brand-mark" aria-hidden="true"><span /><span /><span /></span><strong>数字积木</strong></Link>
        <nav aria-label="主要导航"><Link to={attributedPath('/plaza', 'landing_nav_plaza')}>作品广场</Link><a href="/privacy.html">数据与隐私</a><Link className="landing-nav-cta" to={attributedPath('/build', 'landing_nav')}>开始搭建</Link></nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><Sparkles size={15} />免费 · 无需安装 · 无需先注册</span>
          <h1>像搭积木一样做 3D 模型，<em>还能直接打印</em></h1>
          <p>专为孩子、家长和创客设计的浏览器 3D 搭建工具。拖一拖就能自动落位和卡接，完成后保存、分享，或导出 STL 变成真实作品。</p>
          <div className="landing-actions">
            <Link className="landing-primary" to={attributedPath('/build', 'landing_hero')}>立即开始搭建<ArrowRight size={19} /></Link>
            <Link className="landing-secondary" to={attributedPath('/plaza', 'landing_hero_plaza')}>看看大家的作品</Link>
          </div>
          <small>搭建和导出不需要账户，作品默认保存在当前浏览器。</small>
        </div>
        <div className="landing-hero-media">
          <img src="/social-preview.png" alt="数字积木从浏览器 3D 搭建到 STL 打印的功能示意" fetchPriority="high" />
        </div>
      </section>

      <section className="landing-features" aria-labelledby="landing-features-title">
        <div className="landing-section-heading"><span>从第一块到实物</span><h2 id="landing-features-title">把建模门槛换成搭积木的直觉</h2></div>
        <div className="landing-feature-grid">{features.map(({ icon: Icon, title, body }) => <article key={title}><Icon size={25} /><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="landing-ai">
        <div className="landing-ai-copy"><span className="landing-kicker"><Bot size={15} />AI + DIGITAL BRICKS</span><h2>让 AI 先搭一个草稿，你再亲手改</h2><p>把公开建模规则交给 ChatGPT 或其他 AI，让它生成标准 <code>.legox</code> 作品文件；回到编辑器点“打开”，就能继续移动、换色和打印。</p><ol><li>复制下面的建模提示词</li><li>交给能读取公开网址的 AI</li><li>下载 .legox，在数字积木里打开</li></ol><a href="/digital-bricks-modeling-skill.md">查看完整 AI 建模规则</a></div>
        <div className="landing-prompt-card"><div><Layers3 size={19} /><strong>小房子示例提示词</strong></div><p>{AI_PROMPT}</p><button type="button" onClick={() => void copyPrompt()}>{copied ? '已复制，可以交给 AI 了' : '复制提示词'}</button></div>
      </section>

      <section className="landing-final-cta"><span>准备好第一块了吗？</span><h2>现在就把脑海里的东西搭出来</h2><Link className="landing-primary" to={attributedPath('/build', 'landing_bottom')}>打开 3D 画板<ArrowRight size={19} /></Link></section>

      <footer className="landing-footer"><span>Digital Bricks · 原创数字积木连接系统</span><div><Link to={attributedPath('/plaza', 'landing_footer_plaza')}>作品广场</Link><a href="/privacy.html">数据与隐私</a><a href="https://github.com/raywill/lego-x">GitHub</a></div></footer>
    </main>
  );
}
