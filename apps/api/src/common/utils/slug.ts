const AZ_CHAR_MAP: Record<string, string> = {
  ə: 'e',
  ü: 'u',
  ö: 'o',
  ş: 's',
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  Ə: 'e',
  Ü: 'u',
  Ö: 'o',
  Ş: 's',
  Ç: 'c',
  Ğ: 'g',
  I: 'i',
};

export function slugify(text: string): string {
  let result = text.toLowerCase();

  for (const [az, latin] of Object.entries(AZ_CHAR_MAP)) {
    result = result.replaceAll(az.toLowerCase(), latin);
  }

  return result
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * First free slug among `base`, then `base-<qualifier>` (e.g. the author's slug),
 * then `base-2`, `base-3`…. `taken` should also count previous slugs, so redirects stay unambiguous.
 */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
  qualifier?: string,
): Promise<string> {
  const candidates = [base, ...(qualifier ? [`${base}-${qualifier}`] : [])];
  for (const slug of candidates) if (!(await taken(slug))) return slug;
  for (let n = 2; ; n++) {
    const slug = `${base}-${n}`;
    if (!(await taken(slug))) return slug;
  }
}
