import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createGunzip } from 'node:zlib';
import { basename, dirname, join } from 'node:path';
import { createInterface } from 'node:readline';

const DEFAULT_LOG = '/home/wwwlogs/bricks.reactshare.cn.campaign.jsonl';
const ROUTES = new Set(['start', 'build', 'plaza', 'work']);

function option(name, fallback) {
  const prefix = `--${name}=`;
  const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length) : fallback;
}

function parseDate(value, name, allowRelative = false) {
  if (allowRelative) {
    const relative = /^(\d+)([hdw])$/.exec(value);
    if (relative) {
      const amount = Number(relative[1]);
      const unit = relative[2] === 'h' ? 3_600_000 : relative[2] === 'd' ? 86_400_000 : 604_800_000;
      return new Date(Date.now() - amount * unit);
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid --${name} value: ${value}`);
  return parsed;
}

function emptyMetrics() {
  return { start: 0, build: 0, startToBuild: 0, plaza: 0, work: 0 };
}

function increment(metrics, route, transition) {
  metrics[route] += 1;
  if (transition === 'start_to_build') metrics.startToBuild += 1;
}

function percent(numerator, denominator) {
  return denominator ? `${Math.round((numerator / denominator) * 100)}%` : '—';
}

function sourceFor(entry) {
  return String(entry.utm_source || entry.referrer_host || 'direct').toLowerCase();
}

function campaignFor(entry) {
  return String(entry.utm_campaign || 'none').toLowerCase();
}

function escapePattern(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function campaignLogPaths(logPath) {
  const directory = dirname(logPath);
  const filename = basename(logPath);
  const rotated = new RegExp(`^${escapePattern(filename)}\\.\\d+(?:\\.gz)?$`);
  let names;
  try {
    names = await readdir(directory);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  return names
    .filter((name) => name === filename || rotated.test(name))
    .sort((left, right) => left.localeCompare(right, 'en', { numeric: true }))
    .map((name) => join(directory, name));
}

async function* campaignLines(logPath) {
  if (logPath === '-') {
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of lines) yield line;
    return;
  }

  for (const path of await campaignLogPaths(logPath)) {
    const file = createReadStream(path);
    const input = path.endsWith('.gz') ? file.pipe(createGunzip()) : file;
    const lines = createInterface({ input, crlfDelay: Infinity });
    for await (const line of lines) yield line;
  }
}

function metricsTable(groups, total, firstColumn) {
  const columns = [firstColumn, 'Start views', 'Build views', 'Start → build', 'Transition rate', 'Plaza views', 'Work views'];
  const divider = columns.map(() => '---');
  const rows = [...groups.entries()]
    .sort((a, b) => (b[1].start + b[1].build) - (a[1].start + a[1].build))
    .map(([name, metrics]) => [
      name,
      metrics.start,
      metrics.build,
      metrics.startToBuild,
      percent(metrics.startToBuild, metrics.start),
      metrics.plaza,
      metrics.work,
    ]);
  rows.push([
    '**Total**',
    total.start,
    total.build,
    total.startToBuild,
    percent(total.startToBuild, total.start),
    total.plaza,
    total.work,
  ]);
  return [columns, divider, ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

const logPath = option('log', DEFAULT_LOG);
const fromInput = option('from');
const sinceInput = option('since', '24h');
const toInput = option('to');
const format = option('format', 'markdown');
const sourceFilter = option('source')?.toLowerCase();
const campaignFilter = option('campaign')?.toLowerCase();
const from = fromInput ? parseDate(fromInput, 'from') : parseDate(sinceInput, 'since', true);
const to = toInput ? parseDate(toInput, 'to') : new Date();

if (to <= from) throw new Error('--to must be later than the report start time');
if (!['markdown', 'json'].includes(format)) throw new Error('--format must be markdown or json');

const report = {
  from: from.toISOString(),
  to: to.toISOString(),
  generatedAt: new Date().toISOString(),
  total: emptyMetrics(),
  sources: new Map(),
  campaigns: new Map(),
  conversionContent: new Map(),
  minuteBursts: new Map(),
  malformedLines: 0,
};

for await (const line of campaignLines(logPath)) {
  if (!line.trim()) continue;
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    report.malformedLines += 1;
    continue;
  }

  const timestamp = new Date(entry.ts);
  const route = String(entry.route || '');
  if (Number.isNaN(timestamp.getTime()) || timestamp < from || timestamp >= to) continue;
  if (Number(entry.status) !== 204 || !ROUTES.has(route)) continue;

  const source = sourceFor(entry);
  const campaign = campaignFor(entry);
  if (sourceFilter && source !== sourceFilter) continue;
  if (campaignFilter && campaign !== campaignFilter) continue;

  const transition = entry.transition === 'start_to_build' ? 'start_to_build' : '';
  const sourceMetrics = report.sources.get(source) || emptyMetrics();
  const campaignMetrics = report.campaigns.get(campaign) || emptyMetrics();
  increment(report.total, route, transition);
  increment(sourceMetrics, route, transition);
  increment(campaignMetrics, route, transition);
  report.sources.set(source, sourceMetrics);
  report.campaigns.set(campaign, campaignMetrics);

  if (transition) {
    const content = String(entry.utm_content || 'unspecified').toLowerCase();
    report.conversionContent.set(content, (report.conversionContent.get(content) || 0) + 1);
  }

  const minute = timestamp.toISOString().slice(0, 16);
  const burstKey = `${minute}|${source}|${route}`;
  report.minuteBursts.set(burstKey, (report.minuteBursts.get(burstKey) || 0) + 1);
}

const suspiciousBursts = [...report.minuteBursts.entries()]
  .filter(([, count]) => count > 30)
  .map(([key, count]) => ({ key, count }));
const serializable = {
  from: report.from,
  to: report.to,
  generatedAt: report.generatedAt,
  filters: { source: sourceFilter || null, campaign: campaignFilter || null },
  total: report.total,
  sources: Object.fromEntries(report.sources),
  campaigns: Object.fromEntries(report.campaigns),
  conversionContent: Object.fromEntries(report.conversionContent),
  suspiciousBursts,
  malformedLines: report.malformedLines,
};

if (format === 'json') {
  process.stdout.write(`${JSON.stringify(serializable, null, 2)}\n`);
} else {
  console.log('# Digital Bricks campaign report');
  console.log(`\nWindow: ${report.from} → ${report.to}`);
  if (sourceFilter || campaignFilter) {
    console.log(`Filters: source=${sourceFilter || 'all'}, campaign=${campaignFilter || 'all'}`);
  }
  console.log(`\n## By source\n\n${metricsTable(report.sources, report.total, 'Source')}`);
  console.log(`\n## By campaign\n\n${metricsTable(report.campaigns, report.total, 'Campaign')}`);
  if (report.conversionContent.size) {
    console.log('\n## Start → build CTA');
    for (const [content, count] of [...report.conversionContent.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`\n- ${content}: ${count}`);
    }
  }
  console.log(`\nSuspicious bursts (>30 events for one source and route in one minute): ${suspiciousBursts.length}.`);
  console.log(`Malformed lines: ${report.malformedLines}. Bots are filtered before this anonymous log is written.`);
  console.log('Views and transitions are event counts, not unique visitors. Transition rate is start → build transitions divided by start page views.');
}
