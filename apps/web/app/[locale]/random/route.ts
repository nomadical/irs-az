import { NextResponse, type NextRequest } from 'next/server';
import { api } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** "Random poem": a fresh pick on every visit, so the redirect must never be cached */
export async function GET(req: NextRequest, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const base = process.env.SITE_URL ?? req.url;
  const work = await api.getRandomWork().catch(() => null);
  const target = new URL(work ? `/${locale}/works/${encodeURIComponent(work.slug)}` : `/${locale}/works`, base);
  const res = NextResponse.redirect(target, 307);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
