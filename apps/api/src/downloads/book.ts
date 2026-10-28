import { createHash } from 'crypto';
import { Language } from '@prisma/client';
import { zip } from './zip';

/** What a download contains: one or more sections (collections) of works, original text only */
export interface BookWork {
  slug: string;
  title: string;
  language: Language;
  html: string;
}

export interface BookSection {
  /** Null for a single section that needs no heading of its own */
  title: string | null;
  works: BookWork[];
}

export interface Book {
  /** Stable key for the identifier, e.g. "collection:fuzuli-qezeller" */
  key: string;
  title: string;
  author: string;
  /** "1494–1556", shown under the author on the title page */
  lifespan: string | null;
  language: Language;
  url: string;
  sections: BookSection[];
}

const BCP47: Record<Language, string> = {
  AZ_LATIN: 'az-Latn',
  AZ_ARABIC: 'az-Arab',
  AZ_CYRILLIC: 'az-Cyrl',
  FA: 'fa',
  AR: 'ar',
  RU: 'ru',
  EN: 'en',
  TR: 'tr',
};
const RTL: Language[] = ['FA', 'AR', 'AZ_ARABIC'];

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

function esc(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function langAttrs(language: Language) {
  const lang = BCP47[language];
  return `lang="${lang}" xml:lang="${lang}" dir="${RTL.includes(language) ? 'rtl' : 'ltr'}"`;
}

/** A title's own language and direction: Persian titles inside Latin pages and vice versa */
function titleAttrs(title: string, fallback: Language) {
  return langAttrs(ARABIC_SCRIPT.test(title) ? (RTL.includes(fallback) ? fallback : 'FA') : RTL.includes(fallback) ? 'AZ_LATIN' : fallback);
}

const NAMED_ENTITIES: Record<string, string> = { nbsp: '&#160;', mdash: '&#8212;', ndash: '&#8211;', hellip: '&#8230;' };

/** The stored bodyHtml (marked output) as well-formed XHTML */
export function toXhtml(html: string) {
  return html
    .replace(/<(br|hr|img|wbr|col)(\s[^>]*?)?\s*\/?>/gi, (_m, tag: string, attrs = '') => `<${tag.toLowerCase()}${attrs}/>`)
    .replace(/&([a-z]+);/gi, (m, name: string) =>
      ['amp', 'lt', 'gt', 'quot', 'apos'].includes(name) ? m : NAMED_ENTITIES[name] ?? '',
    );
}

/** Plain text of a work: verse lines kept, stanzas separated by a blank line */
export function toText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n* * *\n')
    .replace(/<\/(p|h[1-6]|li|tr|blockquote|pre|table|ul|ol)>/gi, '\n\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Deterministic UUID (v5 layout) so a re-download keeps the same book identifier */
function bookUuid(key: string) {
  const h = createHash('sha1').update(`irs.az:${key}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const CSS = `body { margin: 0 1em; line-height: 1.6; }
h1, h2 { text-align: center; line-height: 1.25; margin: 1.5em 0 1em; }
h1 { font-size: 1.6em; }
h2 { font-size: 1.3em; }
p { margin: 0 0 1em; }
[dir="rtl"] { font-family: "Noto Naskh Arabic", "Amiri", "Geeza Pro", serif; }
.title-page { text-align: center; margin-top: 20%; }
.author { font-size: 1.2em; margin-top: 2em; }
.small { font-size: 0.85em; margin-top: 3em; }
section.part { text-align: center; margin-top: 30%; }
`;

function page(title: string, language: Language, body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" ${langAttrs(language)}>
<head>
<meta charset="UTF-8"/>
<title>${esc(title)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${body}
</body>
</html>
`;
}

export function buildEpub(book: Book, rightsNote: string): Buffer {
  const now = new Date();
  const modified = now.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const multi = book.sections.length > 1;

  type Item = { id: string; href: string; xhtml: string; props?: string };
  const items: Item[] = [];
  const navEntries: string[] = [];
  let n = 0;

  items.push({
    id: 'titlepage',
    href: 'title.xhtml',
    xhtml: page(
      book.title,
      book.language,
      `<section class="title-page" epub:type="titlepage">
<h1 ${titleAttrs(book.title, book.language)}>${esc(book.title)}</h1>
<p class="author" lang="az-Latn" xml:lang="az-Latn" dir="ltr">${esc(book.author)}${book.lifespan ? `<br/>${esc(book.lifespan)}` : ''}</p>
<p class="small" lang="az-Latn" xml:lang="az-Latn" dir="ltr">IRS.AZ · ${esc(book.url)}<br/>${esc(rightsNote)}</p>
</section>`,
    ),
  });

  book.sections.forEach((section, s) => {
    const workLinks: string[] = [];
    let sectionHref: string | null = null;
    if (multi && section.title) {
      sectionHref = `part-${s + 1}.xhtml`;
      items.push({
        id: `part${s + 1}`,
        href: sectionHref,
        xhtml: page(
          section.title,
          book.language,
          `<section class="part" epub:type="part"><h1 ${titleAttrs(section.title, book.language)}>${esc(section.title)}</h1></section>`,
        ),
      });
    }
    for (const work of section.works) {
      n += 1;
      const href = `w${String(n).padStart(5, '0')}.xhtml`;
      items.push({
        id: `w${n}`,
        href,
        xhtml: page(
          work.title,
          work.language,
          `<section epub:type="chapter">
<h2 ${titleAttrs(work.title, work.language)}>${esc(work.title)}</h2>
${toXhtml(work.html)}
</section>`,
        ),
      });
      workLinks.push(`<li><a href="${href}">${esc(work.title)}</a></li>`);
    }
    if (sectionHref) {
      navEntries.push(
        `<li><a href="${sectionHref}">${esc(section.title!)}</a>${workLinks.length ? `\n<ol>\n${workLinks.join('\n')}\n</ol>` : ''}</li>`,
      );
    } else {
      navEntries.push(...workLinks);
    }
  });

  const nav = page(
    book.title,
    book.language,
    `<nav epub:type="toc" id="toc">
<h1 ${titleAttrs(book.title, book.language)}>${esc(book.title)}</h1>
<ol>
<li><a href="title.xhtml">${esc(book.title)}</a></li>
${navEntries.join('\n')}
</ol>
</nav>`,
  );

  const rtl = RTL.includes(book.language);
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="${BCP47[book.language]}"${rtl ? ' dir="rtl"' : ''}>
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">urn:uuid:${bookUuid(book.key)}</dc:identifier>
<dc:title>${esc(book.title)}</dc:title>
<dc:creator id="creator">${esc(book.author)}</dc:creator>
<meta refines="#creator" property="role" scheme="marc:relators">aut</meta>
<dc:language>${BCP47[book.language]}</dc:language>
<dc:publisher>IRS.AZ</dc:publisher>
<dc:source>${esc(book.url)}</dc:source>
<dc:rights>${esc(rightsNote)}</dc:rights>
<meta property="dcterms:modified">${modified}</meta>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
${items.map((i) => `<item id="${i.id}" href="${i.href}" media-type="application/xhtml+xml"/>`).join('\n')}
</manifest>
<spine${rtl ? ' page-progression-direction="rtl"' : ''}>
${items.map((i) => `<itemref idref="${i.id}"/>`).join('\n')}
</spine>
</package>
`;

  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>
`;

  return zip(
    [
      { name: 'mimetype', data: 'application/epub+zip', store: true },
      { name: 'META-INF/container.xml', data: container },
      { name: 'OEBPS/content.opf', data: opf },
      { name: 'OEBPS/nav.xhtml', data: nav },
      { name: 'OEBPS/style.css', data: CSS },
      ...items.map((i) => ({ name: `OEBPS/${i.href}`, data: i.xhtml })),
    ],
    now,
  );
}

export function buildText(book: Book, rightsNote: string): string {
  const out: string[] = [book.title, book.lifespan ? `${book.author} (${book.lifespan})` : book.author, ''];
  const multi = book.sections.length > 1;
  const single = book.sections.length === 1 && book.sections[0].works.length === 1;
  for (const section of book.sections) {
    if (multi && section.title) out.push('', `== ${section.title} ==`, '');
    for (const work of section.works) {
      // A single work's title is already the file's heading
      out.push('', ...(single ? [] : [work.title, '']), toText(work.html), '', '* * *');
    }
  }
  out.push('', `IRS.AZ · ${book.url}`, rightsNote, '');
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n');
}
