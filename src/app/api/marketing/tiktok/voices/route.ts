import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
export async function GET(request: NextRequest) {
  try {
    await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const key = (process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '').trim();
    if (!key) return NextResponse.json({ voices: [], configured: false, message: 'Vocea necesită configurarea ElevenLabs pe server (ELEVENLABS_API_KEY sau XI_API_KEY). Contactează administratorul.' });
    const response = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': key }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? 'ElevenLabs refuză accesul la voci. Verifică cheia și permisiunea de citire a vocilor.'
        : response.status === 429 ? 'ElevenLabs a limitat temporar cererile. Reîncearcă în câteva momente.'
        : 'Lista vocilor ElevenLabs nu este disponibilă momentan. Reîncearcă.';
      return NextResponse.json({ voices: [], configured: true, message }, { status: 502 });
    }
    const data = await response.json() as { voices: Array<{ voice_id: string; name: string; preview_url?: string }> };
    const voices = (data.voices || []).filter(voice => voice.voice_id).map(voice => ({ id: voice.voice_id, name: voice.name || voice.voice_id, previewUrl: voice.preview_url || null }));
    return NextResponse.json({ voices, configured: true, message: voices.length ? undefined : 'Contul ElevenLabs nu a returnat voci. Adaugă o voce în cont și reîncarcă lista.' });
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Vocile nu pot fi încărcate.' }, { status: 400 }); }
}
