/**
 * Readable slugs and titles for Ganjoor imports, built from the poem's Ganjoor URL:
 *   https://ganjoor.net/khaghani/divankh/ghetekh/sh112  →  xaqani-qite-112, "Qitə 112"
 *   https://ganjoor.net/nezami/5ganj/khosro-shirin/sh12 →  nizami-xosrov-ve-sirin-12,
 *                                                          "Xosrov və Şirin, fəsil 12"
 *
 * Ganjoor titles are Persian labels like "شمارهٔ ۱۱۲" ("No. 112"); they stay in titleFa.
 */

type Titles = { az: string; ru: string; en: string };

interface Section extends Titles {
  slug: string;
  /** "poem": "Qəzəl 7" · "chapter": "Leyli və Məcnun, fəsil 7" · "list": "Rübailər, 7" */
  kind: 'poem' | 'chapter' | 'list';
}

const poem = (slug: string, az: string, ru: string, en: string): Section => ({ slug, az, ru, en, kind: 'poem' });
const chapter = (slug: string, az: string, ru: string, en: string): Section => ({ slug, az, ru, en, kind: 'chapter' });

// Ganjoor section path segment → slug part and titles (Khaqani's sections carry a "kh" suffix)
const SECTIONS: Record<string, Section> = {
  ghazal: poem('qezel', 'Qəzəl', 'Газель', 'Ghazal'),
  ghazalkh: poem('qezel', 'Qəzəl', 'Газель', 'Ghazal'),
  ghaside: poem('qeside', 'Qəsidə', 'Касыда', 'Qasida'),
  ghasidekh: poem('qeside', 'Qəsidə', 'Касыда', 'Qasida'),
  ghete: poem('qite', 'Qitə', 'Кыта', "Qit'a"),
  ghetekh: poem('qite', 'Qitə', 'Кыта', "Qit'a"),
  robaee: poem('rubai', 'Rübai', 'Рубаи', 'Rubai'),
  robaeekh: poem('rubai', 'Rübai', 'Рубаи', 'Rubai'),
  masnavi: poem('mesnevi', 'Məsnəvi', 'Маснави', 'Masnavi'),
  mollamma: poem('mulemme', 'Müləmmə', 'Мулямма', "Mulamma'"),
  elhaghi: poem('elhaqi', 'Ona aid edilən şeir', 'Приписываемое стихотворение', 'Attributed poem'),
  ezafat: poem('elaveler', 'Əlavə', 'Дополнение', 'Addendum'),
  arabikh: poem('erebce', 'Ərəbcə şeir', 'Арабское стихотворение', 'Arabic poem'),
  tarjeeatkh: poem('tercibend', 'Tərcibənd', 'Тарджибанд', 'Tarji-band'),
  tarkibatkh: poem('terkibbend', 'Tərkibbənd', 'Таркиббанд', 'Tarkib-band'),
  // Qatran, Beylaqani, Falaki and Ouhadi (Ouhadi's divan sections carry an "o" suffix)
  ghazalo: poem('qezel', 'Qəzəl', 'Газель', 'Ghazal'),
  ghasideo: poem('qeside', 'Qəsidə', 'Касыда', 'Qasida'),
  robaeeo: poem('rubai', 'Rübai', 'Рубаи', 'Rubai'),
  tarjee: poem('tercibend', 'Tərcibənd', 'Тарджибанд', 'Tarji-band'),
  tarjeeato: poem('tercibend', 'Tərcibənd', 'Тарджибанд', 'Tarji-band'),
  tarkib: poem('terkibbend', 'Tərkibbənd', 'Таркиббанд', 'Tarkib-band'),
  tarkibato: poem('terkibbend', 'Tərkibbənd', 'Таркиббанд', 'Tarkib-band'),
  mosammat: poem('musemmet', 'Müsəmmət', 'Мусаммат', 'Musammat'),
  molamma: poem('mulemme', 'Müləmmə', 'Мулямма', "Mulamma'"),
  shakva: poem('sikayetname', 'Şikayətnamə', 'Жалоба', 'Complaint'),
  digar: poem('perakende', 'Pərakəndə şeir', 'Отдельное стихотворение', 'Miscellaneous poem'),
  morabba: poem('murebbe', 'Mürəbbe', 'Мурабба', "Murabba'"),
  esfahani: poem('isfahan-lehcesi', 'İsfahan ləhcəsində şeir', 'Стихотворение на исфаханском диалекте', 'Poem in the Isfahani dialect'),
  // Saib's divan sections
  ghazalkasa: poem('qezel', 'Qəzəl', 'Газель', 'Ghazal'),
  ghtorki: poem('turki-qezel', 'Türki qəzəl', 'Тюркская газель', 'Turkic ghazal'),
  'ghasayed-sa': poem('qeside', 'Qəsidə', 'Касыда', 'Qasida'),
  motefarreghat: poem('perakende', 'Pərakəndə şeir', 'Отдельное стихотворение', 'Miscellaneous poem'),
  // Şəhriyar: a selection of his Persian ghazals, his Azerbaijani poems, and Heydərbabaya salam in two parts
  gozidegh: poem('qezel', 'Qəzəl', 'Газель', 'Ghazal'),
  torki: poem('turkce-seir', 'Türkcə şeir', 'Тюркское стихотворение', 'Azerbaijani poem'),
  heydarbaba: poem('heyderbabaya-salam', 'Heydərbabaya salam', 'Привет Гейдар-бабе', 'Greetings to Heydar Baba'),
  heydarbaba2: poem('heyderbabaya-salam-2', 'Heydərbabaya salam, II hissə', 'Привет Гейдар-бабе, часть II', 'Greetings to Heydar Baba, Part II'),
  // Mahsati's separate rubai selection, distinct from divan/robaee
  robmah: { slug: 'rubailer', az: 'Rübailər', ru: 'Рубайят', en: 'Rubaiyat', kind: 'list' },
  // Book-length masnavis, split into chapters
  saghiname: chapter('saqiname', 'Saqinamə', 'Саки-наме', 'Saqi-nama'),
  makhzanolasrar: chapter('sirler-xezinesi', 'Sirlər xəzinəsi', 'Сокровищница тайн', 'The Treasury of Mysteries'),
  'khosro-shirin': chapter('xosrov-ve-sirin', 'Xosrov və Şirin', 'Хосров и Ширин', 'Khosrow and Shirin'),
  'leyli-majnoon': chapter('leyli-ve-mecnun', 'Leyli və Məcnun', 'Лейли и Меджнун', 'Layla and Majnun'),
  '7peykar': chapter('yeddi-gozel', 'Yeddi gözəl', 'Семь красавиц', 'The Seven Beauties'),
  sharafname: chapter('serefname', 'Şərəfnamə', 'Шараф-наме', 'Sharafnama'),
  kheradname: chapter('iqbalname', 'İqbalnamə', 'Икбал-наме', 'Iqbalnama'),
  mantegholoshagh: chapter('mentiqul-ussaq', 'Məntiqül-üşşaq', 'Мантик аль-ушшак', "Mantiq al-'Ushshaq"),
  jaamejam: chapter('cami-cem', 'Cami-Cəm', 'Джам-и Джам', 'Jam-i Jam'),
};

