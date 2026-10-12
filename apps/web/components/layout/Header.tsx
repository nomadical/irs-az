'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { SkinToggle } from '@/components/ui/SkinToggle';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const datelineSubtitle: Record<string, string> = {
  az: 'Azərbaycan ədəbiyyatı xəzinəsi',
  ru: 'Сокровищница азербайджанской литературы',
  en: 'Treasury of Azerbaijani literature',
};

function formatDate(locale: string): string {
  const dateLocale = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-US' : 'ru-RU';
  return new Date().toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: locale === 'az' ? 'numeric' : 'long',
    year: 'numeric',
  });
}

interface NavLink {
  href: string;
  label: string;
}

/** Section links; `type` is the author type in the URL, unknown while the query loads */
function NavLinks({ links, pathname, type }: { links: NavLink[]; pathname: string; type: string | null | undefined }) {
  const t = useTranslations('nav');
  const isActive = (href: string) => {
    const [path, query] = href.split('?');
    // Poets, writers and philosophers share one index; only the matching type is current
    if (query) return pathname === path && type === new URLSearchParams(query).get('type');
    return pathname.startsWith(path);
  };

  return (
    <nav className="site-nav" aria-label={t('menu_label')}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={link.href.endsWith('/random') ? false : undefined}
          aria-current={isActive(link.href) ? 'page' : undefined}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function NavLinksWithQuery(props: { links: NavLink[]; pathname: string }) {
  const searchParams = useSearchParams();
  return <NavLinks {...props} type={searchParams.get('type')} />;
}

export function Header() {
  const t = useTranslations('nav');
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();

  const navLinks: NavLink[] = [
    { href: `/${locale}/authors?type=POET`, label: t('poets') },
    { href: `/${locale}/authors?type=WRITER`, label: t('writers') },
    { href: `/${locale}/authors?type=PHILOSOPHER`, label: t('philosophers') },
    { href: `/${locale}/works`, label: t('works') },
    { href: `/${locale}/random`, label: t('random') },
    { href: `/${locale}/search`, label: t('search') },
    { href: `/${locale}/contribute`, label: t('contribute') },
  ];

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href={`/${locale}`} className="logo">
          IRS<span className="logo-orn" aria-hidden="true">◆</span><em>AZ</em>
        </Link>

        <Suspense fallback={<NavLinks links={navLinks} pathname={pathname} type={undefined} />}>
          <NavLinksWithQuery links={navLinks} pathname={pathname} />
        </Suspense>

        <div className="header-tools">
          <LanguageSwitcher />
          <SkinToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className="dateline">
        <div className="dateline-inner">
          {formatDate(locale)} &nbsp;·&nbsp; Bakı &nbsp;·&nbsp; {datelineSubtitle[locale] ?? datelineSubtitle.az}
        </div>
      </div>
    </header>
  );
}
