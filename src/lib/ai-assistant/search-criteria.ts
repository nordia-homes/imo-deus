import type { AssistantSearch } from './contracts';

// A range, marketing text or a renovation date is not an exact construction year.
// Prefer the original field; a stale numeric projection must not override it.
export function constructionYearEvidence(row: Record<string, unknown>) {
  const raw = row.constructionYear ?? row.year ?? row.constructionYearValue;
  const candidate = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  const year = Number.isInteger(candidate) && candidate >= 1800 && candidate <= new Date().getFullYear() + 1 ? candidate : null;
  return { constructionYear: year, constructionYearLabel: typeof raw === 'string' ? raw.slice(0, 120) : year === null ? null : String(year), constructionYearKnown: year !== null };
}

export function validateSearchCriteria(input: AssistantSearch) {
  if (input.yearMin !== undefined && input.yearMax !== undefined && input.yearMin > input.yearMax) throw new Error('Intervalul anului construcției este inversat.');
  if (input.priceMin !== undefined && input.priceMax !== undefined && input.priceMin > input.priceMax) throw new Error('Intervalul de preț este inversat.');
  if (input.rooms !== undefined && input.roomsAny !== undefined) throw new Error('Folosește rooms sau roomsAny, nu ambele.');
  if (input.roomsAny && new Set(input.roomsAny).size !== input.roomsAny.length) throw new Error('Numărul de camere se repetă.');
}

export function matchesConstructionYear(row: Record<string, unknown>, input: AssistantSearch) {
  const { constructionYear: year } = constructionYearEvidence(row);
  if (input.unknownYear === 'only') return year === null;
  const bounded = input.yearMin !== undefined || input.yearMax !== undefined;
  if (year === null) return input.unknownYear === 'include' || !bounded && input.unknownYear !== 'exclude';
  return (input.yearMin === undefined || year >= input.yearMin) && (input.yearMax === undefined || year <= input.yearMax);
}
