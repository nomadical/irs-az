/** Pick the right localized field: en → En || Az, ru → Ru || Az, else → Az */
export function localized<T extends Record<string, any>>(
  item: T,
  field: string,
  locale: string,
): string | null {
  if (locale === 'en') return item[`${field}En`] || item[`${field}Az`] || null;
  if (locale === 'ru') return item[`${field}Ru`] || item[`${field}Az`] || null;
  return item[`${field}Az`] || null;
}