const URL_PATTERN = /^https?:\/\/ganjoor\.net\/[^/]+\/(?:.*\/)?([^/]+)\/sh(\d+)\/?$/;
// A lone poem named after its form, e.g. https://ganjoor.net/ghatran/divan/masnavi
const SINGLE_PATTERN = /^https?:\/\/ganjoor\.net\/[^/]+\/(?:.*\/)?([^/]+?)\/?$/;

function parse(sourceUrl: string | undefined | null) {
  const match = sourceUrl?.match(URL_PATTERN);
  const section = match && SECTIONS[match[1]];
  if (section) return { section, number: match[2] };
  const single = sourceUrl?.match(SINGLE_PATTERN);
  const lone = single && SECTIONS[single[1]];
  return lone?.kind === 'poem' ? { section: lone, number: null } : null;
}

/** Returns null when the URL isn't a Ganjoor poem URL or its section is unmapped. */
export function ganjoorSlug(authorSlug: string, sourceUrl: string | undefined | null): string | null {
  const parsed = parse(sourceUrl);
  if (!parsed) return null;
  return parsed.number ? `${authorSlug}-${parsed.section.slug}-${parsed.number}` : `${authorSlug}-${parsed.section.slug}`;
}

export function ganjoorTitles(sourceUrl: string | undefined | null): Titles | null {
  const parsed = parse(sourceUrl);
  if (!parsed) return null;
  const { section: s, number: n } = parsed;
  if (!n) return { az: s.az, ru: s.ru, en: s.en };
  switch (s.kind) {
    case 'poem':
      return { az: `${s.az} ${n}`, ru: `${s.ru} ${n}`, en: `${s.en} ${n}` };
    case 'chapter':
      return { az: `${s.az}, fəsil ${n}`, ru: `${s.ru}, глава ${n}`, en: `${s.en}, chapter ${n}` };
    case 'list':
      return { az: `${s.az}, ${n}`, ru: `${s.ru}, ${n}`, en: `${s.en}, ${n}` };
  }
}

