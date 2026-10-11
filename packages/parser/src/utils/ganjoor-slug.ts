/**
 * Readable work slugs for Ganjoor imports, built from the poem's Ganjoor URL:
 *   https://ganjoor.net/khaghani/divankh/ghetekh/sh112  →  xaqani-qite-112
 *   https://ganjoor.net/nezami/5ganj/khosro-shirin/sh12 →  nizami-xosrov-ve-sirin-12
 *
 * Ganjoor titles are Persian labels like "شمارهٔ ۱۱۲" ("No. 112"), which can't be slugified.
 */

// Ganjoor section path (without the author/book prefix) → Azerbaijani slug part
const SECTIONS: Record<string, string> = {
  // Divan sections (Khaqani's carry a "kh" suffix)
  ghazal: 'qezel',
  ghazalkh: 'qezel',
  ghaside: 'qeside',
  ghasidekh: 'qeside',
  ghete: 'qite',
  ghetekh: 'qite',
  robaee: 'rubai',
  robaeekh: 'rubai',
  masnavi: 'mesnevi',
  mollamma: 'mulemme',
  elhaghi: 'elhaqi',
  ezafat: 'elaveler',
  arabikh: 'erebce',
  tarjeeatkh: 'tercibend',
  tarkibatkh: 'terkibbend',
  // Mahsati's separate rubai selection, distinct from divan/robaee
  robmah: 'rubailer',
  // Standalone poems
  saghiname: 'saqiname',
  // Nizami's Khamsa
  makhzanolasrar: 'sirler-xezinesi',
  'khosro-shirin': 'xosrov-ve-sirin',
  'leyli-majnoon': 'leyli-ve-mecnun',
  '7peykar': 'yeddi-gozel',
  sharafname: 'serefname',
  kheradname: 'iqbalname',
};

const URL_PATTERN = /^https?:\/\/ganjoor\.net\/[^/]+\/(?:.*\/)?([^/]+)\/sh(\d+)\/?$/;

/** Returns null when the URL isn't a Ganjoor poem URL or its section is unmapped. */
export function ganjoorSlug(authorSlug: string, sourceUrl: string | undefined): string | null {
  const match = sourceUrl?.match(URL_PATTERN);
  if (!match) return null;
  const [, section, number] = match;
  const part = SECTIONS[section];
  return part ? `${authorSlug}-${part}-${number}` : null;
}

export const isLegacyGanjoorSlug = (slug: string) => /^ganjoor-\d+$/.test(slug);
