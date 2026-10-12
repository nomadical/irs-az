'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams, usePathname } from 'next/navigation';
import { authorsPath } from '@/lib/facets';
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

function NavLinks({ links, pathname }: { links: NavLink[]; pathname: string }) {
  const t = useTranslations('nav');
  // A section is current on its own page and below it (/authors/sairler/esr-12 is still Poets)
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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

export function Header() {
  const t = useTranslations('nav');
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();

  const navLinks: NavLink[] = [
    { href: authorsPath(locale, { type: 'POET' }), label: t('poets') },
    { href: authorsPath(locale, { type: 'WRITER' }), label: t('writers') },
    { href: authorsPath(locale, { type: 'PHILOSOPHER' }), label: t('philosophers') },
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

        <NavLinks links={navLinks} pathname={pathname} />

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
