import { z } from 'zod';
import type { RomimoCatalog, RomimoState } from './types';
import { readBoundedText } from './transport';

const BASE_URL = 'https://services.romimo.ro';
export class RomimoError extends Error {
  constructor(message: string, public status = 400, public remoteStatus?: number) { super(message); }
}

export async function romimoRequest(path: string, options: { method?: 'GET' | 'POST' | 'DELETE'; token?: string; query?: Record<string, string>; body?: unknown } = {}) {
  const url = new URL(path, BASE_URL);
  if (url.origin !== BASE_URL || !url.pathname.startsWith('/api/')) throw new RomimoError('Adresă Romimo neacceptată.');
  for (const [key, value] of Object.entries(options.query || {})) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method || 'GET', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { Accept: 'application/json', 'x-api-version': '2', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    // Never propagate fetch errors containing the Token URL / API key.
    throw new RomimoError('Romimo nu a răspuns. Verifică starea anunțului înainte de a retrimite.', 502);
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    const message = response.status === 401 ? 'Autorizarea Romimo a fost refuzată. Verifică cheia API și accesul contului.'
      : response.status === 429 ? 'Romimo a limitat cererile. Încearcă verificarea mai târziu.'
        : `Romimo a răspuns cu HTTP ${response.status}.`;
    throw new RomimoError(message, 502, response.status);
  }
  try {
    const text = await readBoundedText(response.body, 2_000_000);
    let data: unknown = null;
    if (text.trim()) { try { data = JSON.parse(text); } catch { data = text; } }
    return { data, status: response.status };
  } catch {
    throw new RomimoError('Răspunsul Romimo nu a putut fi citit. Verifică starea anunțului.', 502);
  }
}

export function parseToken(data: unknown): string {
  const object = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const value = typeof data === 'string' ? data : object.token ?? object.accessToken ?? object.access_token;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) {
    throw new RomimoError('Formatul tokenului Romimo trebuie validat cu contul de test. Conexiunea nu a fost salvată.', 502);
  }
  return value;
}

export async function getToken(apiKey: string) {
  return parseToken((await romimoRequest('/api/Token', { method: 'POST', query: { ApiKey: apiKey } })).data);
}

const categorySchema = z.object({ id: z.number().int(), description: z.string(), dealType: z.string() });
const fieldSchema = z.object({
  key: z.string(), description: z.string(), valueType: z.string(), isRequired: z.boolean(),
  predefinedValues: z.array(z.string()).nullable(), multipleValuesAllowed: z.boolean(),
  multipleValuesSeparator: z.string().nullable(), validCategories: z.array(categorySchema),
});
export async function getLiveCatalog(): Promise<RomimoCatalog> {
  const [categories, currencies, fields] = await Promise.all([
    romimoRequest('/api/Resources/Categories'), romimoRequest('/api/Resources/Currencies'), romimoRequest('/api/Resources/Properties'),
  ]);
  try {
    return {
      categories: z.array(categorySchema).min(1).parse(categories.data), currencies: z.array(z.string()).min(1).parse(currencies.data),
      properties: z.array(fieldSchema).min(1).parse(fields.data).map(({ validCategories, ...field }) => ({ ...field, categoryIds: validCategories.map(c => c.id) })),
    };
  } catch { throw new RomimoError('Nomenclatorul Romimo are un format necunoscut. Publicarea este oprită până la verificare.', 502); }
}

export function safeListingUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && ['romimo.ro', 'www.romimo.ro', 'publi24.ro', 'www.publi24.ro'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

// The Swagger defines input DTOs, but no successful response schemas. Only
// recognize an explicit matching external ID and boolean active; numeric status
// codes, free-text success messages and HTTP 200 alone never mean "published".
export function readArticleState(data: unknown, externalId: string): { state: RomimoState; remoteUrl: string | null; message: string } {
  const outer = data && typeof data === 'object' && !Array.isArray(data) ? data as Record<string, unknown> : {};
  const nested = outer.ad;
  const ad = nested && typeof nested === 'object' && !Array.isArray(nested) ? nested as Record<string, unknown> : outer;
  if ((ad.externalid ?? ad.externalId) === externalId && typeof ad.active === 'boolean') {
    return { state: ad.active ? 'published' : 'unpublished', remoteUrl: safeListingUrl(ad.url ?? outer.url), message: ad.active ? 'Romimo raportează anunțul activ.' : 'Romimo raportează anunțul inactiv.' };
  }
  return { state: 'pending', remoteUrl: null, message: 'Răspuns primit; starea publicării nu este confirmată. Formatul răspunsului trebuie validat cu contul de test.' };
}
