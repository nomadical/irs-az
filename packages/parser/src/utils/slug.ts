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
