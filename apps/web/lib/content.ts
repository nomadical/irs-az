import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { marked } from 'marked';
import { defaultLocale } from './i18n';

export interface ContentPage {
  title: string;
  description: string;
  html: string;
}

/**
 * Long-form page copy lives in content/pages/<name>.<locale>.md so editors can change it
 * without touching code. Simple frontmatter: `title:` and `description:` lines.
 */
export async function loadPage(name: string, locale: string): Promise<ContentPage> {
  const dir = join(process.cwd(), 'content/pages');
  const raw = await readFile(join(dir, `${name}.${locale}.md`), 'utf-8').catch(() =>
    readFile(join(dir, `${name}.${defaultLocale}.md`), 'utf-8'),
  );

  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = Object.fromEntries(
    (match?.[1] ?? '').split('\n').map((line) => {
      const i = line.indexOf(':');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
  );

  return {
    title: meta.title ?? name,
    description: meta.description ?? '',
    html: await marked.parse(match?.[2] ?? raw),
  };
}
