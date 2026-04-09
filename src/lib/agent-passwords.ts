const CITY_NAMES = [
  'Oradea',
  'Sibiu',
  'Brasov',
  'Iasi',
  'Arad',
  'Cluj',
  'Deva',
  'Buzau',
  'Ploiesti',
  'Tulcea',
  'Craiova',
  'Bacau',
];

const SPECIAL_CHARACTERS = ['!', '@', '#', '$'];

function randomInt(min: number, max: number) {
  const secureCrypto = globalThis.crypto;
  if (secureCrypto?.getRandomValues) {
    const values = new Uint32Array(1);
    secureCrypto.getRandomValues(values);
    return min + (values[0] % (max - min + 1));
  }

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function stripDiacritics(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function normalizeCityToken(nameSeed?: string | null) {
  const candidate = stripDiacritics(nameSeed || '')
    .split(/\s+/)
    .map((token) => token.replace(/[^a-zA-Z]/g, ''))
    .find((token) => token.length >= 3);

  if (candidate) {
    return capitalize(candidate).slice(0, 7);
  }

  return CITY_NAMES[randomInt(0, CITY_NAMES.length - 1)];
}

function buildPasswordFromBase(base: string) {
  const digits = String(randomInt(10, 99));
  const special = SPECIAL_CHARACTERS[randomInt(0, SPECIAL_CHARACTERS.length - 1)];
  const maxBaseLength = 10 - digits.length - special.length;
  const trimmedBase = base.slice(0, Math.max(5, maxBaseLength));
  return `${trimmedBase}${digits}${special}`;
}

export function generateAgentPassword(nameSeed?: string | null) {
  const base = normalizeCityToken(nameSeed);
  return buildPasswordFromBase(base);
}

export function generateAgentPasswordSuggestions(nameSeed?: string | null, count = 3) {
  const base = normalizeCityToken(nameSeed);
  const suggestions = new Set<string>();

  while (suggestions.size < count) {
    suggestions.add(buildPasswordFromBase(base));
  }

  return Array.from(suggestions);
}

export function normalizeAgentEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidManagedAgentPassword(password: string) {
  return /^(?=.*[A-Za-z])(?=(?:.*\d){2,})(?=.*[!@#$])[A-Za-z\d!@#$]{8,10}$/.test(password);
}
