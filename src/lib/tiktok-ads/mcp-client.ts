import { randomUUID } from 'node:crypto';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import { TikTokAdsError, normalizeTikTokProviderError } from './errors';
import type { JsonSchema, TikTokMcpTool, TikTokOperationClass } from './types';

const MCP_PROTOCOL_VERSION = '2025-06-18';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_READ_RETRIES = 3;
const jsonSchemaValidator = new Ajv2020({ allErrors: true, strict: false, validateFormats: false, allowUnionTypes: true });
const compiledSchemas = new WeakMap<object, ValidateFunction>();

type JsonRpcResponse<T> = {
  jsonrpc: '2.0';
  id?: string | number | null;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
};

type McpResult = {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  structuredContent?: unknown;
  isError?: boolean;
  [key: string]: unknown;
};

type McpSession = {
  sessionId: string | null;
  serverInfo?: { name?: string; version?: string };
  protocolVersion: string;
};

function timeoutMs() {
  const configured = Number(process.env.TIKTOK_MCP_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(configured) ? Math.max(2_000, Math.min(configured, 55_000)) : DEFAULT_TIMEOUT_MS;
}

function maxResponseBytes() {
  const configured = Number(process.env.TIKTOK_MCP_MAX_RESPONSE_BYTES || DEFAULT_MAX_RESPONSE_BYTES);
  return Number.isFinite(configured) ? Math.max(1_024, Math.min(Math.trunc(configured), 20 * 1024 * 1024)) : DEFAULT_MAX_RESPONSE_BYTES;
}

function parseSse(text: string) {
  const data = text.split(/\r?\n\r?\n/)
    .map((event) => event.split(/\r?\n/)
      .filter((line) => line === 'data' || line.startsWith('data:'))
      .map((line) => line === 'data' ? '' : line.slice(5).replace(/^ /, ''))
      .join('\n'))
    .filter((event) => event && event !== '[DONE]');
  if (!data.length) return null;
  return JSON.parse(data[data.length - 1]) as unknown;
}

async function readBoundedBody(response: Response) {
  const limit = maxResponseBytes();
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) {
    await response.body?.cancel().catch(() => undefined);
    throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Răspunsul MCP TikTok depășește limita sigură de dimensiune.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Răspunsul MCP TikTok depășește limita sigură de dimensiune.');
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function parseResponse(response: Response) {
  const text = await readBoundedBody(response);
  if (!text) return null;
  const contentType = response.headers.get('content-type') || '';
  try {
    return contentType.includes('text/event-stream') ? parseSse(text) : JSON.parse(text);
  } catch {
    throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Serverul MCP TikTok a returnat un răspuns care nu este JSON/SSE valid.');
  }
}

function retryAfterMs(response: Response, attempt: number) {
  const raw = response.headers.get('retry-after');
  const seconds = raw && /^\d+$/.test(raw) ? Number(raw) : null;
  const dateDelay = raw && seconds == null ? Date.parse(raw) - Date.now() : null;
  const base = seconds != null ? seconds * 1000 : dateDelay != null && Number.isFinite(dateDelay) ? Math.max(0, dateDelay) : 250 * 2 ** attempt;
  return Math.min(10_000, base) + Math.floor(Math.random() * 200);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertOfficialResource(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname.toLowerCase() !== 'business-api.tiktok.com' || parsed.username || parsed.password || parsed.port && parsed.port !== '443' || !parsed.pathname.startsWith('/open_mcp/')) {
    throw new TikTokAdsError('INVALID_REQUEST', 'Endpointul MCP nu aparține infrastructurii oficiale TikTok for Business.');
  }
}

function normalizedToolResult(result: McpResult) {
  if (result.structuredContent != null) return result.structuredContent;
  const parsed = (result.content || []).flatMap((item) => {
    if (item.type !== 'text' || typeof item.text !== 'string') return [];
    const candidate = item.text.trim();
    if (!candidate || candidate.length > 2 * 1024 * 1024 || !candidate.startsWith('{') && !candidate.startsWith('[')) return [];
    try {
      return [JSON.parse(candidate) as unknown];
    } catch {
      return [];
    }
  });
  if (parsed.length === 1) return parsed[0];
  if (parsed.length > 1) return { content: parsed };
  return result;
}

export class TikTokMcpClient {
  private session: McpSession | null = null;
  private pendingSessionId: string | null = null;

  constructor(private readonly resourceUrl: string, private readonly accessToken: string) {
    assertOfficialResource(resourceUrl);
  }

  private async request<T>(
    method: string,
    params: Record<string, unknown> | undefined,
    options: { notification?: boolean; retryable?: boolean; correlationId?: string } = {}
  ): Promise<T> {
    const startedAt = Date.now();
    const requestId = options.notification ? undefined : randomUUID();
    const attempts = options.retryable ? MAX_READ_RETRIES : 1;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs());
      try {
        const response = await fetch(this.resourceUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json, text/event-stream',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
            ...(this.session?.sessionId ? { 'Mcp-Session-Id': this.session.sessionId } : {}),
          },
          body: JSON.stringify({ jsonrpc: '2.0', ...(requestId ? { id: requestId } : {}), method, ...(params ? { params } : {}) }),
          signal: controller.signal,
          cache: 'no-store',
        });
        const sessionId = response.headers.get('mcp-session-id');
        if (sessionId) {
          this.pendingSessionId = sessionId;
          if (this.session) this.session.sessionId = sessionId;
        }
        if (!response.ok) {
          if (options.retryable && attempt + 1 < attempts && (response.status === 429 || response.status >= 500)) {
            await response.body?.cancel().catch(() => undefined);
            await delay(retryAfterMs(response, attempt));
            continue;
          }
          const payload = await parseResponse(response).catch(() => null) as JsonRpcResponse<T> | null;
          throw normalizeTikTokProviderError({
            status: response.status,
            message: payload?.error?.message,
            correlationId: options.correlationId,
            retryAfterSeconds: response.status === 429 ? Math.ceil(retryAfterMs(response, attempt) / 1000) : null,
          });
        }
        const payload = await parseResponse(response) as JsonRpcResponse<T> | null;
        if (options.notification) return undefined as T;
        if (!payload || payload.jsonrpc !== '2.0' || payload.id !== requestId) {
          throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Răspunsul JSON-RPC TikTok nu corespunde cererii.', { correlationId: options.correlationId });
        }
        if (payload.error) {
          throw normalizeTikTokProviderError({ status: 502, message: payload.error.message, correlationId: options.correlationId });
        }
        if (!('result' in payload)) throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Răspunsul MCP TikTok nu conține result.', { correlationId: options.correlationId });
        console.info(JSON.stringify({ event: 'tiktok_mcp_call', method, outcome: 'success', latencyMs: Date.now() - startedAt, correlationId: options.correlationId }));
        return payload.result as T;
      } catch (error) {
        lastError = error;
        if (error instanceof TikTokAdsError) {
          console.warn(JSON.stringify({ event: 'tiktok_mcp_call', method, outcome: 'failure', errorCode: error.code, latencyMs: Date.now() - startedAt, correlationId: options.correlationId }));
          throw error;
        }
        if (error instanceof Error && error.name === 'AbortError') {
          if (options.retryable && attempt + 1 < attempts) {
            await delay(250 * 2 ** attempt + Math.floor(Math.random() * 200));
            continue;
          }
          throw new TikTokAdsError('TIMEOUT', 'Cererea către TikTok MCP a expirat.', { retryable: options.retryable, correlationId: options.correlationId });
        }
        if (options.retryable && attempt + 1 < attempts) {
          await delay(250 * 2 ** attempt + Math.floor(Math.random() * 200));
          continue;
        }
        if (!options.retryable || attempt + 1 >= attempts) {
          throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'Cererea către TikTok MCP a eșuat.', { retryable: options.retryable, correlationId: options.correlationId, cause: error });
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError;
  }

  async initialize() {
    if (this.session) return this.session;
    const result = await this.request<{
      protocolVersion?: string;
      serverInfo?: { name?: string; version?: string };
    }>('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'imodeus-tiktok-ads', version: '1.0.0' },
    }, { retryable: true });
    if (!result.protocolVersion) throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'TikTok MCP nu a negociat o versiune de protocol.');
    this.session = { sessionId: this.pendingSessionId, serverInfo: result.serverInfo, protocolVersion: result.protocolVersion };
    await this.request('notifications/initialized', undefined, { notification: true });
    return this.session;
  }

  private async listToolsPages() {
    await this.initialize();
    const tools: TikTokMcpTool[] = [];
    let cursor: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 100; page += 1) {
      const result = await this.request<{ tools?: TikTokMcpTool[]; nextCursor?: string }>('tools/list', cursor ? { cursor } : {}, { retryable: true });
      for (const tool of result.tools || []) {
        if (!tool?.name || !tool.inputSchema || seen.has(tool.name)) continue;
        seen.add(tool.name);
        tools.push(tool);
      }
      if (!result.nextCursor) break;
      cursor = result.nextCursor;
    }
    return tools;
  }

  private findProgressiveDiscoveryTool(tools: TikTokMcpTool[]) {
    return tools.find((tool) => {
      const text = `${tool.name} ${tool.title || ''} ${tool.description || ''}`.toLowerCase();
      return text.includes('tool') && (text.includes('search') || text.includes('discover')) && tool.annotations?.destructiveHint !== true;
    }) || null;
  }

  private discoveryArguments(tool: TikTokMcpTool, query: string) {
    const properties = tool.inputSchema.properties || {};
    const key = Object.keys(properties).find((candidate) => /query|keyword|search|description/i.test(candidate) && properties[candidate]?.type === 'string');
    if (!key) return null;
    return {
      [key]: query,
    };
  }

  private extractTools(value: unknown, output: TikTokMcpTool[] = [], depth = 0): TikTokMcpTool[] {
    if (depth > 30) return output;
    if (Array.isArray(value)) {
      value.forEach((item) => this.extractTools(item, output, depth + 1));
      return output;
    }
    if (typeof value === 'string') {
      const candidate = value.trim();
      if (candidate.length <= 2 * 1024 * 1024 && (candidate.startsWith('{') || candidate.startsWith('['))) {
        try {
          this.extractTools(JSON.parse(candidate), output, depth + 1);
        } catch {
          // Progressive discovery tools may also return ordinary explanatory text.
        }
      }
      return output;
    }
    if (!value || typeof value !== 'object') return output;
    const record = value as Record<string, unknown>;
    const inputSchema = record.inputSchema ?? record.input_schema;
    const outputSchema = record.outputSchema ?? record.output_schema;
    if (typeof record.name === 'string' && inputSchema && typeof inputSchema === 'object') {
      output.push({
        ...(record as unknown as TikTokMcpTool),
        name: record.name,
        inputSchema: inputSchema as JsonSchema,
        ...(outputSchema && typeof outputSchema === 'object' ? { outputSchema: outputSchema as JsonSchema } : {}),
      });
      return output;
    }
    Object.values(record).forEach((item) => this.extractTools(item, output, depth + 1));
    return output;
  }

  async discoverTools() {
    const initial = await this.listToolsPages();
    const discoveryTool = this.findProgressiveDiscoveryTool(initial);
    if (!discoveryTool) return initial;
    const discovered: TikTokMcpTool[] = [];
    const queries = [
      '/oauth2/advertiser/get/ Get authorized advertiser accounts',
      '/file/video/ad/upload/ Upload a video for advertising',
      '/campaign/create/ Create a Manual Campaign',
      '/adgroup/create/ Create a Manual Campaign ad group',
      '/ad/create/ Create a Manual Campaign ad',
      'advertiser ad account detail business center billing verification',
      'TikTok account identity authorization permission Spark posts',
      'campaign get update operation status budget schedule',
      'ad group get update operation status targeting bidding placement audience',
      'ad get update operation status creative review',
      'reporting analytics metrics',
      'lead generation instant form leads download',
      'event webhook subscription',
    ];
    for (const query of queries) {
      const args = this.discoveryArguments(discoveryTool, query);
      if (!args) return initial;
      const discoveryResult = await this.callTool(discoveryTool, args, 'READ_ONLY', `discovery-${randomUUID()}`);
      discovered.push(...this.extractTools(discoveryResult));
    }
    const refreshed = await this.listToolsPages();
    const byName = new Map([...initial, ...discovered, ...refreshed].map((tool) => [tool.name, tool]));
    return Array.from(byName.values());
  }

  async callTool(tool: TikTokMcpTool, args: Record<string, unknown>, operationClass: TikTokOperationClass, correlationId: string) {
    const validation = validateJsonSchema(args, tool.inputSchema);
    if (!validation.ok) {
      throw new TikTokAdsError('INVALID_REQUEST', `Input-ul nu respectă schema TikTok descoperită: ${validation.errors.join('; ')}`, { correlationId });
    }
    const result = await this.request<McpResult>('tools/call', { name: tool.name, arguments: args }, {
      retryable: operationClass === 'READ_ONLY',
      correlationId,
    });
    if (result.isError) throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'Tool-ul TikTok MCP a raportat o eroare.', { correlationId });
    const normalized = normalizedToolResult(result);
    if (tool.outputSchema) {
      const outputValidation = validateJsonSchema(normalized, tool.outputSchema);
      if (!outputValidation.ok) {
        throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Output-ul TikTok MCP nu mai respectă schema descoperită.', {
          correlationId,
          safeDetails: { errors: outputValidation.errors.slice(0, 5) },
        });
      }
    }
    return normalized;
  }

  async callToolPaginated(tool: TikTokMcpTool, args: Record<string, unknown>, correlationId: string) {
    const pages: unknown[] = [];
    let nextArgs = { ...args };
    const properties = tool.inputSchema.properties || {};
    const cursorKey = ['cursor', 'page_token', 'pageToken', 'next_cursor'].find((key) => properties[key]);
    const pageKey = ['page', 'page_number', 'pageNumber'].find((key) => properties[key]);
    let pageNumber = pageKey && typeof nextArgs[pageKey] === 'number' ? Number(nextArgs[pageKey]) : 1;
    const seenCursors = new Set<string>();
    let exhausted = false;
    for (let index = 0; index < 100; index += 1) {
      const result = await this.callTool(tool, nextArgs, 'READ_ONLY', correlationId);
      pages.push(result);
      const pagination = findPagination(result);
      if (!pagination.hasMore && !pagination.nextCursor) {
        exhausted = true;
        break;
      }
      if (pagination.nextCursor && cursorKey) {
        if (seenCursors.has(pagination.nextCursor)) throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'TikTok MCP a repetat cursorul de paginare.', { correlationId });
        seenCursors.add(pagination.nextCursor);
        nextArgs = { ...nextArgs, [cursorKey]: pagination.nextCursor };
        continue;
      }
      if (pagination.hasMore && pageKey) {
        pageNumber += 1;
        nextArgs = { ...nextArgs, [pageKey]: pageNumber };
        continue;
      }
      throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'TikTok indică pagini suplimentare, dar schema nu expune un cursor sau număr de pagină compatibil.', { correlationId });
    }
    if (!exhausted) throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Paginarea TikTok a depășit limita sigură de 100 de pagini.', { correlationId });
    return pages.length === 1 ? pages[0] : { pages };
  }
}

