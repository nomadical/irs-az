import { getTranslations } from 'next-intl/server';

export default async function Loading() {
  const t = await getTranslations('reading');
  return (
    <div className="container page-content page-loading" role="status">
      <div className="ornament" aria-hidden="true" />
      <p>{t('loading')}</p>
    </div>
  );
}
