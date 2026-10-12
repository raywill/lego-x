import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

const DEFAULT_LOG = '/home/wwwlogs/bricks.reactshare.cn.campaign.log';
const BOT_PATTERN = /bot|crawler|spider|slurp|preview|facebookexternalhit|twitterbot|linkedinbot|headless|lighthouse|curl|wget|python|go-http-client|node-fetch|axios|uptime|monitor/i;
const OWN_HOST = 'bricks.reactshare.cn';

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function parseSince(value) {
  const relative = /^(\d+)([hdw])$/.exec(value);
  if (relative) {
    const amount = Number(relative[1]);
    const multiplier = relative[2] === 'h' ? 3_600_000 : relative[2] === 'd' ? 86_400_000 : 604_800_000;
    return new Date(Date.now() - amount * multiplier);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --since value: ${value}`);
  return parsed;
}

function safeUrl(value, base = `https://${OWN_HOST}`) {
  try {
    return new URL(value, base);
  } catch {
    return null;
  }
}

function sourceFor(requestUrl, referrer) {
  const requestSource = requestUrl.searchParams.get('utm_source');
  if (requestSource) return requestSource.toLowerCase();

  const referrerUrl = safeUrl(referrer);
  const referrerSource = referrerUrl?.searchParams.get('utm_source');
  if (referrerSource) return referrerSource.toLowerCase();

  const host = referrerUrl?.hostname.replace(/^www\./, '').toLowerCase();
  return host && host !== OWN_HOST ? host : 'direct';
}

function campaignFor(requestUrl, referrer) {
  const referrerUrl = safeUrl(referrer);
  return requestUrl.searchParams.get('utm_campaign')
    || referrerUrl?.searchParams.get('utm_campaign')
    || 'none';
}

function eventFor(method, pathname) {
  if (method === 'GET' && /^\/start\/?$/.test(pathname)) return 'landing';
  if (method === 'GET' && (/^\/build\/?$/.test(pathname) || pathname === '/')) return 'build';
  if (method === 'GET' && /^\/plaza\/?$/.test(pathname)) return 'plaza';
  if (method === 'GET' && /^\/w\/[^/]+\/?$/.test(pathname)) return 'work';
  if (method === 'POST' && pathname === '/api/v1/works') return 'publish';
  if (method === 'GET' && /^\/api\/v1\/works\/[^/]+\/remix\/?$/.test(pathname)) return 'remix';
  if ((method === 'POST' || method === 'DELETE') && /^\/api\/v1\/works\/[^/]+\/like\/?$/.test(pathname)) return 'like';
  return null;
}

function emptyMetrics() {
  return { landing: 0, build: 0, plaza: 0, work: 0, publish: 0, remix: 0, like: 0 };
}

function increment(target, event) {
  target[event] += 1;
}

function percent(numerator, denominator) {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : '—';
}

function table(report) {
  const columns = ['Source', 'Landing', 'Build', 'Build rate', 'Plaza', 'Work', 'Publish', 'Remix', 'Like'];
  const divider = columns.map(() => '---');
  const rows = [...report.sources.entries()]
    .sort((a, b) => (b[1].landing + b[1].build) - (a[1].landing + a[1].build))
    .map(([source, metrics]) => [
      source,
      metrics.landing,
      metrics.build,
      percent(metrics.build, metrics.landing),
      metrics.plaza,
      metrics.work,
      metrics.publish,
      metrics.remix,
      metrics.like,
    ]);
  const total = report.total;
  rows.push(['**Total**', total.landing, total.build, percent(total.build, total.landing), total.plaza, total.work, total.publish, total.remix, total.like]);
  return [columns, divider, ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

const logPath = option('log', DEFAULT_LOG);
const sinceInput = option('since', '24h');
const format = option('format', 'markdown');
const since = parseSince(sinceInput);
const input = logPath === '-' ? process.stdin : createReadStream(logPath, { encoding: 'utf8' });
const lines = createInterface({ input, crlfDelay: Infinity });
const report = {
  since: since.toISOString(),
  generatedAt: new Date().toISOString(),
  total: emptyMetrics(),
  sources: new Map(),
  campaigns: new Map(),
  ignoredBots: 0,
  malformedLines: 0,
};

for await (const line of lines) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    report.malformedLines += 1;
    continue;
  }

  const timestamp = new Date(entry.ts);
  if (Number.isNaN(timestamp.getTime()) || timestamp < since) continue;
  if (BOT_PATTERN.test(String(entry.ua || ''))) {
    report.ignoredBots += 1;
    continue;
  }
  if (Number(entry.status) >= 400) continue;

  const requestUrl = safeUrl(entry.uri);
  if (!requestUrl) continue;
  const event = eventFor(String(entry.method || 'GET').toUpperCase(), requestUrl.pathname);
  if (!event) continue;

  const source = sourceFor(requestUrl, entry.referrer);
  const campaign = campaignFor(requestUrl, entry.referrer);
  const sourceMetrics = report.sources.get(source) || emptyMetrics();
  const campaignMetrics = report.campaigns.get(campaign) || emptyMetrics();
  increment(report.total, event);
  increment(sourceMetrics, event);
  increment(campaignMetrics, event);
  report.sources.set(source, sourceMetrics);
  report.campaigns.set(campaign, campaignMetrics);
}

const serializable = {
  ...report,
  sources: Object.fromEntries(report.sources),
  campaigns: Object.fromEntries(report.campaigns),
};

if (format === 'json') {
  process.stdout.write(`${JSON.stringify(serializable, null, 2)}\n`);
} else {
  console.log(`# Digital Bricks campaign report`);
  console.log(`\nWindow: ${report.since} → ${report.generatedAt}`);
  console.log(`\n${table(report)}`);
  console.log(`\nCampaigns: ${[...report.campaigns.keys()].sort().join(', ') || 'none'}`);
  console.log(`Bots filtered: ${report.ignoredBots}; malformed lines: ${report.malformedLines}.`);
  console.log('Build rate is a page-view ratio, not a unique-user conversion rate.');
}
