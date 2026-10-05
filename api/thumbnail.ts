import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { RowDataPacket } from 'mysql2';
import { getDatabasePool } from '../server/db.js';

interface ThumbnailRow extends RowDataPacket {
  thumbnail: Buffer;
  thumbnail_mime: string;
}

export default async function thumbnail(request: VercelRequest, response: VercelResponse) {
  const version = typeof request.query.version === 'string' ? request.query.version : '';
  if (!/^[0-9a-f-]{36}$/i.test(version)) {
    response.status(404).end();
    return;
  }
  try {
    const [rows] = await getDatabasePool().query<ThumbnailRow[]>('SELECT thumbnail, thumbnail_mime FROM work_versions WHERE id = ? LIMIT 1', [version]);
    const row = rows[0];
    if (!row) {
      response.status(404).end();
      return;
    }
    response.setHeader('content-type', row.thumbnail_mime || 'image/webp');
    response.setHeader('cache-control', 'public, max-age=31536000, immutable');
    response.status(200).end(row.thumbnail);
  } catch (error) {
    console.error('thumbnail request failed', error);
    response.status(500).end();
  }
}
