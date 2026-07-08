import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error instanceof Error) return { status: 500, message: error.message.slice(0, 700) };
  return { status: 500, message: 'A aparut o eroare la previzualizarea vocii.' };
}

export async function POST(
  request: NextRequest
) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { synthesizePropertyVideoTourVoicePreview }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/property-video-tours'),
    ]);
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const audio = await synthesizePropertyVideoTourVoicePreview({
      voice: body.voice,
      text: body.text,
    });
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
