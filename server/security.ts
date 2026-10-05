import { createHmac, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export type AccountIntentKind = 'register' | 'recover';

export interface AccountContextPayload {
  kind: AccountIntentKind;
  sub: string;
  intentId: string;
  nonce: string;
  exp: number;
}

function secret(): string {
  const value = process.env.ACCOUNT_CONTEXT_SECRET || process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error('ACCOUNT_CONTEXT_SECRET or BETTER_AUTH_SECRET is not configured.');
  return value;
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(encodedPayload: string): string {
  return createHmac('sha256', secret()).update(encodedPayload).digest('base64url');
}

export function createAccountContext(
  payload: Omit<AccountContextPayload, 'nonce' | 'exp'>,
  lifetimeSeconds = 10 * 60,
): string {
  const value: AccountContextPayload = {
    ...payload,
    nonce: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + lifetimeSeconds,
  };
  const encoded = encode(JSON.stringify(value));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAccountContext(token: string | null | undefined): AccountContextPayload {
  if (!token) throw new Error('缺少账户操作凭证');
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) throw new Error('账户操作凭证无效');
  const expected = sign(encoded);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new Error('账户操作凭证无效');
  }
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as AccountContextPayload;
  if (
    !payload.sub || !payload.intentId || !payload.nonce
    || (payload.kind !== 'register' && payload.kind !== 'recover')
    || payload.exp < Math.floor(Date.now() / 1000)
  ) {
    throw new Error('账户操作凭证已过期');
  }
  return payload;
}

export async function hashGuardianPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(`${pin}:${secret()}`, salt, 32) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`;
}

export async function verifyGuardianPin(pin: string, stored: string): Promise<boolean> {
  const [algorithm, saltText, digestText] = stored.split('$');
  if (algorithm !== 'scrypt' || !saltText || !digestText) return false;
  const digest = Buffer.from(digestText, 'base64url');
  const derived = await scrypt(`${pin}:${secret()}`, Buffer.from(saltText, 'base64url'), digest.length) as Buffer;
  return digest.length === derived.length && timingSafeEqual(digest, derived);
}

export function createRecoveryCode(publicId: string): { code: string; digest: string } {
  const raw = randomBytes(20).toString('base64url').toUpperCase();
  const code = `LX-${publicId}-${raw}`;
  return { code, digest: digestRecoveryCode(code) };
}

export function digestRecoveryCode(code: string): string {
  return createHmac('sha256', secret()).update(code.trim().toUpperCase()).digest('hex');
}

export function parseRecoveryPublicId(code: string): string | null {
  const match = /^LX-([A-Z0-9]{10})-[A-Z0-9_-]{20,}$/i.exec(code.trim());
  return match?.[1]?.toUpperCase() ?? null;
}

export function createPublicId(): string {
  return randomBytes(8).toString('base64url').replace(/[-_]/g, 'A').slice(0, 10).toUpperCase();
}
