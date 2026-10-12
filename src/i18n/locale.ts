import { useLocation } from 'react-router-dom';

export type Locale = 'zh' | 'en';

const ENGLISH_PREFIX = '/en';

export function localeFromPath(pathname: string): Locale {
  return pathname === ENGLISH_PREFIX || pathname.startsWith(`${ENGLISH_PREFIX}/`) ? 'en' : 'zh';
}

export function stripLocalePrefix(pathname: string): string {
  if (pathname === ENGLISH_PREFIX) return '/';
  if (pathname.startsWith(`${ENGLISH_PREFIX}/`)) return pathname.slice(ENGLISH_PREFIX.length) || '/';
  return pathname || '/';
}

export function localePath(pathOrHref: string, locale: Locale): string {
  if (/^(?:[a-z]+:)?\/\//i.test(pathOrHref) || pathOrHref.startsWith('#')) return pathOrHref;
  const url = new URL(pathOrHref || '/', 'https://digital-bricks.local');
  const barePath = stripLocalePrefix(url.pathname);
  url.pathname = locale === 'en'
    ? barePath === '/' ? ENGLISH_PREFIX : `${ENGLISH_PREFIX}${barePath}`
    : barePath;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function switchLocalePath(pathOrHref: string, targetLocale: Locale): string {
  return localePath(pathOrHref, targetLocale);
}

export function currentLocale(): Locale {
  return typeof window === 'undefined' ? 'zh' : localeFromPath(window.location.pathname);
}

export function useLocale(): Locale {
  return localeFromPath(useLocation().pathname);
}

export function tr<T>(locale: Locale, zh: T, en: T): T {
  return locale === 'en' ? en : zh;
}

export function plural(locale: Locale, count: number, one: string, many: string): string {
  if (locale === 'zh') return many;
  return count === 1 ? one : many;
}
