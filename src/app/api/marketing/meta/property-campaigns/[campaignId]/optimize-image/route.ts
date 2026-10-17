import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
export const runtime = 'nodejs';
export async function POST(request: NextRequest, context: {
    params: Promise<{
        campaignId: string;
    }>;
}) {
    try {
        const { requireAgencyUserFromBearerToken } = await import('@/lib/firebase-app-hosting');
        const actor = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
        if (actor.role !== 'admin')
            return NextResponse.json({ message: 'Acces neautorizat.' }, { status: 403 });
        if (isDemoAgencyId(actor.agencyId))
            return createDemoBlockedResponse('Optimizarea Meta este blocată în demo.');
        const body = z.object({ proposalId: z.string().regex(/^[a-f0-9]{64}$/) }).strict().safeParse(await request.json());
        const { campaignId } = await context.params;
        if (!body.success || !/^[A-Za-z0-9_-]{1,180}$/.test(campaignId))
            return NextResponse.json({ message: 'Propunere invalidă.' }, { status: 400 });
        const { executeMetaImageProposal } = await import('@/lib/meta-image-workflow');
        return NextResponse.json(await executeMetaImageProposal(actor.agencyId, campaignId, actor, body.data.proposalId));
    }
    catch {
        return NextResponse.json({ message: 'Optimizarea nu este confirmată. Verifică propunerea și starea Meta înainte de reluare.' }, { status: 409 });
    }
}
