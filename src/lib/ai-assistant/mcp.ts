import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { StringDecoder } from 'node:string_decoder';
import { z } from 'zod';
import { safeData } from './contracts';
import { featureFlags } from './skills';
import type { AssistantContext } from './access';
const serverSchema = z.object({ id: z.string().regex(/^[a-z0-9_-]+$/), endpoint: z.string().url(), agencyIds: z.array(z.string()).length(1), tools: z.array(z.string()).max(50), disabled: z.boolean().default(false), timeoutMs: z.number().int().min(1000).max(15000).default(8000), tokenEnv: z.string().regex(/^JARVIS_MCP_TOKEN_[A-Z0-9_]+$/).optional() }).strict();
export function publicAddress(address: string) {
  if (!isIP(address)) return false;
  if (address.includes(':')) return /^[23][0-9a-f]{3}:/i.test(address) && !/^(2001:db8|2002:)/i.test(address);
  const parts = address.split('.').map(Number); return parts[0] < 224 && ![0, 10, 127, 169, 192].includes(parts[0]) && !(parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) && !(parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) && !(parts[0] === 198 && [18, 19, 51].includes(parts[1])) && !(parts[0] === 203 && parts[1] === 0 && parts[2] === 113);
}
export async function validateMcpEndpoint(endpoint: string) {
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443') || isIP(url.hostname) || !url.hostname.includes('.') || url.hostname.endsWith('.local')) throw new Error('MCP endpoint refuzat.');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(row => !publicAddress(row.address))) throw new Error('MCP adresă privată/refuzată.');
  return { url, addresses };
}
export function configuredMcpServers(ctx: Pick<AssistantContext, 'agencyId'>) {
  if (!featureFlags().mcp) return [];
  return z.array(serverSchema).max(10).parse(JSON.parse(process.env.JARVIS_MCP_SERVERS || '[]')).filter(server => !server.disabled && server.agencyIds.includes(ctx.agencyId));
}
// Read-only external tools only. Mutations must get an explicit internal approval adapter.
export async function mcpRequest(ctx: AssistantContext, serverId: string, method: 'tools/list' | 'tools/call', tool?: string, args: Record<string, unknown> = {}) {
  const server = configuredMcpServers(ctx).find(row => row.id === serverId);
  if (!server || (method === 'tools/call' && (!tool || !server.tools.includes(tool)))) throw new Error('MCP server/tool neautorizat pentru agenție.');
  const { url, addresses } = await validateMcpEndpoint(server.endpoint);
  let session: string | undefined; const started = Date.now();
  const rpc = (rpcMethod: string, params: unknown, notification = false): Promise<any> => new Promise((resolve, reject) => {
    const id = notification ? undefined : `${ctx.agencyId}:${Date.now()}:${rpcMethod}`;
    const body = JSON.stringify({ jsonrpc: '2.0', ...(id ? { id } : {}), method: rpcMethod, params });
    const remaining = server.timeoutMs - (Date.now() - started); if (remaining <= 0) { reject(new Error('MCP timeout')); return; }
    const req = httpsRequest(url, { method: 'POST', lookup: (_host, options, callback) => { const done = callback as any; if ((options as any).all) done(null, addresses); else done(null, addresses[0].address, addresses[0].family); }, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-03-26', 'Content-Length': Buffer.byteLength(body), ...(session ? { 'Mcp-Session-Id': session } : {}), ...(server.tokenEnv ? { Authorization: 'Bearer ' + (process.env[server.tokenEnv] || '') } : {}) }, signal: AbortSignal.timeout(remaining) }, response => {
      if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) { response.destroy(); reject(new Error('MCP răspuns refuzat.')); return; }
      const sessionHeader = response.headers['mcp-session-id']; if (sessionHeader) { const value = String(sessionHeader); if (!/^[\x21-\x7e]{1,200}$/.test(value)) { response.destroy(); reject(new Error('MCP session invalidă')); return; } session = value; }
      let raw = '', bytes = 0; const decoder = new StringDecoder('utf8');
      const sse = String(response.headers['content-type']).includes('text/event-stream');
      response.on('data', chunk => {
        bytes += chunk.length; if (bytes > 50000) { response.destroy(); reject(new Error('MCP rezultat prea mare')); return; } raw += decoder.write(chunk);
        if (sse && !notification) {
          const frames = raw.split(/\r?\n\r?\n/).slice(0, -1);
          for (const frame of frames) { try { const payload = frame.split(/\r?\n/).filter(line => line.startsWith('data: ')).map(line => line.slice(6)).join('\n'); if (!payload) continue; const row = JSON.parse(payload); if (row.id === id) { if (row.error || row.result?.isError) reject(new Error('MCP rezultat invalid')); else resolve(row.result); response.destroy(); return; } } catch { reject(new Error('MCP rezultat invalid')); response.destroy(); return; } }
        }
      });
      response.on('error', () => reject(new Error('MCP transport întrerupt.')));
      response.on('end', () => { try {
        raw += decoder.end();
        if (notification && !raw) { resolve({}); return; }
        const data = String(response.headers['content-type']).includes('text/event-stream') ? raw.split(/\r?\n\r?\n/).filter(line => line.includes('data: ')).map(line => JSON.parse(line.split(/\r?\n/).filter(part => part.startsWith('data: ')).map(part => part.slice(6)).join('\n'))).find(row => row.id === id) : JSON.parse(raw);
        if (!data || data.id !== id || data.error || data.result?.isError) throw new Error('MCP rezultat invalid'); resolve(data.result);
      } catch { reject(new Error('MCP rezultat invalid')); } });
    });
    req.on('error', () => reject(new Error('MCP transport indisponibil'))); req.end(body);
  });
  const init = await rpc('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'imodeus-jarvis', version: '2' } });
  if (init.protocolVersion !== '2025-03-26') throw new Error('MCP versiune neacceptată.');
  await rpc('notifications/initialized', {}, true);
  const catalog = await rpc('tools/list', {});
  const allowed = (catalog.tools || []).filter((row: any) => server.tools.includes(row.name) && row.annotations?.readOnlyHint === true);
  if (method === 'tools/list') return { tools: allowed.map((row: any) => ({ name: row.name, description: String(row.description || '').slice(0, 500), inputSchema: row.inputSchema })) };
  const selected = allowed.find((row: any) => row.name === tool); if (!selected) throw new Error('MCP tool nu este declarat read-only.');
  validateMcpArguments(selected.inputSchema, args);
  return safeData(await rpc('tools/call', { name: tool, arguments: args }));
}
export function validateMcpArguments(schema: any, value: unknown, depth = 0): void {
  if (!schema || depth > 8 || schema.$ref || schema.oneOf || schema.anyOf) throw new Error('MCP schema neacceptată.');
  if (schema.enum && !schema.enum.some((candidate: unknown) => JSON.stringify(candidate) === JSON.stringify(value))) throw new Error('MCP enum invalid.');
  if (schema.type === 'object') { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MCP obiect invalid.'); const row = value as Record<string, unknown>; for (const key of schema.required || []) if (!(key in row)) throw new Error('MCP câmp obligatoriu.'); for (const [key, item] of Object.entries(row)) { if (!schema.properties?.[key]) throw new Error('MCP câmp neacceptat.'); validateMcpArguments(schema.properties[key], item, depth + 1); } }
  else if (schema.type === 'array') { if (!Array.isArray(value) || value.length > Math.min(schema.maxItems || 100, 100)) throw new Error('MCP array invalid.'); value.forEach(item => validateMcpArguments(schema.items, item, depth + 1)); }
  else if (schema.type === 'string') { if (typeof value !== 'string' || value.length > Math.min(schema.maxLength || 2000, 2000) || value.length < (schema.minLength || 0)) throw new Error('MCP string invalid.'); }
  else if (schema.type === 'number' || schema.type === 'integer') { if (typeof value !== 'number' || !Number.isFinite(value) || (schema.type === 'integer' && !Number.isInteger(value)) || value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) throw new Error('MCP număr invalid.'); }
  else if (schema.type === 'boolean') { if (typeof value !== 'boolean') throw new Error('MCP boolean invalid.'); }
  else throw new Error('MCP tip neacceptat.');
}
