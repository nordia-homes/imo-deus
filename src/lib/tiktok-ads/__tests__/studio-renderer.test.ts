import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TikTokStudioAsset, TikTokStudioProject } from '@/lib/types';

const uploads = vi.hoisted(() => new Map<string, Uint8Array>());
vi.mock('@/firebase/admin', () => ({ adminStorage: { bucket: () => ({ name: 'fixture-bucket', file: (key: string) => ({ save: async (buffer: Uint8Array) => { uploads.set(key, buffer); } }) }) } }));
vi.mock('@/lib/tiktok-ads/media-security', () => ({ assertSafeTikTokMediaUrl: vi.fn().mockResolvedValue(undefined) }));
import { renderTikTokStudioPhotoVideo } from '@/lib/tiktok-video-studio-renderer';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); uploads.clear(); });
describe('Property video renderer with real FFmpeg and fixture voice/images', () => {
  it('produces playable vertical MP4 and thumbnail without calling a paid provider', async () => {
    expect(ffmpeg).toBeTruthy();
    const dir = await mkdtemp(path.join(tmpdir(), 'imodeus-render-test-'));
    try {
      const audio = path.join(dir, 'voice.mp3'); const photo = path.join(dir, 'photo.png');
      execFileSync(ffmpeg!, ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', audio], { windowsHide: true, stdio: 'ignore' });
      execFileSync(ffmpeg!, ['-y', '-f', 'lavfi', '-i', 'color=c=skyblue:s=640x480', '-frames:v', '1', photo], { windowsHide: true, stdio: 'ignore' });
      const audioBytes = await readFile(audio); const photoBytes = await readFile(photo);
      vi.stubEnv('ELEVENLABS_API_KEY', 'fixture-only');
      const fetch = vi.fn(async (url: string) => url.includes('api.elevenlabs.io') ? new Response(JSON.stringify({ audio_base64: audioBytes.toString('base64') }), { status: 200, headers: { 'Content-Type': 'application/json' } }) : new Response(photoBytes, { status: 200, headers: { 'Content-Type': 'image/png' } }));
      vi.stubGlobal('fetch', fetch);
      const project = { id: 'project/v1/tiktok_9_16', agencyId: 'org', ownerUid: 'user', title: 'Property fixture', mode: 'photo_to_video', aspectRatio: '9:16', sourceAssetIds: ['one', 'two'], script: 'Proprietate de test.', subtitleStyle: 'clean_white', repurposeVariants: ['tiktok_9_16'], brandKit: { name: 'Agenție test', defaultCallToAction: 'Programează o vizionare' } } as TikTokStudioProject;
      const sourceAssets = ['one', 'two'].map(id => ({ id, type: 'image', url: `https://fixture.invalid/${id}.png` }) as TikTokStudioAsset);
      const rendered = await renderTikTokStudioPhotoVideo({ agencyId: 'org', project, sourceAssets });
      expect(rendered.durationSeconds).toBeGreaterThan(1);
      expect(rendered.durationSeconds).toBeLessThan(10);
      expect(rendered.sizeBytes).toBeGreaterThan(1000);
      expect(rendered.videoUrl).toContain('firebasestorage.googleapis.com');
      expect(uploads.size).toBe(2);
      const mp4 = [...uploads.entries()].find(([name]) => name.endsWith('.mp4'));
      expect(mp4).toBeTruthy();
      const probe = spawnSync(ffmpeg!, ['-i', 'pipe:0', '-f', 'null', '-'], { input: mp4![1], windowsHide: true });
      expect(probe.status).toBe(0);
      expect(probe.stderr.toString()).toContain('1080x1920');
      expect(fetch.mock.calls.filter(([url]) => url.includes('api.elevenlabs.io'))).toHaveLength(1);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 120000);
});
