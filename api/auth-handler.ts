import type { VercelRequest, VercelResponse } from '@vercel/node';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../server/auth.js';

const handler = toNodeHandler(auth);

export default async function authHandler(request: VercelRequest, response: VercelResponse) {
  const path = typeof request.query.path === 'string' ? request.query.path : '';
  if (path) request.url = `/api/auth/${path}`;
  return handler(request, response);
}
