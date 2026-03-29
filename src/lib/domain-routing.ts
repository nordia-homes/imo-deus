import { firebaseConfig } from '@/firebase/config';

export function normalizeDomain(input?: string | null): string {
  if (!input) return '';

  let value = input.trim().toLowerCase();
  if (value.includes(',')) {
    value = value.split(',')[0].trim();
  }
  value = value.replace(/^https?:\/\//, '');
  value = value.replace(/\/.*$/, '');
  value = value.replace(/:\d+$/, '');
  value = value.replace(/\.$/, '');

  return value;
}

export function getCanonicalCustomDomain(input?: string | null): string {
  const normalized = normalizeDomain(input);
  if (!normalized) return '';

  if (normalized.startsWith('www.') && !normalized.includes('localhost') && !normalized.startsWith('127.0.0.1')) {
    return normalized.slice(4);
  }

  return normalized;
}

export function getDomainAliases(domain: string): string[] {
  const normalized = getCanonicalCustomDomain(domain);
  if (!normalized) return [];

  const aliases = new Set<string>([normalized]);

  if (normalized.startsWith('www.')) {
    aliases.add(normalized.slice(4));
  } else if (!normalized.includes('localhost') && !normalized.startsWith('127.0.0.1')) {
    aliases.add(`www.${normalized}`);
  }

  return Array.from(aliases);
}

export function isPlatformHost(hostname: string): boolean {
  const normalized = normalizeDomain(hostname);
  if (!normalized) return false;

  const envHosts = (process.env.NEXT_PUBLIC_PLATFORM_HOSTS || '')
    .split(',')
    .map((host) => normalizeDomain(host))
    .filter(Boolean);

  const knownHosts = new Set<string>([
    'localhost',
    '127.0.0.1',
    normalizeDomain(firebaseConfig.authDomain),
    ...envHosts,
  ]);

  if (knownHosts.has(normalized)) return true;
  if (normalized.endsWith('.web.app')) return true;
  if (normalized.endsWith('.firebaseapp.com')) return true;
  if (normalized.endsWith('.hosted.app')) return true;

  return false;
}

export function buildPublicPath(basePath: string, path = ''): string {
  const normalizedPath = path
    ? path.startsWith('/')
      ? path
      : `/${path}`
    : '';

  if (!basePath) {
    return normalizedPath || '/';
  }

  return `${basePath}${normalizedPath}`;
}
