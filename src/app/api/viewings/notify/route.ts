import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

type NotifyViewingPayload = {
  agentId?: string | null;
  contactName?: string;
  propertyTitle?: string;
  viewingDate?: string;
  agencyId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const { adminDb, adminMessaging } = await import('@/firebase/admin');
    const body = (await request.json()) as NotifyViewingPayload;
    const { agentId, contactName, propertyTitle, viewingDate, agencyId } = body;

    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Notificarile push sunt dezactivate in mediul demo.');
    }

    if (!agentId || !viewingDate) {
      return NextResponse.json({ message: 'agentId and viewingDate are required.' }, { status: 400 });
    }

    const userDoc = await adminDb.collection('users').doc(agentId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ message: 'Agent not found.' }, { status: 404 });
    }

    const userData = userDoc.data() as { pushTokens?: string[]; name?: string } | undefined;
    const tokens = (userData?.pushTokens || []).filter(Boolean);

    if (tokens.length === 0) {
      return NextResponse.json({ message: 'Agent has no registered push tokens.' }, { status: 200 });
    }

    const viewingDateLabel = new Intl.DateTimeFormat('ro-RO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(viewingDate));

    const title = 'Vizionare nouă programată';
    const bodyText = `${viewingDateLabel} • ${propertyTitle || 'Proprietate'} • ${contactName || 'Client'}`;

    const response = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title,
        body: bodyText,
      },
      webpush: {
        notification: {
          title,
          body: bodyText,
          icon: '/favicon.ico',
        },
        fcmOptions: {
          link: '/viewings',
        },
      },
      data: {
        path: '/viewings',
        agentId,
      },
    });

    const failures = response.responses
      .filter((item) => !item.success)
      .map((item) => item.error?.message || item.error?.code || 'Unknown messaging error')
      .filter(Boolean);

    if (response.successCount === 0 && failures.length > 0) {
      return NextResponse.json(
        {
          message: failures[0],
          successCount: response.successCount,
          failureCount: response.failureCount,
          failures,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      successCount: response.successCount,
      failureCount: response.failureCount,
      failures,
    });
  } catch (error) {
    console.error('Viewing notification send failed:', error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Failed to send viewing notification.',
      },
      { status: 500 }
    );
  }
}
