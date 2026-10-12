import type { Metadata } from 'next';
import { api, getWorkOrRedirect, type MoreWork, type OtherWork, type TagRef } from '@/lib/api';
import { localized } from '@/lib/locale';
import { excerpt, pageMetadata, SITE_URL } from '@/lib/seo';
import Link from 'next/link';
import { ReadingView } from '@/components/reading/ReadingView';
import { WorkNavKeys } from '@/components/reading/WorkNavKeys';
import { JsonLd } from '@/components/seo/JsonLd';
import { WorkCard } from '@/components/works/WorkCard';
import { TagPills } from '@/components/works/TagPills';
import { RefreshIcon } from '@/components/ui/RefreshIcon';
import { ShareBar } from '@/components/reading/ShareBar';
import { getTranslations } from 'next-intl/server';
import {
  displayTitle,
  formatVerse,
  incipit,
  isArabicScript,
  isNumberedTitle,
  isPlaceholderTitle,
  sourceInfo,
} from '@/lib/verse';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

const GLOSSED_FORMS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA', 'MURABBA'];
// Fallback collection names for imports still titled by their slug
const FORM_PLURALS = ['GHAZAL', 'MASNAVI', 'RUBAI', 'QASIDA'];

/**
 * Ghazals are known by their first line. When the stored title is only a
 * number ("Qəzəl 7"), the first hemistich becomes the heading and the number
 * moves to the meta strip.
 */
function headingFor(work: any, title: { text: string; original: string | null }) {
  const numbered = work.form === 'GHAZAL' && (title.original || isNumberedTitle(title.text));
  const first = numbered ? incipit(work.bodyHtml || work.body) : null;
  return first ? { heading: first, number: title.text } : { heading: title.text, number: null };
}

