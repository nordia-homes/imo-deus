import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error instanceof Error) return { status: 500, message: error.message.slice(0, 700) };
  return { status: 500, message: 'A aparut o eroare la importul vocilor ElevenLabs.' };
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listPropertyVideoTourRomanianVoicePresets }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/property-video-tours'),
    ]);
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const voices = await listPropertyVideoTourRomanianVoicePresets();
    return NextResponse.json({ voices });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
