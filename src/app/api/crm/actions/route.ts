import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext } from '@/lib/ai-assistant/access';
import { actionSchema } from '@/lib/ai-assistant/contracts';
import { executeAction } from '@/lib/ai-assistant/actions';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { requireTool } from '@/lib/ai-assistant/registry';

export const runtime = 'nodejs';
// Human UI endpoint. It shares the exact domain executor with Jarvis but is
// intentionally NOT a model operation: model writes still require a saved plan.
export async function POST(request: Request) {
  try {
    const ctx = await assistantContext(request);
    const input = z.object({ requestId: z.string().uuid(), action: actionSchema }).strict()
      .parse(JSON.parse(await readBoundedText(request.body, 1024 * 1024)));
    if (['create_automation', 'update_automation'].includes(input.action.kind) || (input.action.kind === 'existing_operation' && input.action.operation !== 'notification_read_all')) {
      return NextResponse.json({ message: 'Folosește fluxul dedicat acestei operații.' }, { status: 400 });
    }
    requireTool(input.action.kind === 'existing_operation' ? input.action.operation : input.action.kind, ctx.role || '');
    return NextResponse.json(await executeAction(ctx, input.action, `manual-${ctx.uid}-${input.requestId}`), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
