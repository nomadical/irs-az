'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useParams, usePathname } from 'next/navigation';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
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

export function Header() {
  const t = useTranslations('nav');
  const { locale } = useParams<{ locale: string }>();
  const pathname = usePathname();

  const navLinks = [
    { href: `/${locale}/authors?type=POET`, label: t('poets') },
    { href: `/${locale}/authors?type=WRITER`, label: t('writers') },
    { href: `/${locale}/authors?type=PHILOSOPHER`, label: t('philosophers') },
    { href: `/${locale}/works`, label: t('works') },
    { href: `/${locale}/random`, label: t('random') },
    { href: `/${locale}/search`, label: t('search') },
  ];

  const isActive = (href: string) => {
    if (href === `/${locale}`) return pathname === href;
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <header className="site-header">
      <div className="header-inner">
        <Link href={`/${locale}`} className="logo">
          IRS<span className="logo-orn" aria-hidden="true">◆</span><em>AZ</em>
        </Link>

        <nav className="site-nav" aria-label={t('menu_label')}>
          {navLinks.map((link) => (
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

        <div className="header-tools">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <div className="dateline">
        <div style={{ borderTop: '0.5px solid var(--rule)', paddingTop: '0.05rem' }}>
          {formatDate(locale)} &nbsp;·&nbsp; Bakı &nbsp;·&nbsp; {datelineSubtitle[locale] ?? datelineSubtitle.az}
        </div>
      </div>
    </header>
  );
}
