import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
export async function GET(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return NextResponse.json({ voices: [], message: 'Serviciul de voce necesită configurare.' });
    const response = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Lista vocilor nu este disponibilă.');
    const data = await response.json() as { voices: Array<{ voice_id: string; name: string; preview_url?: string }> };
    return NextResponse.json({ voices: data.voices.map(voice => ({ id: voice.voice_id, name: voice.name, previewUrl: voice.preview_url || null })) });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Vocile nu pot fi încărcate.' }, { status: 400 }); }
}
