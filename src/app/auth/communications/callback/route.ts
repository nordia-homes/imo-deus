import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { finishAuthorization } from '@/lib/communications/meta';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const redirect = new URL('/marketing/facebook-instagram', request.url);
  try {
    const code = request.nextUrl.searchParams.get('code'); const state = request.nextUrl.searchParams.get('state');
    if (!code || !state) throw new Error('Conectarea Meta a fost anulată sau este incompletă.');
    await finishAuthorization(adminDb, code, state); redirect.searchParams.set('connected', '1');
  } catch (error) { redirect.searchParams.set('error', error instanceof Error ? error.message : 'Conectarea a eșuat.'); }
  return NextResponse.redirect(redirect);
}
