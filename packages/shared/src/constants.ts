import type { Language } from './types';

export const LANGUAGE_LABELS: Record<Language, string> = {
  AZ_LATIN: 'Azərbaycanca',
  AZ_ARABIC: 'Azərbaycanca (ərəb)',
  AZ_CYRILLIC: 'Azərbaycanca (kiril)',
  FA: 'Farsca',
  AR: 'Ərəbcə',
  RU: 'Rusca',
  EN: 'English',
  TR: 'Türkcə',
};

export const LANGUAGE_LABELS_RU: Record<Language, string> = {
  AZ_LATIN: 'Азербайджанский',
  AZ_ARABIC: 'Азербайджанский (араб.)',
  AZ_CYRILLIC: 'Азербайджанский (кирил.)',
  FA: 'Персидский',
  AR: 'Арабский',
  RU: 'Русский',
  EN: 'Английский',
  TR: 'Турецкий',
};

export const RTL_LANGUAGES: Language[] = ['FA', 'AR', 'AZ_ARABIC'];

export const CENTURIES = [
  { value: 12, labelAz: 'XII əsr', labelRu: 'XII век', labelEn: '12th c.' },
  { value: 13, labelAz: 'XIII əsr', labelRu: 'XIII век', labelEn: '13th c.' },
  { value: 14, labelAz: 'XIV əsr', labelRu: 'XIV век', labelEn: '14th c.' },
  { value: 15, labelAz: 'XV əsr', labelRu: 'XV век', labelEn: '15th c.' },
  { value: 16, labelAz: 'XVI əsr', labelRu: 'XVI век', labelEn: '16th c.' },
  { value: 17, labelAz: 'XVII əsr', labelRu: 'XVII век', labelEn: '17th c.' },
  { value: 18, labelAz: 'XVIII əsr', labelRu: 'XVIII век', labelEn: '18th c.' },
  { value: 19, labelAz: 'XIX əsr', labelRu: 'XIX век', labelEn: '19th c.' },
  { value: 20, labelAz: 'XX əsr', labelRu: 'XX век', labelEn: '20th c.' },
  { value: 21, labelAz: 'XXI əsr', labelRu: 'XXI век', labelEn: '21st c.' },
];