/** Titles for the collections the Ganjoor scraper created with their slug as a placeholder title. */
export const GANJOOR_COLLECTION_TITLES: Record<string, Titles> = {
  'divan-fa-ghazal': { az: 'Fars dilində divan: qəzəllər', ru: 'Персидский диван: газели', en: 'Persian Divan: Ghazals' },
  'divan-fa-qasida': { az: 'Fars dilində divan: qəsidələr', ru: 'Персидский диван: касыды', en: 'Persian Divan: Qasidas' },
  'divan-fa-qite': { az: 'Fars dilində divan: qitələr', ru: 'Персидский диван: кыты', en: "Persian Divan: Qit'as" },
  'divan-fa-rubai': { az: 'Fars dilində divan: rübailər', ru: 'Персидский диван: рубаи', en: 'Persian Divan: Rubais' },
  saqiname: { az: 'Saqinamə', ru: 'Саки-наме', en: 'Saqi-nama' },
  mahsati: { az: 'Divan', ru: 'Диван', en: 'Divan' },
  nasimi: { az: 'Fars dilində divan', ru: 'Персидский диван', en: 'Persian Divan' },
  khaghani: { az: 'Divan', ru: 'Диван', en: 'Divan' },
  'nizami-mexzenul-esrar': { az: 'Sirlər xəzinəsi', ru: 'Сокровищница тайн', en: 'The Treasury of Mysteries' },
  'nizami-xosrov-va-sirin': { az: 'Xosrov və Şirin', ru: 'Хосров и Ширин', en: 'Khosrow and Shirin' },
  'nizami-leyli-va-macnun': { az: 'Leyli və Məcnun', ru: 'Лейли и Меджнун', en: 'Layla and Majnun' },
  'nizami-heft-peyker': { az: 'Yeddi gözəl', ru: 'Семь красавиц', en: 'The Seven Beauties' },
  'nizami-serefname': { az: 'Şərəfnamə', ru: 'Шараф-наме', en: 'Sharafnama' },
  'nizami-xerednama': { az: 'İqbalnamə', ru: 'Икбал-наме', en: 'Iqbalnama' },
  'qatran-divan': { az: 'Divan', ru: 'Диван', en: 'Divan' },
  'beylaqani-divan': { az: 'Divan', ru: 'Диван', en: 'Divan' },
  'falaki-divan': { az: 'Divan', ru: 'Диван', en: 'Divan' },
  'ovhadi-divan': { az: 'Divan', ru: 'Диван', en: 'Divan' },
  'ovhadi-mentiqul-ussaq': { az: 'Məntiqül-üşşaq', ru: 'Мантик аль-ушшак', en: "Mantiq al-'Ushshaq" },
  'ovhadi-cami-cem': { az: 'Cami-Cəm', ru: 'Джам-и Джам', en: 'Jam-i Jam' },
  'saib-qezeller': { az: 'Fars dilində divan: qəzəllər', ru: 'Персидский диван: газели', en: 'Persian Divan: Ghazals' },
  'saib-turki-qezeller': { az: 'Türki qəzəllər', ru: 'Тюркские газели', en: 'Turkic Ghazals' },
  'saib-qesideler': { az: 'Fars dilində divan: qəsidələr', ru: 'Персидский диван: касыды', en: 'Persian Divan: Qasidas' },
  'saib-perakende': { az: 'Fars dilində divan: pərakəndə şeirlər', ru: 'Персидский диван: отдельные стихотворения', en: 'Persian Divan: Miscellaneous Poems' },
};

export const isLegacyGanjoorSlug = (slug: string) => /^ganjoor-\d+$/.test(slug);