async function titleHelpers(locale: string) {
  const t = await getTranslations({ locale, namespace: 'reading' });
  const options = await getTranslations({ locale, namespace: 'contribute.options' });
  return {
    t,
    options,
    titleFor: (title: string | null, form: string | null) =>
      displayTitle(title, {
        formLabel: form && form !== 'OTHER' ? options(`form.${form}` as any) : null,
        sectionLabel: t('section'),
        numbered: (f, n) => t('numbered', { form: f, n }),
      }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const work = (await getWorkOrRedirect(slug, locale)) as any;
  const { titleFor } = await titleHelpers(locale);
  const { heading, number } = headingFor(work, titleFor(localized(work, 'title', locale) ?? work.titleAz, work.form));
  const authorName = localized(work.author, 'name', locale);

  return pageMetadata({
    locale,
    path: `/works/${slug}`,
    title: `${number ? `${heading} (${number})` : heading} — ${authorName}`,
    description: excerpt(work.body, { poem: work.genre !== 'PROSE' }),
    type: 'article',
    images: false,
  });
}

export default async function WorkPage({ params }: Props) {
  const { locale, slug } = await params;

  const [work, nav, more, others] = await Promise.all([
    getWorkOrRedirect(slug, locale) as Promise<any>,
    // Old slugs redirect above, so nav only matters when the work exists
    api.getWorkNav(slug).catch(() => ({ prev: null, next: null })),
    api.getMoreByAuthor(slug, locale).catch(() => [] as MoreWork[]),
    api.getOtherPoets(slug, locale).catch(() => ({ theme: null, works: [] as OtherWork[] })),
  ]);

  const { t, options, titleFor } = await titleHelpers(locale);
  const tTags = await getTranslations({ locale, namespace: 'tags' });
  const title = titleFor(localized(work, 'title', locale), work.form);
  const { heading, number } = headingFor(work, title);
  const authorName = localized(work.author, 'name', locale);
  const rawCollectionTitle = work.collection ? localized(work.collection, 'title', locale) : null;
  const collectionTitle = work.collection
    ? isPlaceholderTitle(rawCollectionTitle, work.collection.slug)
      ? t(`form_plural.${FORM_PLURALS.includes(work.form) ? work.form : 'OTHER'}` as any)
      : rawCollectionTitle
    : null;

  const isPoem = work.genre === 'POEM';
  const verse = (html: string) =>
    isPoem ? formatVerse(html, { form: work.form, maqtaLabel: t('maqta') }) : { html, maqta: false };
  const original = verse(work.bodyHtml || work.body);
  const translations = (work.translations ?? []).map((tr: any) => ({
    ...tr,
    bodyHtml: verse(tr.bodyHtml || tr.body).html,
  }));
  const formLabel = work.form && work.form !== 'OTHER' ? options(`form.${work.form}` as any) : null;

  const navHref = (item: { slug: string } | null) =>
    item ? `/${locale}/works/${encodeURIComponent(item.slug)}` : null;
  const navTitle = (item: any) => titleFor(localized(item, 'title', locale), work.form).text;
  const titleLang = (text: string) => (isArabicScript(text) ? { lang: 'fa', dir: 'rtl' as const } : {});

  return (
    <div className="container page-content">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: title.original ?? heading,
          url: `${SITE_URL}/${locale}/works/${slug}`,
          genre: work.genre.toLowerCase(),
          ...(work.year && { dateCreated: String(work.year) }),
          author: {
            '@type': 'Person',
            name: authorName,
            url: `${SITE_URL}/${locale}/authors/${work.author.slug}`,
          },
          ...(collectionTitle && {
            isPartOf: {
              '@type': 'CreativeWork',
              name: collectionTitle,
              url: `${SITE_URL}/${locale}/collections/${work.collection.slug}`,
            },
          }),
        }}
      />

      <nav className="breadcrumb" aria-label={t('breadcrumb')}>
        <Link href={`/${locale}/authors/${work.author.slug}`}>{authorName}</Link>
        {collectionTitle && (
          <>
            <span className="breadcrumb-sep" aria-hidden="true">›</span>
            <Link href={`/${locale}/collections/${work.collection.slug}`}>
              <bdi>{collectionTitle}</bdi>
            </Link>
          </>
        )}
        <span className="breadcrumb-sep" aria-hidden="true">›</span>
        <span className="breadcrumb-current" aria-current="page">
          <bdi {...titleLang(title.text)}>{title.text}</bdi>
        </span>
      </nav>

      <header className="page-header work-header">
        <h1 id="work-title" className="work-heading" tabIndex={-1} {...titleLang(heading)}>
          {heading}
        </h1>
        {title.original && !number && (
          <p className="work-heading-original" lang="fa" dir="rtl">{title.original}</p>
        )}
        <div className="meta-strip">
          <span>{options(`genre.${work.genre}` as any)}</span>
          {(number || formLabel) && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>{number ?? formLabel}</span>
            </>
          )}
          {work.year && (
            <>
              <span className="dot" aria-hidden="true" />
              <span>{work.yearApprox ? '~' : ''}{work.year}</span>
            </>
          )}
        </div>
        {formLabel && GLOSSED_FORMS.includes(work.form) && (
          <details className="work-gloss">
            <summary>
              {t('what_is', { form: locale === 'az' ? formLabel : formLabel.toLocaleLowerCase(locale) })}
            </summary>
            <p>
              {t(`gloss.${work.form}` as any)}
              {original.maqta && <> {t('gloss_maqta')}</>}
            </p>
          </details>
        )}
      </header>

      <div className="ornament" aria-hidden="true" />

      <ReadingView
        body={original.html}
        translations={translations}
        originalLang={work.originalLang}
        scriptDirection={work.scriptDirection}
        locale={locale}
        genre={work.genre}
        source={sourceInfo(work.sourceNote)}
        suggestHref={`/${locale}/contribute?type=translation&work=${encodeURIComponent(slug)}`}
      />

      <TagPills
        tags={(work.tags ?? []).map((wt: { tag: TagRef }) => wt.tag)}
        locale={locale}
        label={tTags('work_tags')}
        className="work-tag-row"
      />

      <ShareBar
        url={`${SITE_URL}/${locale}/works/${slug}`}
        text={`${heading} — ${authorName}`}
      />
      <p className="print-source">IRS.AZ · {`${SITE_URL}/${locale}/works/${slug}`}</p>

      {(nav.prev || nav.next) && (
        <nav className="work-nav" aria-label={t('nav_label')}>
          {nav.prev ? (
            <Link href={navHref(nav.prev)!} className="work-nav-btn" rel="prev">
              <span className="work-nav-dir">← {t('prev')}</span>
              <span className="work-nav-title"><bdi {...titleLang(navTitle(nav.prev))}>{navTitle(nav.prev)}</bdi></span>
            </Link>
          ) : (
            <span />
          )}
          {nav.next ? (
            <Link href={navHref(nav.next)!} className="work-nav-btn work-nav-btn--next" rel="next">
              <span className="work-nav-dir">{t('next')} →</span>
              <span className="work-nav-title"><bdi {...titleLang(navTitle(nav.next))}>{navTitle(nav.next)}</bdi></span>
            </Link>
          ) : (
            <span />
          )}
          <p className="work-nav-hint">{t('keys_hint')}</p>
        </nav>
      )}
      <WorkNavKeys prevHref={navHref(nav.prev)} nextHref={navHref(nav.next)} randomHref={`/${locale}/random`} />
      <p className="work-random">
        <Link href={`/${locale}/random`} prefetch={false} aria-keyshortcuts="r"><RefreshIcon /> {t('random_poem')}</Link>
      </p>

      {more.length > 0 && (
        <section className="more-works" aria-labelledby="more-works-title">
          <h2 id="more-works-title" className="more-works-title">
            <Link href={`/${locale}/authors/${work.author.slug}`}>{t('more_by_author')}</Link>
          </h2>
          <div className="card-grid more-works-grid">
            {more.map((item) => {
              const itemForm = item.form && item.form !== 'OTHER' ? options(`form.${item.form}` as any) : null;
              return (
                <WorkCard
                  key={item.slug}
                  href={navHref(item)!}
                  title={titleFor(localized(item, 'title', locale), item.form).text}
                  incipit={item.incipit}
                  meta={
                    (itemForm || item.year) && (
                      <>
                        {itemForm && <span>{itemForm}</span>}
                        {itemForm && item.year && <span className="dot" aria-hidden="true" />}
                        {item.year && <span>{item.year}</span>}
                      </>
                    )
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {others.works.length > 0 && (
        <section className="more-works more-works--others" aria-labelledby="other-poets-title">
          <h2 id="other-poets-title" className="more-works-title">
            <Link href={others.theme ? `/${locale}/tags/${others.theme.slug}` : `/${locale}/works`}>
              {t('other_poets')}
              {others.theme && <span className="more-works-theme"> · {localized(others.theme, 'name', locale)}</span>}
            </Link>
          </h2>
          <div className="card-grid more-works-grid">
            {others.works.map((item) => {
              const itemForm = item.form && item.form !== 'OTHER' ? options(`form.${item.form}` as any) : null;
              return (
                <WorkCard
                  key={item.slug}
                  href={navHref(item)!}
                  title={titleFor(localized(item, 'title', locale), item.form).text}
                  incipit={item.incipit}
                  meta={
                    <>
                      <span>{localized(item.author, 'name', locale)}</span>
                      {itemForm && (
                        <>
                          <span className="dot" aria-hidden="true" />
                          <span>{itemForm}</span>
                        </>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
