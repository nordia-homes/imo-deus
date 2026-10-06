import type { AssistantSearch } from './contracts';

// Preserve declared intervals without inventing an exact year. Only the dedicated
// construction field is parsed; marketing prose and renovation dates are ignored.
export function constructionYearEvidence(row: Record<string, unknown>) {
  const raw = row.constructionYear ?? row.year ?? row.constructionYearValue;
  const candidate = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : NaN;
  const year = Number.isInteger(candidate) && candidate >= 1800 && candidate <= new Date().getFullYear() + 1 ? candidate : null;
  let lower = year, upper = year;
  let kind: 'exact' | 'declared_interval' | 'unknown' = year === null ? 'unknown' : 'exact';
  if (year === null && typeof raw === 'string') {
    const label = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[_\s]+/g, ' ');
    const range = /^(\d{4})\s*[-–]\s*(\d{4})$/.exec(label);
    const after = /^(?:dupa|after) (\d{4})$/.exec(label);
    const before = /^(?:inainte de|before) (\d{4})$/.exec(label);
    const valid = (value: number) => value >= 1800 && value <= new Date().getFullYear() + 1;
    if (range && valid(Number(range[1])) && valid(Number(range[2])) && Number(range[1]) <= Number(range[2])) { lower = Number(range[1]); upper = Number(range[2]); kind = 'declared_interval'; }
    else if (after && valid(Number(after[1]))) { lower = Number(after[1]) + 1; kind = 'declared_interval'; }
    else if (before && valid(Number(before[1]))) { upper = Number(before[1]) - 1; kind = 'declared_interval'; }
  }
  return { constructionYear: year, constructionYearLabel: typeof raw === 'string' ? raw.slice(0, 120) : year === null ? null : String(year), constructionYearKnown: year !== null, constructionYearEvidenceKind: kind, constructionYearLowerBound: lower, constructionYearUpperBound: upper };
}

export function validateSearchCriteria(input: AssistantSearch) {
  if (input.excludeImported && input.source !== 'owners') throw new Error('Excluderea importurilor se aplică numai anunțurilor de proprietari.');
  if (input.yearMin !== undefined && input.yearMax !== undefined && input.yearMin > input.yearMax) throw new Error('Intervalul anului construcției este inversat.');
  if (input.priceMin !== undefined && input.priceMax !== undefined && input.priceMin > input.priceMax) throw new Error('Intervalul de preț este inversat.');
  if (input.rooms !== undefined && input.roomsAny !== undefined) throw new Error('Folosește rooms sau roomsAny, nu ambele.');
  if (input.roomsAny && new Set(input.roomsAny).size !== input.roomsAny.length) throw new Error('Numărul de camere se repetă.');
}

export function matchesConstructionYear(row: Record<string, unknown>, input: AssistantSearch) {
  const evidence = constructionYearEvidence(row);
  if (input.yearLabel === 'after_1977' && !(evidence.constructionYearEvidenceKind === 'declared_interval' && evidence.constructionYearLowerBound === 1978 && evidence.constructionYearUpperBound === null)) return false;
  if (input.unknownYear === 'only') return evidence.constructionYearEvidenceKind === 'unknown';
  const bounded = input.yearMin !== undefined || input.yearMax !== undefined;
  if (!bounded) return evidence.constructionYearEvidenceKind !== 'unknown' || input.unknownYear !== 'exclude';
  const match = constructionYearFilterSatisfied(row, input);
  return match === true || match === null && input.unknownYear === 'include';
}

// null means insufficient evidence (including partial interval overlap).
export function constructionYearFilterSatisfied(row: Record<string, unknown>, input: AssistantSearch): boolean | null {
  if (input.yearMin === undefined && input.yearMax === undefined) return null;
  const evidence = constructionYearEvidence(row), lower = evidence.constructionYearLowerBound, upper = evidence.constructionYearUpperBound;
  if (evidence.constructionYearEvidenceKind === 'unknown') return null;
  if (input.yearMin !== undefined && upper !== null && upper < input.yearMin || input.yearMax !== undefined && lower !== null && lower > input.yearMax) return false;
  if ((input.yearMin === undefined || lower !== null && lower >= input.yearMin) && (input.yearMax === undefined || upper !== null && upper <= input.yearMax)) return true;
  return null;
}
