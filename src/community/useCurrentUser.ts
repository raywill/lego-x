import { useCallback, useEffect, useState } from 'react';
import type { CurrentUser } from '../../shared/community';
import { communityApi } from './api';

const AUTH_CHANGED_EVENT = 'legox-auth-changed';

export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setUser(await communityApi.me());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener(AUTH_CHANGED_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [refresh]);

  return { user, loading, refresh };
}
