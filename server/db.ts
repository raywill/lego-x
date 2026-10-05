import { attachDatabasePool } from '@vercel/functions';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';

let pool: Pool | undefined;

export function getDatabasePool(): Pool {
  if (pool) return pool;
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error('DATABASE_URL is not configured.');
  pool = mysql.createPool({
    uri,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 30_000,
    enableKeepAlive: true,
    timezone: 'Z',
  });
  if (process.env.VERCEL) attachDatabasePool(pool);
  return pool;
}

export async function withTransaction<T>(work: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await getDatabasePool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export type DatabaseRow = RowDataPacket;
