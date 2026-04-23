import { NextResponse } from 'next/server';

export const DEMO_AGENCY_ID_PREFIX = 'demo-';

export function isDemoAgencyId(agencyId: string | null | undefined): agencyId is string {
  return typeof agencyId === 'string' && agencyId.startsWith(DEMO_AGENCY_ID_PREFIX);
}

export function createDemoBlockedResponse(message: string, status = 403) {
  return NextResponse.json(
    {
      message,
      demoMode: true,
      blocked: true,
    },
    { status }
  );
}
