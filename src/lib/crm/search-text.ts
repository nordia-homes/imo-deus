// Shared by CRM search and assistant reads. Never changes stored names or IDs.
export function normalizeCrmSearch(value: unknown): string {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('ro-RO').replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

function values(value: unknown, depth = 0): string[] {
  if (typeof value === 'string' || typeof value === 'number') return [String(value)];
  if (!value || typeof value !== 'object' || depth > 8) return [];
  return Object.values(value).flatMap(item => values(item, depth + 1));
}

export function matchesCrmSearch(record: unknown, query: string): boolean {
  const needle = normalizeCrmSearch(query);
  if (!needle) return false;
  const fields = values(record);
  // Phone formatting may vary, but digits must belong to one field.
  if (/^[+\d\s().-]+$/.test(query) && query.replace(/\D/g, '').length >= 6) {
    const phone = (value: string) => {
      let digits = value.replace(/\D/g, '').replace(/^00/, '');
      if (/^0\d{9}$/.test(digits)) digits = '40' + digits.slice(1);
      return digits;
    };
    const digits = phone(query);
    return fields.some(field => /^[+\d\s().-]+$/.test(field) && phone(field).includes(digits));
  }
  const haystack = fields.map(normalizeCrmSearch).join(' ');
  return needle.split(' ').every(token => haystack.includes(token));
}
