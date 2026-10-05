import { fromNodeHeaders } from 'better-auth/node';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { auth } from './auth';

export function sendJson(response: VercelResponse, status: number, value: unknown): void {
  response.status(status).setHeader('content-type', 'application/json; charset=utf-8').send(JSON.stringify(value));
}

export function sendError(response: VercelResponse, status: number, message: string): void {
  sendJson(response, status, { error: message });
}

export async function readJson<T = Record<string, unknown>>(request: VercelRequest): Promise<T> {
  if (request.body && typeof request.body === 'object') return request.body as T;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return {} as T;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T;
}

export async function getSession(request: VercelRequest) {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

export async function requireSession(request: VercelRequest, response: VercelResponse) {
  const session = await getSession(request);
  if (!session) {
    sendError(response, 401, '请先登录');
    return null;
  }
  return session;
}

export function setCookie(response: VercelResponse, name: string, value: string, maxAgeSeconds: number): void {
  response.setHeader('set-cookie', `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

export function getCookie(request: VercelRequest, name: string): string | null {
  const source = request.headers.cookie || '';
  const match = source.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function getRoute(request: VercelRequest): string[] {
  const captured = request.query.route;
  if (typeof captured === 'string' && captured) return captured.split('/').filter(Boolean).map(decodeURIComponent);
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  return pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function setNoStore(response: VercelResponse): void {
  response.setHeader('cache-control', 'no-store');
}
