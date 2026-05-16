import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyAdminFromBearerToken, requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { DEFAULT_AI_OUTREACH_SETTINGS, withDefaultAiOutreachSettings } from '@/lib/ai-outreach/defaults';

export const runtime = 'nodejs';

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  desiredCommissionValue: z.string().trim().min(1).optional(),
  minimumCommissionValue: z.string().trim().min(1).optional(),
  commissionType: z.enum(['percent', 'fixed', 'mixed']).optional(),
  allowNegotiation: z.boolean().optional(),
  allowVerbalAgreement: z.boolean().optional(),
  allowExactAddressCollection: z.boolean().optional(),
  defaultTemplateId: z.string().trim().min(1).optional(),
  callWindowStart: z.string().trim().min(1).optional(),
  callWindowEnd: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
  maxDailyCalls: z.coerce.number().int().min(1).max(10000).optional(),
  monthlyBudgetCap: z.coerce.number().min(0).nullable().optional(),
  recordCalls: z.boolean().optional(),
  discloseAi: z.boolean().optional(),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return { status: 400, message: error.issues[0]?.message || 'Setari invalide.' };
  }

  if (error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return { status: (error as { status: number }).status, message: error instanceof Error ? error.message : 'Cererea a esuat.' };
  }

  return { status: 500, message: error instanceof Error ? error.message : 'Cererea a esuat.' };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const ref = context.adminDb.collection('agencies').doc(context.agencyId).collection('aiOutreach').doc('settings');
    const snapshot = await ref.get();
    const settings = withDefaultAiOutreachSettings(context.agencyId, snapshot.data() || DEFAULT_AI_OUTREACH_SETTINGS);

    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const body = settingsSchema.parse(await request.json().catch(() => ({})));
    const ref = context.adminDb.collection('agencies').doc(context.agencyId).collection('aiOutreach').doc('settings');
    const current = await ref.get();
    const timestamp = new Date().toISOString();
    const next = withDefaultAiOutreachSettings(context.agencyId, {
      ...(current.data() || {}),
      ...body,
      createdAt: current.data()?.createdAt || timestamp,
      updatedAt: timestamp,
    });

    await ref.set(next, { merge: true });

    return NextResponse.json({ settings: next }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
