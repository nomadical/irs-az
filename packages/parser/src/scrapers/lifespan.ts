/**
 * Birth and death years from Wikidata (P569, P570). Wikipedia infoboxes on az and ru mostly
 * pull these from Wikidata through templates, so the wikitext has nothing to parse.
 *
 * A date known only to the decade, one qualified "circa", or one of several competing
 * values (Füzuli's birth: 1480 or 1494) is marked approximate; one known only to the
 * century is left out.
 */
import type { AuthorConfig } from '../types';
import { findWikidataItem, type WikidataItem } from './portraits';

export interface Lifespan {
  wikidata: string;
  bornYear?: number;
  bornYearApprox?: boolean;
  diedYear?: number;
  diedYearApprox?: boolean;
}

const YEAR_PRECISION = 9;
// A century ("+1600", precision 7) names no year at all: Kişvəri's "1450–1600" means XV–XVI əsr
const DECADE_PRECISION = 8;
const CIRCA = 'Q5727902';

function year(item: WikidataItem, prop: string): { year?: number; approx?: boolean } {
  const claims = (item.claims[prop] ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue);
  const preferred = claims.filter((c) => c.rank === 'preferred');
  const chosen = preferred.length ? preferred : claims;
  if (!chosen.length) return {};

  const dated = chosen.filter((c) => c.mainsnak.datavalue.value.precision >= DECADE_PRECISION);
  if (!dated.length) return {};
  const values = dated.map((c) => {
    const v = c.mainsnak.datavalue.value as { time: string; precision: number };
    const y = parseInt(v.time.match(/^[+-]0*(\d+)/)?.[1] ?? '', 10);
    const circa = (c.qualifiers?.P1480 ?? []).some((q: any) => q.datavalue?.value?.id === CIRCA);
    return { year: y, approx: v.precision < YEAR_PRECISION || circa };
  });
  const first = values[0];
  if (!Number.isFinite(first.year)) return {};
  const disputed = new Set(values.map((v) => v.year)).size > 1;
  return { year: first.year, approx: first.approx || disputed || undefined };
}

export async function findLifespan(cfg: AuthorConfig): Promise<Lifespan | null> {
  const item = await findWikidataItem(cfg);
  if (!item) return null;
  const born = year(item, 'P569');
  const died = year(item, 'P570');
  return {
    wikidata: item.id,
    bornYear: born.year,
    bornYearApprox: born.approx,
    diedYear: died.year,
    diedYearApprox: died.approx,
  };
}
