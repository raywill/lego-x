import { createAuthClient } from 'better-auth/react';
import { passkeyClient } from '@better-auth/passkey/client';

export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? 'http://localhost:5173' : window.location.origin,
  plugins: [passkeyClient()],
});
