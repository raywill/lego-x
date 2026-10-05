import type { VercelRequest, VercelResponse } from '@vercel/node';
import handler from './v1/[...route]';

export default async function communityHandler(request: VercelRequest, response: VercelResponse) {
  try {
    await handler(request, response);
  } catch (error) {
    console.error('community function failed', error);
    response.status(500).json({ error: '社区服务暂时不可用', detail: error instanceof Error ? error.message : String(error) });
  }
}
