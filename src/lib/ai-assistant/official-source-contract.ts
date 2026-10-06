import { z } from 'zod';
export const officialAuthorities: Record<string, string> = { 'legislatie.just.ro': 'Ministerul Justiției', 'www.ancpi.ro': 'ANCPI', 'www.anaf.ro': 'ANAF', 'mfinante.gov.ro': 'Ministerul Finanțelor', 'www.uniuneanotarilor.ro': 'UNNPR', 'monitoruloficial.ro': 'Monitorul Oficial' };
export function officialUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password || url.hash || !Object.hasOwn(officialAuthorities, url.hostname)) throw new Error('Folosește un URL HTTPS de pe o sursă oficială permisă.');
  return url;
}
export const officialUrlSchema = z.string().url().max(2000).refine(value => { try { officialUrl(value); return true; } catch { return false; } }, 'Sursă oficială HTTPS necesară.');
