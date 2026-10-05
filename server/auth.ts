import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import type { RowDataPacket } from 'mysql2';
import { getDatabasePool } from './db.js';
import { verifyAccountContext } from './security.js';

interface IntentRow extends RowDataPacket {
  user_id: string;
  kind: 'register' | 'recover';
  used_at: Date | null;
  expires_at: Date;
  nickname: string;
}

const productionUrl = 'https://lego-x.vercel.app';
const baseURL = process.env.BETTER_AUTH_URL || (process.env.NODE_ENV === 'production'
  ? productionUrl
  : 'http://localhost:5173');
const rpID = process.env.WEBAUTHN_RP_ID || new URL(baseURL).hostname;

async function resolveContext(context?: string | null) {
  const payload = verifyAccountContext(context);
  const [rows] = await getDatabasePool().query<IntentRow[]>(
    `SELECT i.user_id, i.kind, i.used_at, i.expires_at, p.nickname
       FROM account_intents i
       JOIN profiles p ON p.user_id = i.user_id
      WHERE i.id = ? AND i.user_id = ? LIMIT 1`,
    [payload.intentId, payload.sub],
  );
  const intent = rows[0];
  if (!intent || intent.kind !== payload.kind || intent.used_at || intent.expires_at.getTime() < Date.now()) {
    throw new Error('账户操作凭证已过期');
  }
  return { payload, intent };
}

export const auth = betterAuth({
  appName: 'Digital Bricks',
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: getDatabasePool(),
  trustedOrigins: [productionUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  session: {
    // A child's own device should stay signed in until they choose “退出登录”.
    // Active sessions are renewed weekly and still use secure HttpOnly cookies.
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24 * 7,
    cookieCache: { enabled: false },
  },
  advanced: {
    useSecureCookies: baseURL.startsWith('https://'),
    cookiePrefix: 'legox',
  },
  plugins: [
    passkey({
      rpID,
      rpName: 'Digital Bricks',
      origin: baseURL,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
      registration: {
        requireSession: false,
        resolveUser: async ({ context }) => {
          const { payload, intent } = await resolveContext(context);
          return { id: payload.sub, name: payload.sub, displayName: intent.nickname };
        },
        afterVerification: async ({ context }) => {
          const { payload } = await resolveContext(context);
          await getDatabasePool().execute(
            'UPDATE account_intents SET used_at = CURRENT_TIMESTAMP(3) WHERE id = ? AND used_at IS NULL',
            [payload.intentId],
          );
          return { userId: payload.sub, name: payload.kind === 'recover' ? '恢复后的设备' : '第一台设备' };
        },
      },
    }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
