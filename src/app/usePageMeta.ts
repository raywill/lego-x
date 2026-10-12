import { useEffect } from 'react';

const SITE_ORIGIN = 'https://bricks.reactshare.cn';
const DEFAULT_IMAGE = `${SITE_ORIGIN}/social-preview.png`;

interface PageMetaOptions {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
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

function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, SITE_ORIGIN).toString();
}

export function usePageMeta({
  title,
  description,
  canonicalPath = '/',
  image = DEFAULT_IMAGE,
  robots = 'index, follow',
}: PageMetaOptions) {
  useEffect(() => {
    const canonical = absoluteUrl(canonicalPath);
    const imageUrl = absoluteUrl(image);
    document.title = title;
    upsertCanonical(canonical);
    upsertMeta('meta[name="description"]', 'name', 'description', description);
    upsertMeta('meta[name="robots"]', 'name', 'robots', robots);
    upsertMeta('meta[property="og:title"]', 'property', 'og:title', title);
    upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
    upsertMeta('meta[property="og:url"]', 'property', 'og:url', canonical);
    upsertMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
    upsertMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);
  }, [canonicalPath, description, image, robots, title]);
}
