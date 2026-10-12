import type { TagKind } from '@prisma/client';

export interface TagDef {
  slug: string;
  kind: TagKind;
  az: string;
  ru: string;
  en: string;
}

/**
 * The fixed tag list. Order here is display order within each kind.
 * Slugs are part of public URLs (/tags/<slug>), so never rename one in place.
 */
export const TAGS: TagDef[] = [
  // Themes
  { slug: 'eshq',       kind: 'THEME', az: 'Eşq',              ru: 'О любви',               en: 'Love' },
  { slug: 'ilahi-eshq', kind: 'THEME', az: 'İlahi eşq',        ru: 'О божественной любви',  en: 'Divine love' },
  { slug: 'hicran',     kind: 'THEME', az: 'Hicran',           ru: 'О разлуке',             en: 'Separation' },
  { slug: 'mey',        kind: 'THEME', az: 'Mey və meyxana',   ru: 'О вине',                en: 'Wine and the tavern' },
  { slug: 'tebiet',     kind: 'THEME', az: 'Təbiət və bahar',  ru: 'О природе',             en: 'Nature and spring' },
  { slug: 'felek',      kind: 'THEME', az: 'Fələk və tale',    ru: 'О судьбе',              en: 'Fate' },
  { slug: 'olum',       kind: 'THEME', az: 'Ölüm',             ru: 'О смерти',              en: 'Death' },
  { slug: 'hikmet',     kind: 'THEME', az: 'Hikmət və nəsihət', ru: 'О мудрости',           en: 'Wisdom and advice' },
  { slug: 'veten',      kind: 'THEME', az: 'Vətən',            ru: 'О родине',              en: 'Homeland' },
  { slug: 'medh',       kind: 'THEME', az: 'Mədhiyyə',         ru: 'Хвалебные',             en: 'Praise' },
  { slug: 'satira',     kind: 'THEME', az: 'Satira',           ru: 'Сатира',                en: 'Satire' },
  { slug: 'mersiye',    kind: 'THEME', az: 'Mərsiyə',          ru: 'Плачи',                 en: 'Lament' },
  // Moods
  { slug: 'kederli',    kind: 'MOOD', az: 'Kədərli',    ru: 'Грустные',     en: 'Sad' },
  { slug: 'sevincli',   kind: 'MOOD', az: 'Sevincli',   ru: 'Радостные',    en: 'Joyful' },
  { slug: 'dusunceli',  kind: 'MOOD', az: 'Düşüncəli',  ru: 'Философские',  en: 'Contemplative' },
  { slug: 'istehzali',  kind: 'MOOD', az: 'İstehzalı',  ru: 'Ироничные',    en: 'Ironic' },
  // Audience and length
  { slug: 'usaqlar-ucun', kind: 'AUDIENCE', az: 'Uşaqlar üçün', ru: 'Для детей',  en: 'For children' },
  { slug: 'mekteb',       kind: 'AUDIENCE', az: 'Məktəb üçün',  ru: 'Для школы',  en: 'For school' },
  { slug: 'qisa',         kind: 'AUDIENCE', az: 'Qısa',         ru: 'Короткие',   en: 'Short' },
  { slug: 'uzun',         kind: 'AUDIENCE', az: 'Uzun',         ru: 'Длинные',    en: 'Long' },
  // Eras
  { slug: 'selcuq-dovru',   kind: 'ERA', az: 'Səlcuq dövrü',      ru: 'Сельджукская эпоха', en: 'Seljuk era' },
  { slug: 'sefevi-dovru',   kind: 'ERA', az: 'Səfəvi dövrü',      ru: 'Эпоха Сефевидов',    en: 'Safavid era' },
  { slug: 'asiq-poeziyasi', kind: 'ERA', az: 'Aşıq poeziyası',    ru: 'Ашугская поэзия',    en: 'Ashug tradition' },
  { slug: 'maarifcilik',    kind: 'ERA', az: 'Maarifçilik dövrü', ru: 'Эпоха просвещения',  en: 'Enlightenment' },
  { slug: 'sovet-dovru',    kind: 'ERA', az: 'Sovet dövrü',       ru: 'Советские',          en: 'Soviet era' },
];
