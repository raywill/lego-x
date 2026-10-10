import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import authHandler from '../api/auth/[...all].js';
import thumbnailHandler from '../api/thumbnail.js';
import communityHandler from '../api/v1/[...route].js';

type QueryValue = string | string[];

interface EcsRequest extends IncomingMessage {
  query: Record<string, QueryValue>;
}

interface EcsResponse extends ServerResponse {
  status: (code: number) => EcsResponse;
  send: (body?: unknown) => EcsResponse;
  json: (body: unknown) => EcsResponse;
}

function queryFrom(url: URL): Record<string, QueryValue> {
  const query: Record<string, QueryValue> = {};
  for (const [key, value] of url.searchParams) {
    const previous = query[key];
    query[key] = previous === undefined
      ? value
      : Array.isArray(previous) ? [...previous, value] : [previous, value];
  }
  return query;
}

function decorateResponse(response: ServerResponse): EcsResponse {
  const decorated = response as EcsResponse;
  decorated.status = (code) => {
    decorated.statusCode = code;
    return decorated;
  };
  decorated.send = (body = '') => {
    if (!decorated.writableEnded) {
      if (typeof body === 'object' && !Buffer.isBuffer(body)) {
        if (!decorated.hasHeader('content-type')) {
          decorated.setHeader('content-type', 'application/json; charset=utf-8');
        }
        decorated.end(JSON.stringify(body));
      } else {
        decorated.end(body);
      }
    }
    return decorated;
  };
  decorated.json = (body) => {
    if (!decorated.hasHeader('content-type')) {
      decorated.setHeader('content-type', 'application/json; charset=utf-8');
    }
    return decorated.send(JSON.stringify(body));
  };
  return decorated;
}

const port = Number.parseInt(process.env.PORT || '3100', 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT 必须是 1 到 65535 之间的整数');
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  const ecsRequest = request as EcsRequest;
  ecsRequest.query = queryFrom(url);
  const ecsResponse = decorateResponse(response);

  try {
    if (url.pathname === '/healthz') {
      ecsResponse.status(200).send('ok');
      return;
    }
    if (url.pathname === '/api/auth' || url.pathname.startsWith('/api/auth/')) {
      await authHandler(ecsRequest as never, ecsResponse as never);
      return;
    }
    if (url.pathname === '/api/thumbnail') {
      await thumbnailHandler(ecsRequest as never, ecsResponse as never);
      return;
    }
    if (url.pathname === '/api/v1' || url.pathname.startsWith('/api/v1/')) {
      await communityHandler(ecsRequest as never, ecsResponse as never);
      return;
    }
    ecsResponse.status(404).json({ error: '找不到这个接口' });
  } catch (error) {
    console.error('ECS API request failed', error);
    if (!ecsResponse.writableEnded) {
      ecsResponse.status(500).json({ error: '服务器暂时无法完成操作' });
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.info(`Digital Bricks API is listening on 127.0.0.1:${port}`);
});

function shutdown(signal: string) {
  console.info(`Received ${signal}; stopping Digital Bricks API.`);
  server.close((error) => {
    if (error) {
      console.error('Unable to stop API cleanly', error);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
