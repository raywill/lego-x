import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getDatabasePool, withTransaction } from '../../server/db.js';
import { getSession, getCookie, getRoute, readJson, requireSession, sendError, sendJson, setCookie, setNoStore } from '../../server/http.js';
import { createAccountContext, createPublicId, createRecoveryCode, digestRecoveryCode, hashGuardianPin, parseRecoveryPublicId, verifyAccountContext, verifyGuardianPin } from '../../server/security.js';
import { COMMUNITY_CATALOG_VERSION, MAX_THUMBNAIL_BYTES, validatePublishedProject, type CurrentUser, type PublicProfile, type PublicWork, type PublicWorkSummary, type PublishedProject } from '../../shared/community.js';

interface ProfileRow extends RowDataPacket { user_id: string; public_id: string; nickname: string; guardian_pin_hash: string; guardian_approved_at: Date | null; guardian_locked_until?: Date | null; account_status: string; }
interface IntentRow extends RowDataPacket { id: string; user_id: string; kind: 'register' | 'recover'; used_at: Date | null; completed_at: Date | null; expires_at: Date; }
interface WorkRow extends RowDataPacket { id: string; owner_user_id: string; title: string; status: string; current_version_id: string; source_work_id: string | null; source_version_id: string | null; published_at: Date; version_id: string; project_json: string | PublishedProject; brick_count: number; connection_count: number; public_id: string; nickname: string; source_nickname: string | null; source_status: string | null; likes: number; views: number; remixes: number; hot_score: number; }

const todaySql = 'UTC_DATE()';

function validNickname(value: unknown): string {
  const nickname = typeof value === 'string' ? value.trim() : '';
  if (!nickname || nickname.length > 40 || /[\u0000-\u001f\u007f]/.test(nickname)) throw new Error('昵称需要 1–40 个字符');
  return nickname;
}

function validTitle(value: unknown): string {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title || title.length > 80 || /[\u0000-\u001f\u007f]/.test(title) || /https?:\/\//i.test(title)) throw new Error('作品标题需要 1–80 个字符，不能包含链接');
  return title;
}

function validGuardianPin(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) throw new Error('监护 PIN 需要 6 位数字');
  return value;
}

function parseProject(value: unknown): PublishedProject {
  return validatePublishedProject(value);
}

function parseThumbnail(value: unknown): Buffer {
  if (typeof value !== 'string' || !value.startsWith('data:image/')) throw new Error('缺少作品缩略图');
  const comma = value.indexOf(',');
  if (comma < 0) throw new Error('缩略图格式不正确');
  const data = Buffer.from(value.slice(comma + 1), 'base64');
  if (!data.length || data.length > MAX_THUMBNAIL_BYTES) throw new Error('缩略图太大');
  return data;
}

function publicWorkFromRow(row: WorkRow, project?: PublishedProject): PublicWorkSummary | PublicWork {
  const base: PublicWorkSummary = {
    id: row.id,
    title: row.title,
    author: { publicId: row.public_id, nickname: row.nickname },
    thumbnailUrl: `/api/thumbnail?version=${encodeURIComponent(row.version_id)}`,
    publishedAt: new Date(row.published_at).toISOString(),
    brickCount: Number(row.brick_count),
    connectionCount: Number(row.connection_count),
    likes: Number(row.likes || 0),
    views: Number(row.views || 0),
    remixes: Number(row.remixes || 0),
    ...(row.hot_score === undefined ? {} : { hotScore: Number(row.hot_score || 0) }),
    ...(row.source_work_id && row.source_version_id && row.source_nickname
      ? { remixOf: { workId: row.source_work_id, versionId: row.source_version_id, authorNickname: row.source_nickname } }
      : {}),
  };
  return project ? { ...base, versionId: row.version_id, project, ...(row.source_status ? { sourceStatus: row.source_status as PublicWork['sourceStatus'] } : {}) } : base;
}

