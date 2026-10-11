'use client';

import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

interface AdminUser {
  id: string;
  name?: string;
  username: string;
  email: string;
  role: string;
}

interface AdminAuth {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

export function useAdminAuth(): AdminAuth {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      let stored = localStorage.getItem('token');
      if (!stored) {
        setLoading(false);
        return;
      }

      // Try /auth/me with current token
      let res = await fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${stored}` },
      }).catch(() => null);

      // If 401, try refreshing
      if (res && res.status === 401) {
        const newToken = await tryRefresh();
        if (newToken) {
          stored = newToken;
          res = await fetch(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${stored}` },
          }).catch(() => null);
        }
      }

      if (res && res.ok) {
        const data = await res.json();
        setToken(stored);
        setUser(data);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
      }
      setLoading(false);
    }

    check();
  }, []);

  return { user, token, loading };
}
