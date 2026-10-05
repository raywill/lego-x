import { readFile } from 'node:fs/promises';
import { getDatabasePool } from './db';

const pool = getDatabasePool();
const authSchema = await readFile(new URL('./auth-schema.sql', import.meta.url), 'utf8');
const appSchema = await readFile(new URL('./app-schema.sql', import.meta.url), 'utf8');
for (const statement of `${authSchema}\n${appSchema}`.split(';').map((item) => item.trim()).filter(Boolean)) {
  await pool.query(statement);
}
await pool.end();
console.log('Digital Bricks database schema is ready.');
