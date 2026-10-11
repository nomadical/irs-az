import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = 'image/png';

// Light-theme tokens from styles/globals.css
const BG = '#F4EFE6';
const INK = '#1C1916';
const POMEG = '#8E1515';
const MUTED = '#6B5E52';

const SUBSETS = ['latin', 'latin-ext', 'cyrillic'];

// Satori only uses the first font registered under a name, so each subset gets
// its own name and the families below list them as a fallback chain.
const SERIF = SUBSETS.map((s) => `Cormorant-${s}`).join(', ');
const SANS = SUBSETS.map((s) => `Inter-${s}`).join(', ');

async function loadFonts() {
  const dir = join(process.cwd(), 'assets/fonts');
  const load = (file: string) => readFile(join(dir, file));
  return Promise.all([
    ...SUBSETS.map(async (s) => ({
      name: `Cormorant-${s}`, weight: 600 as const, style: 'normal' as const,
      data: await load(`cormorant-garamond-${s}-600.woff`),
    })),
    ...SUBSETS.map(async (s) => ({
      name: `Inter-${s}`, weight: 500 as const, style: 'normal' as const,
      data: await load(`inter-${s}-500.woff`),
    })),
  ]);
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

const Diamond = ({ size = 10 }: { size?: number }) => (
  <div style={{ width: size, height: size, background: POMEG, transform: 'rotate(45deg)' }} />
);

interface Card {
  /** Small caps label top-right, e.g. "Qəzəl" or "Şair". */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Opening lines of a poem or bio, max 3 shown. */
  lines?: string[];
}

/** Gazette-style 1200×630 share card. */
export async function ogCard({ eyebrow, title, subtitle, lines = [] }: Card) {
  const shown = lines.slice(0, 3).map((l) => clip(l, 70));
  const titleSize = title.length > 45 ? 60 : title.length > 25 ? 76 : 92;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: BG, color: INK, padding: '52px 72px', fontFamily: SANS,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 52, lineHeight: 1 }}>
            <span style={{ color: POMEG }}>IRS</span>
            <span>.AZ</span>
          </div>
          {eyebrow && (
            <div style={{ fontSize: 20, letterSpacing: 4, textTransform: 'uppercase', color: MUTED }}>
              {clip(eyebrow, 40)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
          <div style={{ height: 3, background: POMEG }} />
          <div style={{ height: 1, background: POMEG, marginTop: 4 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }}>
          <div style={{ fontFamily: SERIF, fontSize: titleSize, lineHeight: 1.05, lineClamp: 2 }}>
            {clip(title, 90)}
          </div>
          {subtitle && <div style={{ marginTop: 18, fontSize: 26, color: MUTED }}>{clip(subtitle, 80)}</div>}
          {shown.length > 0 && (
            <div
              style={{
                display: 'flex', flexDirection: 'column', marginTop: 32, paddingLeft: 24,
                borderLeft: `3px solid ${POMEG}`, fontFamily: SERIF, fontSize: 34, lineHeight: 1.3,
              }}
            >
              {shown.map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18 }}>
          <Diamond size={8} />
          <Diamond />
          <Diamond size={8} />
        </div>
      </div>
    ),
    { ...ogSize, fonts: await loadFonts() },
  );
}
