import type { CurrentUser, PublicProfile, PublicWork } from '../../shared/community';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || '社区服务暂时不可用');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const communityApi = {
  me: () => request<CurrentUser | null>('/account/me'),
  plaza: () => request<{ works: PublicWork[] }>('/plaza'),
  profile: (publicId: string) => request<PublicProfile>(`/profiles/${encodeURIComponent(publicId)}`),
  work: (workId: string) => request<PublicWork>(`/works/${encodeURIComponent(workId)}`),
  remix: (workId: string) => request<PublicWork>(`/works/${encodeURIComponent(workId)}/remix`),
  publish: (payload: { title: string; project: unknown; thumbnail: string; guardianPin?: string; workId?: string }) => request<PublicWork>('/works', { method: 'POST', body: JSON.stringify(payload) }),
  like: (workId: string, liked: boolean) => request<{ liked: boolean }>(`/works/${encodeURIComponent(workId)}/like`, { method: liked ? 'POST' : 'DELETE' }),
  report: (workId: string, reason: string) => request<{ reported: boolean }>(`/works/${encodeURIComponent(workId)}/report`, { method: 'POST', body: JSON.stringify({ reason }) }),
  unpublish: (workId: string) => request<{ unpublished: boolean }>(`/works/${encodeURIComponent(workId)}/unpublish`, { method: 'POST', body: '{}' }),
};

export async function startRegistration(nickname: string, guardianPin: string) {
  return request<{ context: string; publicId: string }>('/account/register/start', { method: 'POST', body: JSON.stringify({ nickname, guardianPin }) });
}

export async function finishRegistration() {
  return request<{ recoveryCode: string; message: string }>('/account/register/complete', { method: 'POST', body: '{}' });
}

export async function startRecovery(recoveryCode: string) {
  return request<{ context: string; publicId: string }>('/account/recover/start', { method: 'POST', body: JSON.stringify({ recoveryCode }) });
}

export async function finishRecovery(passkeyId: string) {
  return request<{ recoveryCode: string }>('/account/recover/complete', { method: 'POST', body: JSON.stringify({ passkeyId }) });
}
