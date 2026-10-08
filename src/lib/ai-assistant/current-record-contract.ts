import { z } from 'zod';

export const currentRecordSchema = z.object({
  resource: z.enum(['contacts', 'properties']),
  id: z.string().min(1).max(180).regex(/^[^/\u0000-\u001f]+$/),
}).strict();
export type CurrentRecord = z.infer<typeof currentRecordSchema>;

// Snapshot the page at command submission; do not reuse a previous page's selection.
export function currentRecordFromPath(pathname: string): CurrentRecord | undefined {
  const match = /^\/(leads|properties)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return undefined;
  let id: string;
  try { id = decodeURIComponent(match[2]); } catch { return undefined; }
  const parsed = currentRecordSchema.safeParse({ resource: match[1] === 'leads' ? 'contacts' : 'properties', id });
  return parsed.success ? parsed.data : undefined;
}
