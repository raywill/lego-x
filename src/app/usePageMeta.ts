import { useEffect } from 'react';
import { currentLocale, localePath, stripLocalePrefix, type Locale } from '../i18n/locale';

const SITE_ORIGIN = 'https://bricks.reactshare.cn';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/social-preview.png`;

interface PageMetaOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  imageAlt?: string;
  locale?: Locale;
  robots?: string;
}

function upsertMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function upsertCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }
  element.href = url;
}

function upsertAlternate(hreflang: string, url: string) {
  let element = document.head.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${hreflang}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = 'alternate';
    element.hreflang = hreflang;
    document.head.append(element);
  }
  element.href = url;
}

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, SITE_ORIGIN).toString();
}

export function usePageMeta({
  title,
  description,
  canonicalPath = '/',
  image,
  imageAlt,
  locale = currentLocale(),
  robots = 'index, follow',
}: PageMetaOptions) {
  useEffect(() => {
    const canonical = absoluteUrl(canonicalPath);
    const resolvedImage = image || (locale === 'en' ? '/social-preview-en.png' : DEFAULT_IMAGE);
    const resolvedImageAlt = imageAlt || (locale === 'en'
      ? 'Digital Bricks browser-based 3D builder and STL export'
      : '数字积木 Digital Bricks 在线 3D 创作工具');
    const imageUrl = absoluteUrl(resolvedImage);
    const bareCanonicalPath = stripLocalePrefix(new URL(canonical, SITE_ORIGIN).pathname);
    document.title = title;
    document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN';
    upsertCanonical(canonical);
    upsertAlternate('zh-CN', absoluteUrl(localePath(bareCanonicalPath, 'zh')));
    upsertAlternate('en', absoluteUrl(localePath(bareCanonicalPath, 'en')));
    upsertAlternate('x-default', absoluteUrl(localePath(bareCanonicalPath, 'zh')));
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', robots);
    upsertMeta('meta[property="og:locale"]', 'property', 'og:locale', locale === 'en' ? 'en_US' : 'zh_CN');
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
    upsertMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', resolvedImageAlt);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);
    upsertMeta('meta[name="twitter:image:alt"]', 'name', 'twitter:image:alt', resolvedImageAlt);
  }, [canonicalPath, description, image, imageAlt, locale, robots, title]);
}
