export function normalizeRomanianPhone(value: unknown) {
  let digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('0040') && digits.length === 13) {
    digits = digits.slice(3);
  } else if (digits.startsWith('40') && digits.length === 11) {
    digits = digits.slice(2);
    digits = `0${digits}`;
  }

  if (/^0[237]\d{8}$/.test(digits)) return digits;
  if (/^[237]\d{8}$/.test(digits)) return `0${digits}`;
  if (/^[237]\d{7}$/.test(digits)) return digits;
  return '';
}

export function hasValidRomanianPhone(value: unknown) {
  return Boolean(normalizeRomanianPhone(value));
}
