import { MAX_PLAN_ACTIONS } from '@/lib/ai-assistant/plan-limits';
import { NextRequest, NextResponse, after } from 'next/server';
import { z } from 'zod';
import { assistantContext, collectionFor, readResource } from '@/lib/ai-assistant/access';
import { idSchema, searchSchema, readSchema, actionSchema, queryRecordsSchema } from '@/lib/ai-assistant/contracts';
import { queryRecords } from '@/lib/ai-assistant/record-query';
import { searchProperties } from '@/lib/ai-assistant/search';
import { annotateWatchFeedback } from '@/lib/ai-assistant/watch-feedback';
import { chatTurn, getPlan, runPlan, controlPlan, inspectPlan, sessionHistory, saveAssistantMessage } from '@/lib/ai-assistant/workspace';
import { operationCatalog } from '@/lib/ai-assistant/operations';
import { readBoundedText } from '@/lib/romimo/transport';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { automationReadiness } from '@/lib/ai-assistant/readiness';
import { enqueueTurn, enqueuePlan, readJob, drainAgentJobs } from '@/lib/ai-assistant/jobs';
import { autonomyPolicy, setAutonomy } from '@/lib/ai-assistant/autonomy';
import { timelineSchema, readTimeline } from '@/lib/ai-assistant/timeline';

export const runtime = 'nodejs';
export const maxDuration = 180;
const schema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat'), sessionId: z.string().uuid(), requestId: z.string().uuid(), prompt: z.string().trim().min(1).max(6000) }).strict(),
  z.object({ kind: z.literal('start'), sessionId: z.string().uuid(), requestId: z.string().uuid(), prompt: z.string().trim().min(1).max(6000) }).strict(),
  z.object({ kind: z.literal('search'), query: searchSchema, sessionId: z.string().uuid().optional(), requestId: z.string().uuid().optional() }).strict(),
  z.object({ kind: z.literal('prepare'), sessionId: z.string().uuid(), requestId: z.string().uuid(), actions: z.array(actionSchema).min(1).max(MAX_PLAN_ACTIONS) }).strict(),
  z.object({ kind: z.literal('read'), query: readSchema }).strict(),
  z.object({ kind: z.literal('query'), query: queryRecordsSchema }).strict(),
  z.object({ kind: z.literal('timeline'), query: timelineSchema }).strict(),
  z.object({ kind: z.literal('execute'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('execute_background'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('cancel'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('pause'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('resume'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('inspect'), planId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('autonomy'), enabled: z.boolean(), viewings: z.boolean().optional() }).strict(),
]);
export async function GET(request: NextRequest) {
  try {
    const ctx = await assistantContext(request);
    const jobId = request.nextUrl.searchParams.get('jobId');
    if (jobId) {
      const id = z.string().uuid().parse(jobId);
      const initial = await readJob(ctx, id);
      if (request.nextUrl.searchParams.get('stream') !== '1') return NextResponse.json(initial, { headers: { 'Cache-Control': 'no-store' } });
      const encoder = new TextEncoder(); let stopped = false;
      const stream = new ReadableStream({ async start(controller) {
        const start = Date.now(); let seen = 0;
        try { while (!stopped && Date.now() - start < 50000) {
          const job = await readJob(ctx, id);
          for (const event of job.events.slice(seen)) controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n'));
          seen = job.events.length;
          if (['completed', 'failed'].includes(job.status)) { controller.enqueue(encoder.encode('data: ' + JSON.stringify({ type: 'ACTION_RESULT', ...job }) + '\n\n')); break; }
          controller.enqueue(encoder.encode(': heartbeat\n\n')); await new Promise(resolve => setTimeout(resolve, 1500));
        } } catch { if (!stopped) controller.enqueue(encoder.encode('data: {"type":"ERROR_EVENT","text":"Rezultatul nu este accesibil. Reîncarcă istoricul."}\n\n')); }
        finally { if (!stopped) controller.close(); }
      }, cancel() { stopped = true; } });
      return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
    }
    const sessionId = request.nextUrl.searchParams.get('sessionId');
    const planId = request.nextUrl.searchParams.get('planId');
    if (planId) return NextResponse.json({ plan: (await getPlan(ctx, z.string().uuid().parse(planId))).data }, { headers: { 'Cache-Control': 'no-store' } });
    if (sessionId) return NextResponse.json(await sessionHistory(ctx, z.string().uuid().parse(sessionId), request.nextUrl.searchParams.get('before') ? idSchema.parse(request.nextUrl.searchParams.get('before')) : undefined), { headers: { 'Cache-Control': 'no-store' } });
    const base = collectionFor(ctx, 'assistantSessions').where('ownerId', '==', ctx.uid);
    const docs = await base.orderBy('updatedAt', 'desc').limit(30).get().catch(error => { if (Number(error.code) !== 9) throw error; return base.get(); });
    return NextResponse.json({ sessions: docs.docs.map(d => ({ id: d.id, title: d.data().title, updatedAt: d.data().updatedAt })).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 30), capabilities: operationCatalog(), aiConfigured: Boolean(process.env.OPENAI_API_KEY), backgroundConfigured: Boolean(process.env.AI_ASSISTANT_WORKER_SECRET) && ctx.runtimeMode !== 'demo', automations: await automationReadiness(ctx), autonomy: await autonomyPolicy(ctx) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
export async function POST(request: NextRequest) {
  try {
    const ctx = await assistantContext(request);
    const text = await readBoundedText(request.body, 128000);
    if (text.length > 128000) return NextResponse.json({ error: 'Cererea este prea mare.' }, { status: 413 });
    const input = schema.parse(JSON.parse(text));
    let result: unknown;
    if (input.kind === 'autonomy') result = await setAutonomy(ctx, input.enabled, input.viewings);
    else if (input.kind === 'start') { result = await enqueueTurn(ctx, input); after(async () => { await drainAgentJobs(ctx.adminDb, 1); }); }
    else if (input.kind === 'execute_background') { result = await enqueuePlan(ctx, input.planId); after(async () => { await drainAgentJobs(ctx.adminDb, 1); }); }
    else if (input.kind === 'chat') result = await chatTurn(ctx, input);
    else if (input.kind === 'prepare') result = { message: await saveAssistantMessage(ctx, input.sessionId, input.requestId, 'Verifică acțiunea înainte de execuție.', [], input.actions) };
    else if (input.kind === 'search') {
      const page = await searchProperties(ctx, input.query);
      if (input.query.source === 'owners') page.rows = await annotateWatchFeedback(ctx, page.rows);
      result = page;
      if (input.sessionId && input.requestId) {
        const message = await saveAssistantMessage(ctx, input.sessionId, input.requestId, page.note || 'Rezultate din datele actuale.', [{ type: 'results', title: input.query.source === 'owners' ? 'Anunțuri proprietari' : 'Potriviri din CRM', source: input.query.source, search: input.query, ...page }]);
        result = { ...page, message };
      }
    } else if (input.kind === 'read') result = await readResource(ctx, input.query);
    else if (input.kind === 'query') result = await queryRecords(ctx, input.query);
    else if (input.kind === 'timeline') result = await readTimeline(ctx, input.query);
    else if (input.kind === 'inspect') result = { plan: await inspectPlan(ctx, input.planId) };
    else if (input.kind === 'pause' || input.kind === 'resume') result = { plan: await controlPlan(ctx, input.planId, input.kind) };
    else result = { plan: await runPlan(ctx, input.planId, input.kind === 'cancel') };
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
