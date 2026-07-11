import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import type {
  TikTokStudioBrandKit,
  TikTokStudioCreativePreset,
  TikTokStudioProject,
  TikTokStudioQualityScore,
  TikTokStudioRepurposeVariant,
  TikTokStudioStoryboardScene,
  TikTokStudioSubtitlePreset,
  TikTokStudioVoiceProfile,
} from '@/lib/types';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la proiectele TikTok Studio.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la proiectele TikTok Studio.' };
}

function parseAspectRatio(value: unknown): TikTokStudioProject['aspectRatio'] {
  if (value === '1:1' || value === '4:5' || value === '16:9') return value;
  return '9:16';
}

function parseSubtitleStyle(value: unknown): TikTokStudioSubtitlePreset {
  if (
    value === 'clean_white'
    || value === 'luxury'
    || value === 'tiktok_bold'
    || value === 'luxury_white'
    || value === 'minimal_premium'
    || value === 'high_contrast'
  ) return value;
  return 'heygen_pink';
}

function parseCreativePreset(value: unknown): TikTokStudioCreativePreset {
  if (
    value === 'fast_tiktok_hook'
    || value === 'warm_family_home'
    || value === 'investor_deal'
    || value === 'new_development'
    || value === 'luxury_real_estate'
  ) {
    return value;
  }
  return 'luxury_real_estate';
}

function parseVoiceProfile(value: unknown): TikTokStudioVoiceProfile | null {
  if (value === 'warm_feminine' || value === 'young_social' || value === 'luxury_calm' || value === 'energetic' || value === 'professional') return value;
  return null;
}

function parseRepurposeVariants(value: unknown): TikTokStudioRepurposeVariant[] {
  if (!Array.isArray(value)) return ['tiktok_9_16'];
  const allowed = new Set<TikTokStudioRepurposeVariant>(['tiktok_9_16', 'reels_9_16', 'story_9_16', 'shorts_9_16', 'no_subtitles', 'alternate_cta']);
  return value.filter((item): item is TikTokStudioRepurposeVariant => allowed.has(item as TikTokStudioRepurposeVariant));
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listTikTokStudioProjects }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const projects = await listTikTokStudioProjects(agencyId);
    return NextResponse.json({ projects }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { createTikTokStudioProject }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-marketing'),
    ]);
    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Randarea TikTok AI Studio este blocata in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const project = await createTikTokStudioProject({
      agencyId,
      ownerUid: uid,
      title: typeof body.title === 'string' ? body.title : undefined,
      sourceAssetIds: Array.isArray(body.sourceAssetIds) ? body.sourceAssetIds : [],
      script: typeof body.script === 'string' ? body.script : '',
      voiceId: typeof body.voiceId === 'string' && body.voiceId.trim() ? body.voiceId.trim() : null,
      voiceProfile: parseVoiceProfile(body.voiceProfile),
      subtitleStyle: parseSubtitleStyle(body.subtitleStyle),
      creativePreset: parseCreativePreset(body.creativePreset),
      hook: typeof body.hook === 'string' ? body.hook : null,
      caption: typeof body.caption === 'string' ? body.caption : null,
      captionVariants: Array.isArray(body.captionVariants) ? body.captionVariants.map((item: unknown) => String(item || '').trim()).filter(Boolean) : null,
      hashtags: Array.isArray(body.hashtags) ? body.hashtags.map((item: unknown) => String(item || '').trim()).filter(Boolean) : null,
      storyboard: Array.isArray(body.storyboard) ? body.storyboard as TikTokStudioStoryboardScene[] : null,
      timeline: Array.isArray(body.timeline) ? body.timeline as TikTokStudioStoryboardScene[] : null,
      qualityScore: body.qualityScore && typeof body.qualityScore === 'object' ? body.qualityScore as TikTokStudioQualityScore : null,
      brandKit: body.brandKit && typeof body.brandKit === 'object' ? body.brandKit as TikTokStudioBrandKit : null,
      repurposeVariants: parseRepurposeVariants(body.repurposeVariants),
      scheduledAt: typeof body.scheduledAt === 'string' ? body.scheduledAt : null,
      aspectRatio: parseAspectRatio(body.aspectRatio),
      settings: body.settings && typeof body.settings === 'object' ? body.settings : null,
    });
    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