async function workRows(where: string, params: unknown[], limit?: number): Promise<WorkRow[]> {
  const suffix = limit === undefined ? '' : ` LIMIT ${Math.max(1, Math.min(50, limit))}`;
  const [rows] = await getDatabasePool().query<WorkRow[]>(
    `SELECT w.id, w.owner_user_id, w.title, w.status, w.current_version_id, w.source_work_id, w.source_version_id,
            w.published_at, v.id AS version_id, v.project_json, v.brick_count, v.connection_count,
            p.public_id, p.nickname, sp.nickname AS source_nickname, sw.status AS source_status,
            COALESCE(SUM(m.likes), 0) AS likes, COALESCE(SUM(m.views), 0) AS views,
            COALESCE(SUM(m.remixes), 0) AS remixes,
            COALESCE(SUM(POW(0.85, DATEDIFF(UTC_DATE(), m.metric_day)) * (m.views + 3 * m.likes + 5 * m.remixes)), 0) AS hot_score
       FROM works w
       JOIN work_versions v ON v.id = w.current_version_id
       JOIN profiles p ON p.user_id = w.owner_user_id
       LEFT JOIN works sw ON sw.id = w.source_work_id
       LEFT JOIN profiles sp ON sp.user_id = sw.owner_user_id
       LEFT JOIN work_daily_metrics m ON m.work_id = w.id AND m.metric_day >= DATE_SUB(UTC_DATE(), INTERVAL 6 DAY)
      WHERE ${where}
      GROUP BY w.id, v.id, p.public_id, p.nickname, sp.nickname, sw.status
      ORDER BY hot_score DESC, w.published_at DESC${suffix}`,
    params,
  );
  return rows;
}

async function getWork(workId: string, viewerId?: string): Promise<PublicWork | null> {
  const rows = await workRows('w.id = ? AND w.status = \'published\'', [workId], 1);
  const row = rows[0];
  if (!row) return null;
  const project = typeof row.project_json === 'string' ? JSON.parse(row.project_json) as PublishedProject : row.project_json;
  const result = publicWorkFromRow(row, project) as PublicWork;
  if (viewerId) {
    const [liked] = await getDatabasePool().query<RowDataPacket[]>('SELECT 1 FROM likes WHERE work_id = ? AND user_id = ? LIMIT 1', [workId, viewerId]);
    result.likedByViewer = liked.length > 0;
  }
  return result;
}

async function currentUser(request: VercelRequest): Promise<CurrentUser | null> {
  const session = await getSession(request);
  if (!session) return null;
  const [rows] = await getDatabasePool().query<ProfileRow[]>('SELECT user_id, public_id, nickname, guardian_approved_at, account_status, guardian_pin_hash FROM profiles WHERE user_id = ? LIMIT 1', [session.user.id]);
  const profile = rows[0];
  if (!profile || profile.account_status !== 'active') return null;
  return { userId: profile.user_id, publicId: profile.public_id, nickname: profile.nickname, guardianApproved: Boolean(profile.guardian_approved_at) };
}

async function recordWorkView(workId: string, request: VercelRequest, response: VercelResponse): Promise<void> {
  const visitor = getCookie(request, 'lx_visitor') || randomBytes(18).toString('base64url');
  if (!getCookie(request, 'lx_visitor')) setCookie(response, 'lx_visitor', visitor, 60 * 60 * 24 * 365);
  const visitorHash = createHmac('sha256', process.env.ACCOUNT_CONTEXT_SECRET || 'dev').update(visitor).digest('hex');
  const [inserted] = await getDatabasePool().execute<ResultSetHeader>(`INSERT IGNORE INTO view_uniques (work_id, visitor_hash, view_day) VALUES (?, ?, ${todaySql})`, [workId, visitorHash]);
  if (inserted.affectedRows) await getDatabasePool().execute(`INSERT INTO work_daily_metrics (work_id, metric_day, views) VALUES (?, ${todaySql}, 1) ON DUPLICATE KEY UPDATE views = views + 1`, [workId]);
}

