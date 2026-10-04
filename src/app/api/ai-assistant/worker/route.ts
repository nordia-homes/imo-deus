import { NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import { secretMatches } from '@/lib/communications/crypto';
import { drainAssistantAutomations } from '@/lib/ai-assistant/automation-worker';
import { drainAgentJobs } from '@/lib/ai-assistant/jobs';
export const runtime = 'nodejs';
export const maxDuration = 180;
export async function POST(request: Request) {
  const secret = process.env.AI_ASSISTANT_WORKER_SECRET;
  if (!secret || !secretMatches(request.headers.get('authorization') || '', `Bearer ${secret}`)) return new NextResponse('Forbidden', { status: 403 });
  try {
    await adminDb.collection('assistantWorkerState').doc('global').set({ lastAttemptAt: new Date().toISOString() }, { merge: true });
    const jobs = await drainAgentJobs(adminDb, 1);
    const result = await drainAssistantAutomations(adminDb);
    await adminDb.collection('assistantWorkerState').doc('global').set({ lastSuccessAt: new Date().toISOString(), processed: result.processed }, { merge: true });
    return NextResponse.json({ ...result, jobs }, { headers: { 'Cache-Control': 'no-store' } });
  }
  catch { return NextResponse.json({ error: 'Automatizările nu au putut fi procesate.' }, { status: 500 }); }
}
