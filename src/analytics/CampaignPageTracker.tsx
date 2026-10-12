import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

type CampaignRoute = 'start' | 'build' | 'plaza' | 'work';

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  referrerHost?: string;
};

type CampaignState = Attribution & {
  previousRoute?: CampaignRoute;
  previousAt?: number;
};

const STORAGE_KEY = 'digital-bricks:campaign-attribution:v1';
const TRANSITION_WINDOW_MS = 30 * 60 * 1000;
const SAFE_VALUE = /^[A-Za-z0-9._-]+$/;
const SAFE_HOST = /^[A-Za-z0-9.-]+$/;

let lastReportedPathname = '';
let isFirstPageInDocument = true;

function abstractRoute(pathname: string): CampaignRoute | null {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/start') return 'start';
  if (normalized === '/' || normalized === '/build') return 'build';
  if (normalized === '/plaza') return 'plaza';
  if (/^\/w\/[^/]+$/.test(normalized)) return 'work';
  return null;
}

function safeValue(value: string | null, maxLength: number) {
  if (!value || value.length > maxLength || !SAFE_VALUE.test(value)) return undefined;
  return value.toLowerCase();
}

function externalReferrerHost() {
  if (!document.referrer) return undefined;
  try {
    const referrer = new URL(document.referrer);
    const currentHost = window.location.hostname.replace(/^www\./, '').toLowerCase();
    const referrerHost = referrer.hostname.replace(/^www\./, '').toLowerCase();
    if (!referrerHost || referrerHost === currentHost || !SAFE_HOST.test(referrerHost)) return undefined;
    return referrerHost.slice(0, 253);
  } catch {
    return undefined;
  }
}

function readState(): CampaignState {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as CampaignState : {};
  } catch {
    return {};
  }
}

function writeState(state: CampaignState) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Campaign measurement is optional when storage is unavailable.
  }
}

function postPageView(route: CampaignRoute, from: CampaignRoute | undefined, attribution: Attribution) {
  const params = new URLSearchParams({ route });
  if (from) params.set('from', from);
  if (attribution.source) params.set('utm_source', attribution.source);
  if (attribution.medium) params.set('utm_medium', attribution.medium);
  if (attribution.campaign) params.set('utm_campaign', attribution.campaign);
  if (attribution.content) params.set('utm_content', attribution.content);
  if (attribution.referrerHost) params.set('referrer_host', attribution.referrerHost);

  const endpoint = `/__campaign/page?${params.toString()}`;
  void fetch(endpoint, {
    method: 'POST',
    body: '',
    credentials: 'omit',
    keepalive: true,
    referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
  }).catch(() => undefined);
}

export function CampaignPageTracker() {
  const location = useLocation();

  useEffect(() => {
    const route = abstractRoute(location.pathname);
    if (!route) return;

    if (location.pathname === lastReportedPathname) return;
    lastReportedPathname = location.pathname;

    const now = Date.now();
    const stored = readState();
    const storedIsFresh = Boolean(stored.previousAt && now - stored.previousAt <= TRANSITION_WINDOW_MS);
    const activeStored: CampaignState = storedIsFresh ? stored : {};
    const query = new URLSearchParams(location.search);
    const incoming: Attribution = {
      source: safeValue(query.get('utm_source'), 64),
      medium: safeValue(query.get('utm_medium'), 64),
      campaign: safeValue(query.get('utm_campaign'), 80),
      content: safeValue(query.get('utm_content'), 80),
    };
    const firstPageInDocument = isFirstPageInDocument;
    const referrerHost = firstPageInDocument ? externalReferrerHost() : undefined;
    isFirstPageInDocument = false;

    const isNewCampaign = Boolean(incoming.source && (
      incoming.source !== activeStored.source
      || incoming.medium !== activeStored.medium
      || incoming.campaign !== activeStored.campaign
    ));
    const isNewReferrer = Boolean(!incoming.source && referrerHost && referrerHost !== activeStored.referrerHost);
    const attribution: Attribution = isNewCampaign
      ? incoming
      : isNewReferrer
        ? { referrerHost }
        : {
            source: incoming.source || activeStored.source,
            medium: incoming.medium || activeStored.medium,
            campaign: incoming.campaign || activeStored.campaign,
            content: incoming.content || activeStored.content,
            referrerHost: activeStored.referrerHost,
          };
    const hasRecentPreviousPage = !firstPageInDocument
      && storedIsFresh
      && !isNewCampaign
      && !isNewReferrer
      && activeStored.previousRoute;
    const from = hasRecentPreviousPage ? activeStored.previousRoute : undefined;

    postPageView(route, from, attribution);
    writeState({ ...attribution, previousRoute: route, previousAt: now });
  }, [location.pathname, location.search]);

  return null;
}