async function handleAccount(request: VercelRequest, response: VercelResponse, route: string[]): Promise<boolean> {
  if (route[1] === 'register' && route[2] === 'start' && request.method === 'POST') {
    const body = await readJson<{ nickname?: unknown; guardianPin?: unknown }>(request);
    const nickname = validNickname(body.nickname);
    const guardianPin = validGuardianPin(body.guardianPin);
    const userId = randomUUID();
    const publicId = createPublicId();
    const intentId = randomUUID();
    const now = Date.now();
    const pinHash = await hashGuardianPin(guardianPin);
    await withTransaction(async (connection) => {
      await connection.execute('INSERT INTO `user` (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, FALSE, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))', [userId, nickname, `user-${userId}@users.lego-x.invalid`]);
      await connection.execute('INSERT INTO profiles (user_id, public_id, nickname, guardian_pin_hash) VALUES (?, ?, ?, ?)', [userId, publicId, nickname, pinHash]);
      await connection.execute('INSERT INTO account_intents (id, user_id, kind, nonce, nickname, expires_at) VALUES (?, ?, \'register\', ?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE))', [intentId, userId, randomUUID(), nickname]);
    });
    sendJson(response, 200, { context: createAccountContext({ kind: 'register', sub: userId, intentId }), publicId, userId, expiresAt: new Date(now + 10 * 60_000).toISOString() });
    return true;
  }
  if (route[1] === 'register' && route[2] === 'complete' && request.method === 'POST') {
    const session = await requireSession(request, response); if (!session) return true;
    const [intents] = await getDatabasePool().query<IntentRow[]>('SELECT id, user_id, kind, used_at, completed_at, expires_at FROM account_intents WHERE user_id = ? AND kind = \'register\' AND used_at IS NOT NULL ORDER BY used_at DESC LIMIT 1', [session.user.id]);
    const intent = intents[0];
    if (!intent || intent.completed_at) { sendError(response, 409, '注册已经完成'); return true; }
    const [keys] = await getDatabasePool().query<RowDataPacket[]>('SELECT id FROM passkey WHERE userId = ? LIMIT 1', [session.user.id]);
    if (!keys.length) { sendError(response, 409, '请先完成 Passkey 注册'); return true; }
    const recovery = createRecoveryCode((await currentUser(request))?.publicId || 'ACCOUNT');
    await withTransaction(async (connection) => {
      await connection.execute('INSERT INTO recovery_credentials (id, user_id, digest) VALUES (?, ?, ?)', [randomUUID(), session.user.id, recovery.digest]);
      await connection.execute('UPDATE account_intents SET completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [intent.id]);
    });
    sendJson(response, 200, { recoveryCode: recovery.code, message: '请把恢复资料保存到安全的地方，它只会显示一次。' });
    return true;
  }
  if (route[1] === 'recover' && route[2] === 'start' && request.method === 'POST') {
    const body = await readJson<{ recoveryCode?: unknown }>(request);
    const code = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim().toUpperCase() : '';
    const publicId = parseRecoveryPublicId(code);
    if (!publicId) { sendError(response, 400, '恢复资料格式不正确'); return true; }
    const [rows] = await getDatabasePool().query<(ProfileRow & RowDataPacket)[]>('SELECT p.user_id, p.public_id, p.nickname, p.guardian_pin_hash, p.guardian_approved_at, p.account_status, r.id AS recovery_id FROM profiles p JOIN recovery_credentials r ON r.user_id = p.user_id WHERE p.public_id = ? AND r.digest = ? AND r.used_at IS NULL AND p.account_status = \'active\' LIMIT 1', [publicId, digestRecoveryCode(code)]);
    const profile = rows[0];
    if (!profile) { sendError(response, 401, '恢复资料不正确或已经使用'); return true; }
    const intentId = randomUUID();
    await getDatabasePool().execute('INSERT INTO account_intents (id, user_id, kind, nonce, nickname, expires_at) VALUES (?, ?, \'recover\', ?, ?, DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 10 MINUTE))', [intentId, profile.user_id, randomUUID(), profile.nickname]);
    sendJson(response, 200, { context: createAccountContext({ kind: 'recover', sub: profile.user_id, intentId }), publicId });
    return true;
  }
  if (route[1] === 'recover' && route[2] === 'complete' && request.method === 'POST') {
    const session = await requireSession(request, response); if (!session) return true;
    const body = await readJson<{ passkeyId?: unknown }>(request);
    const [intents] = await getDatabasePool().query<IntentRow[]>('SELECT id, user_id, kind, used_at, completed_at, expires_at FROM account_intents WHERE user_id = ? AND kind = \'recover\' AND used_at IS NOT NULL AND completed_at IS NULL ORDER BY used_at DESC LIMIT 1', [session.user.id]);
    const intent = intents[0];
    if (!intent) { sendError(response, 409, '恢复流程已过期，请重新开始'); return true; }
    const passkeyId = typeof body.passkeyId === 'string' ? body.passkeyId : '';
    const [keys] = await getDatabasePool().query<RowDataPacket[]>('SELECT id FROM passkey WHERE id = ? AND userId = ? LIMIT 1', [passkeyId, session.user.id]);
    if (!keys.length) { sendError(response, 400, '没有找到刚刚添加的 Passkey'); return true; }
    const profile = await currentUser(request);
    if (!profile) { sendError(response, 404, '账户不存在'); return true; }
    const recovery = createRecoveryCode(profile.publicId);
    await withTransaction(async (connection) => {
      await connection.execute('DELETE FROM passkey WHERE userId = ? AND id <> ?', [session.user.id, passkeyId]);
      await connection.execute('DELETE FROM session WHERE userId = ? AND id <> ?', [session.user.id, session.session.id]);
      await connection.execute('UPDATE recovery_credentials SET used_at = CURRENT_TIMESTAMP(3) WHERE user_id = ? AND used_at IS NULL', [session.user.id]);
      await connection.execute('INSERT INTO recovery_credentials (id, user_id, digest) VALUES (?, ?, ?)', [randomUUID(), session.user.id, recovery.digest]);
      await connection.execute('UPDATE account_intents SET completed_at = CURRENT_TIMESTAMP(3) WHERE id = ?', [intent.id]);
    });
    sendJson(response, 200, { recoveryCode: recovery.code });
    return true;
  }
  if (route[1] === 'me' && request.method === 'GET') {
    setNoStore(response);
    const user = await currentUser(request);
    sendJson(response, 200, user);
    return true;
  }
  if (route[1] === 'nickname' && request.method === 'PATCH') {
    const session = await requireSession(request, response); if (!session) return true;
    const body = await readJson<{ nickname?: unknown }>(request);
    const nickname = validNickname(body.nickname);
    await getDatabasePool().execute('UPDATE profiles SET nickname = ?, updated_at = CURRENT_TIMESTAMP(3) WHERE user_id = ?', [nickname, session.user.id]);
    await getDatabasePool().execute('UPDATE `user` SET name = ?, updatedAt = CURRENT_TIMESTAMP(3) WHERE id = ?', [nickname, session.user.id]);
    sendJson(response, 200, { nickname });
    return true;
  }
  return false;
}

async function handleWorks(request: VercelRequest, response: VercelResponse, route: string[]): Promise<boolean> {
  if (route[0] === 'plaza' && request.method === 'GET') {
    const rows = await workRows('w.status = \'published\'', [], 50);
    sendJson(response, 200, { works: rows.map((row) => publicWorkFromRow(row)) });
    return true;
  }
  if (route[0] === 'profiles' && route[1] && request.method === 'GET') {
    const [profiles] = await getDatabasePool().query<ProfileRow[]>('SELECT user_id, public_id, nickname, guardian_pin_hash, guardian_approved_at, account_status FROM profiles WHERE public_id = ? LIMIT 1', [route[1]]);
    const profile = profiles[0];
    if (!profile) { sendError(response, 404, '没有找到这个个人空间'); return true; }
    const rows = await workRows('w.owner_user_id = ? AND w.status = \'published\'', [profile.user_id]);
    const result: PublicProfile = { publicId: profile.public_id, nickname: profile.nickname, works: rows.map((row) => publicWorkFromRow(row)) };
    sendJson(response, 200, result);
    return true;
  }
  if (route[0] === 'works' && route.length === 1 && request.method === 'POST') {
    const session = await requireSession(request, response); if (!session) return true;
    const body = await readJson<{ title?: unknown; project?: unknown; thumbnail?: unknown; guardianPin?: unknown; workId?: unknown }>(request);
    const title = validTitle(body.title);
    const project = parseProject(body.project);
    const thumbnail = parseThumbnail(body.thumbnail);
    const existingWorkId = typeof body.workId === 'string' ? body.workId : null;
    const profileRows = await getDatabasePool().query<ProfileRow[]>('SELECT user_id, public_id, nickname, guardian_pin_hash, guardian_approved_at, guardian_locked_until, account_status FROM profiles WHERE user_id = ? LIMIT 1', [session.user.id]);
    const profile = profileRows[0][0];
    if (!profile) { sendError(response, 404, '账户资料不存在'); return true; }
    if (!profile.guardian_approved_at) {
      const pin = validGuardianPin(body.guardianPin);
      const locked = profile.guardian_locked_until && profile.guardian_locked_until.getTime() > Date.now();
      if (locked || !(await verifyGuardianPin(pin, profile.guardian_pin_hash))) {
        await getDatabasePool().execute('UPDATE profiles SET guardian_failed_attempts = guardian_failed_attempts + 1, guardian_locked_until = CASE WHEN guardian_failed_attempts >= 4 THEN DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 15 MINUTE) ELSE guardian_locked_until END WHERE user_id = ?', [session.user.id]);
        sendError(response, 403, locked ? '监护 PIN 暂时锁定，请稍后再试' : '监护 PIN 不正确'); return true;
      }
      await getDatabasePool().execute('UPDATE profiles SET guardian_approved_at = CURRENT_TIMESTAMP(3), guardian_failed_attempts = 0, guardian_locked_until = NULL WHERE user_id = ?', [session.user.id]);
    }
    const origin = project.provenance;
    const id = existingWorkId || randomUUID();
    const versionId = randomUUID();
    const result = await withTransaction(async (connection) => {
      if (existingWorkId) {
        const [owned] = await connection.query<RowDataPacket[]>('SELECT id FROM works WHERE id = ? AND owner_user_id = ? AND status <> \'hidden\' LIMIT 1', [existingWorkId, session.user.id]);
        if (!owned.length) throw new Error('不能修改这件作品');
      } else {
        let sourceWorkId: string | null = null; let sourceVersionId: string | null = null; let rootWorkId: string | null = null;
        if (origin) {
          const [source] = await connection.query<RowDataPacket[]>('SELECT w.id, w.root_work_id, w.status FROM works w JOIN work_versions v ON v.id = w.current_version_id WHERE w.id = ? AND v.id = ? AND w.status = \'published\' LIMIT 1', [origin.sourceWorkId, origin.sourceVersionId]);
          if (!source.length) throw new Error('二创来源已经不可用');
          sourceWorkId = origin.sourceWorkId; sourceVersionId = origin.sourceVersionId; rootWorkId = source[0].root_work_id || sourceWorkId;
        }
        await connection.execute('INSERT INTO works (id, owner_user_id, title, status, source_work_id, source_version_id, root_work_id) VALUES (?, ?, ?, \'published\', ?, ?, ?)', [id, session.user.id, title, sourceWorkId, sourceVersionId, rootWorkId]);
      }
      await connection.execute('INSERT INTO work_versions (id, work_id, project_version, catalog_version, project_json, thumbnail, thumbnail_mime, brick_count, connection_count) VALUES (?, ?, ?, ?, ?, ?, \'image/webp\', ?, ?)', [versionId, id, project.version, COMMUNITY_CATALOG_VERSION, JSON.stringify(project), thumbnail, project.bricks.length, project.connections.length]);
      await connection.execute('UPDATE works SET title = ?, current_version_id = ?, published_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3), status = \'published\' WHERE id = ?', [title, versionId, id]);
      if (!existingWorkId && origin) await connection.execute(`INSERT INTO work_daily_metrics (work_id, metric_day, remixes) VALUES (?, ${todaySql}, 1) ON DUPLICATE KEY UPDATE remixes = remixes + 1`, [origin.sourceWorkId]);
      return { id, versionId };
    });
    const work = await getWork(result.id, session.user.id);
    sendJson(response, 200, work);
    return true;
  }
  if (route[0] === 'works' && route[1] && route[2] === 'like' && request.method === 'POST') {
    const session = await requireSession(request, response); if (!session) return true;
    const [works] = await getDatabasePool().query<RowDataPacket[]>('SELECT owner_user_id FROM works WHERE id = ? AND status = \'published\' LIMIT 1', [route[1]]);
    if (!works.length) { sendError(response, 404, '作品不存在'); return true; }
    if (works[0].owner_user_id === session.user.id) { sendError(response, 400, '不能给自己的作品点赞'); return true; }
    const [inserted] = await getDatabasePool().execute<ResultSetHeader>('INSERT IGNORE INTO likes (work_id, user_id) VALUES (?, ?)', [route[1], session.user.id]);
    if (inserted.affectedRows) await getDatabasePool().execute(`INSERT INTO work_daily_metrics (work_id, metric_day, likes) VALUES (?, ${todaySql}, 1) ON DUPLICATE KEY UPDATE likes = likes + 1`, [route[1]]);
    sendJson(response, 200, { liked: true }); return true;
  }
  if (route[0] === 'works' && route[1] && route[2] === 'like' && request.method === 'DELETE') {
    const session = await requireSession(request, response); if (!session) return true;
    const [deleted] = await getDatabasePool().execute<ResultSetHeader>('DELETE FROM likes WHERE work_id = ? AND user_id = ?', [route[1], session.user.id]);
    if (deleted.affectedRows) await getDatabasePool().execute(`INSERT INTO work_daily_metrics (work_id, metric_day, likes) VALUES (?, ${todaySql}, 0) ON DUPLICATE KEY UPDATE likes = GREATEST(0, likes - 1)`, [route[1]]);
    sendJson(response, 200, { liked: false }); return true;
  }
  if (route[0] === 'works' && route[1] && route[2] === 'view' && request.method === 'POST') {
    await recordWorkView(route[1], request, response);
    response.status(204).end(); return true;
  }
  if (route[0] === 'works' && route[1] && route[2] === 'report' && request.method === 'POST') {
    const session = await requireSession(request, response); if (!session) return true;
    const body = await readJson<{ reason?: unknown }>(request);
    const reasons = new Set(['不适合儿童', '侵权或冒用', '广告或垃圾内容', '其他']);
    const reason = typeof body.reason === 'string' && reasons.has(body.reason) ? body.reason : '其他';
    await getDatabasePool().execute('INSERT INTO reports (id, work_id, reporter_user_id, reason) VALUES (?, ?, ?, ?)', [randomUUID(), route[1], session.user.id, reason]);
    sendJson(response, 200, { reported: true }); return true;
  }
  if (route[0] === 'works' && route[1] && route[2] === 'remix' && request.method === 'GET') {
    const session = await requireSession(request, response); if (!session) return true;
    const work = await getWork(route[1], session.user.id);
    if (!work) { sendError(response, 404, '作品不存在或已经下架'); return true; }
    sendJson(response, 200, work); return true;
  }
  if (route[0] === 'works' && route[1] && route[2] === 'unpublish' && request.method === 'POST') {
    const session = await requireSession(request, response); if (!session) return true;
    const [result] = await getDatabasePool().execute<ResultSetHeader>('UPDATE works SET status = \'unpublished\', updated_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND owner_user_id = ? AND status = \'published\'', [route[1], session.user.id]);
    if (!result.affectedRows) { sendError(response, 404, '作品不存在或无权操作'); return true; }
    sendJson(response, 200, { unpublished: true }); return true;
  }
  if (route[0] === 'works' && route[1] && request.method === 'GET') {
    const viewer = await currentUser(request);
    const work = await getWork(route[1], viewer?.userId);
    if (!work) { sendError(response, 404, '作品不存在或已经下架'); return true; }
    await recordWorkView(route[1], request, response);
    sendJson(response, 200, work); return true;
  }
  if (route[0] === 'work-versions' && route[1] && route[2] === 'thumbnail' && request.method === 'GET') {
    const [rows] = await getDatabasePool().query<RowDataPacket[]>('SELECT thumbnail, thumbnail_mime FROM work_versions WHERE id = ? LIMIT 1', [route[1]]);
    const row = rows[0]; if (!row) { response.status(404).end(); return true; }
    response.setHeader('content-type', row.thumbnail_mime || 'image/webp');
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.status(200).send(row.thumbnail); return true;
  }
  return false;
}

export default async function apiHandler(request: VercelRequest, response: VercelResponse) {
  response.setHeader('x-content-type-options', 'nosniff');
  try {
    const route = getRoute(request);
    if (route[0] === 'account' && await handleAccount(request, response, route)) return;
    if (await handleWorks(request, response, route)) return;
    sendError(response, 404, '找不到这个接口');
  } catch (error) {
    const message = error instanceof Error ? error.message : '服务器暂时无法完成操作';
    sendError(response, /请先|登录|无权|不能|不存在|格式|PIN|标题|作品|恢复|账户|太大|过期|二创|注册/.test(message) ? 400 : 500, message);
  }
}
