import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Catalog } from '@/lib/api';
import { authorsPath, worksPath } from '@/lib/facets';

interface Props {
  catalog: Catalog;
  themes: number;
  locale: string;
}

/**
 * Homepage catalogue, culture.ru-style: a tile per section with its real count.
 * Units say what is counted: masnavis are stored as chapters, drama as acts and parts.
 */
export async function CatalogTiles({ catalog, themes, locale }: Props) {
  const t = await getTranslations({ locale, namespace: 'catalog' });
  const number = new Intl.NumberFormat(locale);

  const tiles = [
    { key: 'works', count: catalog.works, href: worksPath(locale) },
    { key: 'ghazals', count: catalog.forms.GHAZAL, href: worksPath(locale, { form: 'GHAZAL' }) },
    { key: 'masnavis', count: catalog.forms.MASNAVI, href: worksPath(locale, { form: 'MASNAVI' }), caption: true },
    { key: 'rubais', count: catalog.forms.RUBAI, href: worksPath(locale, { form: 'RUBAI' }) },
    { key: 'qasidas', count: catalog.forms.QASIDA, href: worksPath(locale, { form: 'QASIDA' }) },
    { key: 'drama', count: catalog.genres.PLAY, href: worksPath(locale, { genre: 'PLAY' }), caption: true },
    { key: 'poets', count: catalog.authors.POET, href: authorsPath(locale, { type: 'POET' }) },
    { key: 'themes', count: themes, href: `/${locale}/tags` },
  ].filter((tile): tile is typeof tile & { count: number } => !!tile.count);

  if (tiles.length < 2) return null;

  return (
    <section className="catalog" aria-labelledby="catalog-title">
      <h2 id="catalog-title" className="section-label">{t('title')}</h2>
      <ul className="catalog-grid">
        {tiles.map(({ key, count, href, caption }) => (
          <li key={key}>
            <Link href={href} className={`catalog-tile catalog-tile--${key}`}>
              {/* The section name; the clean skin shows it only where the unit doesn't name the form */}
              <span className={`catalog-kind${caption ? '' : ' catalog-kind--redundant'}`}>{t(key as any)}</span>
              <span className="catalog-count">{number.format(count)}</span>
              <span className="catalog-unit">{t(`${key}_unit` as any, { count })}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
