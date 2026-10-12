'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAdminAuth } from '@/lib/useAdminAuth';
import '@/styles/admin.css';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

const navSections = [
  {
    label: 'İdarəetmə',
    items: [
      { href: '/admin', label: 'Lövhə', exact: true },
      { href: '/admin/submissions', label: 'Təqdimatlar', badge: true },
    ],
  },
  {
    label: 'Məzmun',
    items: [
      { href: '/admin/authors', label: 'Müəlliflər' },
      { href: '/admin/works', label: 'Əsərlər' },
      { href: '/admin/tags', label: 'Teqlər' },
      { href: '/admin/blog', label: 'Bloq' },
    ],
  },
  {
    label: 'Sistem',
    items: [
      { href: '/admin/users', label: 'İstifadəçilər' },
      { href: '/admin/settings', label: 'Parametrlər' },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useAdminAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const isLoginPage = pathname === '/admin/login';

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !user && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [authLoading, user, isLoginPage, router]);

  useEffect(() => {
    if (isLoginPage) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${API}/submissions?status=PENDING&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setPendingCount(data.meta?.total ?? 0))
      .catch(() => {});
  }, [isLoginPage]);

  // Login page — render without sidebar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Still loading auth — show loading state
  if (authLoading) {
    return (
      <div className="adm-shell">
        <div className="adm-loading" style={{ margin: 'auto' }}>Yüklənir…</div>
      </div>
    );
  }

  // Not authenticated — will redirect via useEffect above
  if (!user) {
    return null;
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  const initials = user.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user.username?.slice(0, 2).toUpperCase() ?? '?';

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/admin/login');
  };

  return (
    <div className="adm-shell">
      <aside className="adm-sidebar">
        <Link href="/admin" className="adm-logo">
          IRS<span>◆</span>AZ
          <span className="adm-logo-sub">Admin Panel</span>
        </Link>

        <nav>
          {navSections.map((section) => (
            <div key={section.label} className="adm-nav-section">
              <div className="adm-nav-label">{section.label}</div>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`adm-nav-item ${isActive(item.href, (item as any).exact) ? 'active' : ''}`}
                >
                  <span>{item.label}</span>
                  {(item as any).badge && pendingCount > 0 && (
                    <span className="adm-nav-badge">{pendingCount}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="adm-user-card">
          <div className="adm-avatar">{initials}</div>
          <div className="adm-user-info">
            <div className="adm-user-name">
              {user.name || user.username || '—'}
            </div>
            <div className="adm-user-role">{user.role}</div>
          </div>
          <button
            onClick={handleLogout}
            className="adm-btn adm-btn-sec"
            style={{ marginLeft: 'auto', padding: '0.2rem 0.4rem', fontSize: '0.65rem' }}
          >
            Cxis
          </button>
        </div>
      </aside>

      <main className="adm-main">{children}</main>
    </div>
  );
}
