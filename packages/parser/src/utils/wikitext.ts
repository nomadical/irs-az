/**
 * Wikitext → Markdown converter and related utilities.
 */

/** Convert wikitext markup to clean Markdown */
export function wikitextToMarkdown(wikitext: string): string {
  let text = wikitext;

  // Remove <ref>...</ref> and <ref ... />
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  text = text.replace(/<ref[^>]*\/>/gi, '');

  // Remove categories [[Kateqoriya:...]] / [[Категория:...]] / [[Category:...]]
  text = text.replace(/\[\[(Kateqoriya|Категория|Category|Təsnifat):[^\]]+\]\]/gi, '');

  // Remove templates {{...}} — simple non-nested
  text = text.replace(/\{\{[^{}]*\}\}/g, '');
  // Second pass for one level of nesting
  text = text.replace(/\{\{[^{}]*\}\}/g, '');

  // Handle <poem> tags — preserve content with line breaks
  text = text.replace(/<poem>([\s\S]*?)<\/poem>/gi, (_, content: string) => {
    return content
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .join('\n');
  });

  // Remove remaining HTML tags (but keep content)
  text = text.replace(/<\/?[a-z][^>]*>/gi, '');

  // Convert bold: '''text''' → **text**
  text = text.replace(/'''([^']+)'''/g, '**$1**');

  // Convert italic: ''text'' → *text*
  text = text.replace(/''([^']+)''/g, '*$1*');

  // Convert internal links: [[Page|display]] → display, [[Page]] → Page
  text = text.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1');

  // Convert external links: [url text] → text
  text = text.replace(/\[https?:\/\/[^\s\]]+ ([^\]]+)\]/g, '$1');
  text = text.replace(/\[https?:\/\/[^\]]+\]/g, '');

  // Numbered lists, before headings turn into "##": "# item" would read as a Markdown
  // heading. Blank lines around the list keep the paragraphs on either side out of it
  text = text.replace(/^##\s*/gm, '   1. ');
  text = text.replace(/^#\s*/gm, '1. ');
  text = text.replace(/((?:^ *1\. .*\n?)+)/gm, (list) => `\n${list.replace(/\n?$/, '\n')}\n`);

  // Convert headings: == Title == → ## Title
  text = text.replace(/^={4}\s*(.+?)\s*={4}/gm, '#### $1');
  text = text.replace(/^={3}\s*(.+?)\s*={3}/gm, '### $1');
  text = text.replace(/^={2}\s*(.+?)\s*={2}/gm, '## $1');

  // Convert lists
  text = text.replace(/^\*\*\*/gm, '      -');
  text = text.replace(/^\*\*/gm, '    -');
  text = text.replace(/^\*/gm, '-');

  // Normalize whitespace: collapse 3+ newlines into 2
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** Count RTL characters to determine script direction */
export function detectScript(text: string): 'LTR' | 'RTL' {
  // Arabic, Persian, Hebrew ranges
  const rtlChars = text.match(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/g);
  const latinChars = text.match(/[a-zA-Z\u00C0-\u024F\u0400-\u04FF]/g);

  const rtlCount = rtlChars?.length ?? 0;
  const latinCount = latinChars?.length ?? 0;

  return rtlCount > latinCount ? 'RTL' : 'LTR';
}

/** Parse a wikitext infobox template into key-value pairs */
export function extractInfobox(wikitext: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Match {{Infobox ... | key = value | ... }}
  const infoboxMatch = wikitext.match(/\{\{(?:Infobox|Məlumat qutusu|Карточка)[^}]*\|[\s\S]*?\}\}/i);
  if (!infoboxMatch) return result;

  const content = infoboxMatch[0];

  // Split on top-level pipes (not inside nested templates/links)
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*\|\s*([^=]+?)\s*=\s*(.*?)\s*$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      const value = match[2]
        .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1') // strip wiki links
        .replace(/\{\{[^}]*\}\}/g, '') // strip templates
        .replace(/<[^>]+>/g, '') // strip HTML
        .trim();
      if (value) {
        result[key] = value;
      }
    }
  }

  return result;
}

/** Extract the first N paragraphs of plain text from wikitext */
export function extractLeadParagraphs(wikitext: string, count = 2): string {
  // Remove everything before the first paragraph (infoboxes, etc.)
  let text = wikitext;

  // Strip infobox templates at the start
  text = text.replace(/^\s*\{\{(?:Infobox|Məlumat qutusu|Карточка)[\s\S]*?\}\}\s*/i, '');

  // Strip images
  text = text.replace(/\[\[(?:Şəkil|Файл|File|Image):[^\]]+\]\]/gi, '');

  // Convert to markdown
  text = wikitextToMarkdown(text);

  // Split into paragraphs and take first N non-empty ones
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20 && !p.startsWith('#') && !p.startsWith('-'));

  return paragraphs.slice(0, count).join('\n\n');
}
