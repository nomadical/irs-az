import { marked } from 'marked';

marked.setOptions({
  breaks: true, // respect line breaks — critical for poetry
  gfm: true,
});

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string;
}
