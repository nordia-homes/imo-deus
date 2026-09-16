import { afterEach, describe, expect, it, vi } from 'vitest';
import { TikTokMcpClient } from '../mcp-client';
import type { TikTokMcpTool } from '../types';

const tool: TikTokMcpTool = {
  name: 'campaign_get',
  inputSchema: { type: 'object', properties: { cursor: { type: 'string' } }, additionalProperties: false },
};

function responseFor(request: RequestInfo | URL, init: RequestInit | undefined, result: unknown, status = 200) {
  void request;
  const body = JSON.parse(String(init?.body || '{}')) as { id?: string };
  return new Response(JSON.stringify(status === 200
    ? { jsonrpc: '2.0', id: body.id, result }
    : { jsonrpc: '2.0', id: body.id, error: { code: -1, message: 'provider error' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.TIKTOK_MCP_TIMEOUT_MS;
  delete process.env.TIKTOK_MCP_MAX_RESPONSE_BYTES;
});

describe('TikTok MCP transport boundary', () => {
  it('paginates a read using the discovered cursor schema', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return calls === 1
        ? responseFor(request, init, { rows: [{ campaign_id: '1' }], page_info: { has_more: true, next_cursor: 'next' } })
        : responseFor(request, init, { rows: [{ campaign_id: '2' }], page_info: { has_more: false } });
    }));
    const result = await new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callToolPaginated(tool, {}, 'corr');
    expect(calls).toBe(2);
    expect(result).toHaveProperty('pages');
  });

  it('fails closed for malformed JSON and output schema drift', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'READ_ONLY', 'corr')).rejects.toMatchObject({ code: 'SCHEMA_INCOMPATIBLE' });

    const outputTool = { ...tool, outputSchema: { type: 'object', required: ['rows'], properties: { rows: { type: 'array' } } } };
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => responseFor(request, init, { structuredContent: { wrong: true } })));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(outputTool, {}, 'READ_ONLY', 'corr')).rejects.toMatchObject({ code: 'SCHEMA_INCOMPATIBLE' });
  });

  it('ignores an invalid optional provider output schema while enforcing input', async () => {
    const outputTool = { ...tool, outputSchema: { type: 'not-a-real-json-schema-type' } };
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => responseFor(request, init, { structuredContent: { rows: [] } })));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(outputTool, {}, 'READ_ONLY', 'corr'))
      .resolves.toEqual({ rows: [] });
  });

  it('normalizes auth failures and retries a rate-limited read only', async () => {
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => responseFor(request, init, {}, 401)));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'NON_FINANCIAL_WRITE', 'corr')).rejects.toMatchObject({ code: 'CONNECTION_EXPIRED' });

    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return calls === 1 ? responseFor(request, init, {}, 429) : responseFor(request, init, { rows: [] });
    }));
    const pending = new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'READ_ONLY', 'corr');
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ rows: [] });
    expect(calls).toBe(2);
  });

  it('does not automatically retry a timed-out write', async () => {
    vi.useFakeTimers();
    process.env.TIKTOK_MCP_TIMEOUT_MS = '2000';
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn((_request: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    }));
    const pending = new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'NON_FINANCIAL_WRITE', 'corr');
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(2_100);
    await assertion;
    expect(calls).toBe(1);
  });

  it('parses a standards-compliant multi-line SSE event', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_request: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as { id?: string };
      const sse = `event: message\ndata: {"jsonrpc":"2.0",\ndata: "id":"${body.id}",\ndata: "result":{"rows":[]}}\n\ndata: [DONE]\n\n`;
      return new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'READ_ONLY', 'corr')).resolves.toEqual({ rows: [] });
  });

  it('normalizes JSON returned in standard MCP text content', async () => {
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => responseFor(request, init, {
      content: [{ type: 'text', text: JSON.stringify({ data: { list: [{ advertiser_id: 'adv-1' }] } }) }],
    })));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'READ_ONLY', 'corr'))
      .resolves.toEqual({ data: { list: [{ advertiser_id: 'adv-1' }] } });
  });

  it('discovers exact publishing endpoints from progressive text results', async () => {
    const queries: string[] = [];
    const searchTool = {
      name: 'search_tools',
      description: 'Search and discover tools',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    };
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}')) as { method?: string; params?: { arguments?: { query?: string } } };
      if (body.method === 'initialize') return responseFor(request, init, { protocolVersion: '2025-06-18' });
      if (body.method === 'tools/list') return responseFor(request, init, { tools: [searchTool] });
      if (body.method === 'tools/call') {
        queries.push(String(body.params?.arguments?.query || ''));
        return responseFor(request, init, {
          content: [{
            type: 'text',
            text: JSON.stringify({ tools: [{
              name: '/ad/create/',
              description: 'Create a Manual Campaign ad',
              input_schema: { type: 'object', properties: { advertiser_id: { type: 'string' }, adgroup_id: { type: 'string' }, ad_name: { type: 'string' } } },
            }] }),
          }],
        });
      }
      return responseFor(request, init, {});
    }));
    const tools = await new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').discoverTools();
    expect(queries).toContain('/ad/create/ Create a Manual Campaign ad');
    expect(queries).toContain('/ad/get/ Get Manual Campaign ads');
    expect(queries).toContain('/campaign/status/update/ Update Manual Campaign status');
    expect(queries).toContain('/bc/asset/account/authorization/ Obtain TikTok account ad delivery authorization URL');
    expect(queries).toContain('/identity/get/ Get identities authorized for an advertiser');
    expect(queries).toContain('/advertiser/balance/get/ Get ad account balance and budget by Business Center');
    expect(tools.some((candidate) => candidate.name === '/ad/create/' && candidate.inputSchema.properties?.adgroup_id)).toBe(true);
  });

  it('rejects oversized responses and non-official resource URL variants', async () => {
    process.env.TIKTOK_MCP_MAX_RESPONSE_BYTES = '1024';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(1_025), { status: 200, headers: { 'content-type': 'application/json' } })));
    await expect(new TikTokMcpClient('https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer', 'secret').callTool(tool, {}, 'READ_ONLY', 'corr')).rejects.toMatchObject({ code: 'SCHEMA_INCOMPATIBLE' });
    expect(() => new TikTokMcpClient('https://business-api.tiktok.com.evil.example/open_mcp/x', 'secret')).toThrow(/oficiale/);
    expect(() => new TikTokMcpClient('https://user@business-api.tiktok.com/open_mcp/x', 'secret')).toThrow(/oficiale/);
    expect(() => new TikTokMcpClient('https://business-api.tiktok.com:444/open_mcp/x', 'secret')).toThrow(/oficiale/);
  });
});