function findPagination(value: unknown): { hasMore: boolean; nextCursor: string | null } {
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findPagination(child);
      if (found.hasMore || found.nextCursor) return found;
    }
    return { hasMore: false, nextCursor: null };
  }
  if (!value || typeof value !== 'object') return { hasMore: false, nextCursor: null };
  const record = value as Record<string, unknown>;
  const hasMoreRaw = record.has_more ?? record.hasMore;
  const cursorRaw = record.next_cursor ?? record.nextCursor ?? record.next_page_token ?? record.nextPageToken;
  const hasMore = hasMoreRaw === true || hasMoreRaw === 1 || hasMoreRaw === 'true';
  const nextCursor = typeof cursorRaw === 'string' && cursorRaw ? cursorRaw : null;
  if (hasMore || nextCursor) return { hasMore, nextCursor };
  for (const child of Object.values(record)) {
    const found = findPagination(child);
    if (found.hasMore || found.nextCursor) return found;
  }
  return { hasMore: false, nextCursor: null };
}

function compileJsonSchema(schema: JsonSchema) {
  let validate = compiledSchemas.get(schema);
  if (!validate) {
    validate = jsonSchemaValidator.compile(schema);
    compiledSchemas.set(schema, validate);
  }
  return validate;
}

export function isJsonSchemaCompilable(schema: JsonSchema) {
  try {
    compileJsonSchema(schema);
    return true;
  } catch {
    return false;
  }
}

export function validateJsonSchema(value: unknown, schema: JsonSchema): { ok: boolean; errors: string[] } {
  try {
    const validate = compileJsonSchema(schema);
    const ok = validate(value);
    const errors = ok ? [] : (validate.errors || []).map((error) => {
      const path = error.instancePath || '$';
      return `${path} ${error.keyword}`;
    });
    return { ok: Boolean(ok), errors };
  } catch {
    return { ok: false, errors: ['Schema JSON publicată de provider nu poate fi compilată.'] };
  }
}
