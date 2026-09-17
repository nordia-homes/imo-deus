import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn(async () => ({ agencyId: 'fixture' })) }));
import { GET } from '@/app/api/marketing/tiktok/voices/route';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const request = () => new NextRequest('https://example.test/api/marketing/tiktok/voices', { headers: { authorization: 'Bearer fixture' } });
describe('TikTok voice catalogue', () => {
  it('explains missing configuration without making a provider request', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', ''); vi.stubEnv('XI_API_KEY', '');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const response = await GET(request()); const data = await response.json();
    expect(data.configured).toBe(false); expect(data.message).toContain('administratorul'); expect(fetch).not.toHaveBeenCalled();
  });
  it('supports the same XI_API_KEY alias as property tours', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', ''); vi.stubEnv('XI_API_KEY', 'fixture-key');
    const fetch = vi.fn(async (_url: string, _options: RequestInit) => new Response(JSON.stringify({ voices: [{ voice_id: 'voice-1', name: 'Voce test', preview_url: 'https://example.test/sample.mp3' }] })));
    vi.stubGlobal('fetch', fetch);
    const response = await GET(request()); const data = await response.json();
    expect(new Headers(fetch.mock.calls[0][1].headers).get('xi-api-key')).toBe('fixture-key');
    expect(data.voices[0]).toEqual({ id: 'voice-1', name: 'Voce test', previewUrl: 'https://example.test/sample.mp3' });
  });
  it('explains denied voice-list permissions', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'fixture');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));
    const response = await GET(request());
    expect(response.status).toBe(502); expect((await response.json()).message).toContain('permisiunea');
  });
});
