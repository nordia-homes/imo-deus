import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { withDefaultAiOutreachSettings } from '@/lib/ai-outreach/defaults';
import { createVapiOutboundCall } from '@/lib/ai-outreach/vapi';
import type { AiOutreachCall, AiOutreachSettings, AiOwnerListingSnapshot } from '@/lib/ai-outreach/types';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

const ACTIVE_CALL_STATUSES = new Set(['queued', 'scheduled', 'calling']);
const MAX_LISTING_ATTEMPTS_PER_DAY = 3;

type CallGuardInput = {
  adminDb: Firestore;
  agencyId: string;
  ownerListingId: string;
  settings: AiOutreachSettings;
  scheduledAt?: string | null;
  now?: Date;
  excludeCallId?: string;
};

type LaunchCallInput = {
  adminDb: Firestore;
  callRef: DocumentReference;
  call: AiOutreachCall;
  settings: AiOutreachSettings;
  agencyName?: string;
};

type BuildCallInput = {
  agencyId: string;
  uid: string;
  agentName: string;
  ownerListing: AiOwnerListingSnapshot;
  ownerPhone: string;
  settings: AiOutreachSettings;
  callId: string;
  attemptNumber: number;
  scheduledAt?: string | null;
  timestamp: string;
};

class AiOutreachGuardError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AiOutreachGuardError';
    this.status = status;
  }
}

function parseTimeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function getLocalParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(byType.get('hour') || '0') % 24;
  const minute = Number(byType.get('minute') || '0');

  return {
    dateKey: `${byType.get('year')}-${byType.get('month')}-${byType.get('day')}`,
    monthKey: `${byType.get('year')}-${byType.get('month')}`,
    minuteOfDay: hour * 60 + minute,
  };
}

function isWithinCallWindow(date: Date, settings: AiOutreachSettings) {
  const start = parseTimeToMinutes(settings.callWindowStart);
  const end = parseTimeToMinutes(settings.callWindowEnd);
  if (start === null || end === null) {
    throw new AiOutreachGuardError('Intervalul orar pentru apeluri AI este invalid.', 400);
  }

  const current = getLocalParts(date, settings.timezone).minuteOfDay;
  if (start === end) return true;
  if (start < end) return current >= start && current <= end;
  return current >= start || current <= end;
}

async function getAgencyCalls(adminDb: Firestore, agencyId: string, since: Date) {
  const snapshot = await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('aiOutreachCalls')
    .where('createdAt', '>=', since.toISOString())
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Partial<AiOutreachCall>) }));
}

export function normalizeAiOutreachPhone(phone?: string) {
  return normalizeRomanianPhone(phone);
}

export async function getAiOutreachSettings(adminDb: Firestore, agencyId: string) {
  const settingsRef = adminDb.collection('agencies').doc(agencyId).collection('aiOutreach').doc('settings');
  const settingsSnapshot = await settingsRef.get();
  return withDefaultAiOutreachSettings(agencyId, settingsSnapshot.data());
}

export async function getAgencyName(adminDb: Firestore, agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).get();
  const data = snapshot.data() as { name?: string; agencyName?: string } | undefined;
  return data?.name || data?.agencyName || 'Agentie imobiliara';
}

export async function getAgentName(adminDb: Firestore, uid: string) {
  const snapshot = await adminDb.collection('users').doc(uid).get();
  const data = snapshot.data() as { name?: string; displayName?: string; email?: string } | undefined;
  return data?.name || data?.displayName || data?.email || 'Agent';
}

export async function getListingAttemptNumber(adminDb: Firestore, agencyId: string, ownerListingId: string) {
  const snapshot = await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('aiOutreachCalls')
    .where('ownerListingId', '==', ownerListingId)
    .get();

  return snapshot.size + 1;
}

export async function assertCanCreateAiOutreachCall(input: CallGuardInput) {
  const { adminDb, agencyId, ownerListingId, settings, scheduledAt = null, excludeCallId } = input;
  const now = input.now || new Date();

  if (!settings.enabled) {
    throw new AiOutreachGuardError('Apelurile AI nu sunt activate pentru aceasta agentie.', 403);
  }

  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  if (scheduledAt && (!scheduledDate || Number.isNaN(scheduledDate.getTime()))) {
    throw new AiOutreachGuardError('Data programarii apelului AI este invalida.', 400);
  }

  const callDate = scheduledDate || now;
  if (scheduledDate && scheduledDate.getTime() < now.getTime() - 60_000) {
    throw new AiOutreachGuardError('Programarea apelului AI nu poate fi in trecut.', 400);
  }

  if (!isWithinCallWindow(callDate, settings)) {
    throw new AiOutreachGuardError('Apelul este in afara intervalului orar permis pentru aceasta agentie.', 409);
  }

  const statusRef = adminDb.collection('agencies').doc(agencyId).collection('aiOutreachOwnerListingStatuses').doc(ownerListingId);
  const statusSnapshot = await statusRef.get();
  const status = statusSnapshot.data() as { aiDoNotCall?: boolean } | undefined;
  if (status?.aiDoNotCall) {
    throw new AiOutreachGuardError('Proprietarul este marcat Do Not Call pentru aceasta agentie.', 409);
  }

  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const recentCalls = (await getAgencyCalls(adminDb, agencyId, dayAgo)).filter((call) => call.id !== excludeCallId);
  const currentDateKey = getLocalParts(now, settings.timezone).dateKey;
  const currentMonthKey = getLocalParts(now, settings.timezone).monthKey;
  const dailyCalls = recentCalls.filter((call) => call.createdAt && getLocalParts(new Date(call.createdAt), settings.timezone).dateKey === currentDateKey);
  const listingCalls = dailyCalls.filter((call) => call.ownerListingId === ownerListingId);
  const activeListingCall = recentCalls.find((call) => call.ownerListingId === ownerListingId && ACTIVE_CALL_STATUSES.has(String(call.status)));

  if (activeListingCall) {
    throw new AiOutreachGuardError('Exista deja un apel AI activ sau programat pentru acest anunt.', 409);
  }

  if (listingCalls.length >= MAX_LISTING_ATTEMPTS_PER_DAY) {
    throw new AiOutreachGuardError('Limita de reincercari AI pentru acest anunt a fost atinsa astazi.', 429);
  }

  if (dailyCalls.length >= settings.maxDailyCalls) {
    throw new AiOutreachGuardError('Limita zilnica de apeluri AI pentru agentie a fost atinsa.', 429);
  }

  if (typeof settings.monthlyBudgetCap === 'number' && settings.monthlyBudgetCap > 0) {
    const monthAgo = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
    const monthCalls = await getAgencyCalls(adminDb, agencyId, monthAgo);
    const monthlyCost = monthCalls
      .filter((call) => call.createdAt && getLocalParts(new Date(call.createdAt), settings.timezone).monthKey === currentMonthKey)
      .reduce((total, call) => total + (typeof call.cost === 'number' ? call.cost : 0), 0);

    if (monthlyCost >= settings.monthlyBudgetCap) {
      throw new AiOutreachGuardError('Bugetul lunar pentru apeluri AI a fost atins.', 429);
    }
  }
}

export function buildAiOutreachCall(input: BuildCallInput): AiOutreachCall {
  const { agencyId, uid, agentName, ownerListing, ownerPhone, settings, callId, attemptNumber, scheduledAt, timestamp } = input;

  return {
    id: callId,
    agencyId,
    agentId: uid,
    agentName,
    ownerListingId: ownerListing.id,
    ownerListingTitle: ownerListing.title,
    ownerListingLocation: ownerListing.location || '',
    ownerListingPrice: ownerListing.price || '',
    ownerPhone,
    callerNumber: null,
    phoneNumberId: null,
    vapiCallId: null,
    status: scheduledAt ? 'scheduled' : 'queued',
    outcome: 'queued',
    attemptNumber,
    templateId: settings.defaultTemplateId,
    scheduledAt: scheduledAt || null,
    startedAt: null,
    endedAt: null,
    durationSeconds: null,
    cost: null,
    summary: '',
    transcript: '',
    recordingUrl: null,
    endedReason: null,
    providerErrorCode: null,
    providerErrorMessage: null,
    result: {
      desiredCommission: settings.desiredCommissionValue,
      minimumCommission: settings.minimumCommissionValue,
    },
    createdBy: uid,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function updateAiOutreachOwnerListingStatus(
  adminDb: Firestore,
  agencyId: string,
  ownerListingId: string,
  data: Record<string, unknown>,
) {
  const timestamp = typeof data.aiOutreachUpdatedAt === 'string' ? data.aiOutreachUpdatedAt : new Date().toISOString();
  await adminDb.collection('agencies').doc(agencyId).collection('aiOutreachOwnerListingStatuses').doc(ownerListingId).set(
    {
      agencyId,
      ownerListingId,
      updatedAt: timestamp,
      ...data,
    },
    { merge: true },
  );
}

export async function launchAiOutreachCall(input: LaunchCallInput) {
  const { adminDb, callRef, call, settings, agencyName } = input;

  try {
    const vapiResult = await createVapiOutboundCall({ call, settings, agencyName });

    if (vapiResult.mode === 'not_configured') {
      const failedUpdate = {
        status: 'failed' as const,
        outcome: 'failed' as const,
        providerErrorCode: 'vapi_not_configured',
        providerErrorMessage: vapiResult.message,
        endedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await callRef.set(failedUpdate, { merge: true });
      await updateAiOutreachOwnerListingStatus(adminDb, call.agencyId, call.ownerListingId, {
        latestAiCallId: call.id,
        aiOutreachStatus: failedUpdate.status,
        aiOutreachOutcome: failedUpdate.outcome,
        aiOutreachUpdatedAt: failedUpdate.updatedAt,
      });
      return { call: { ...call, ...failedUpdate }, warning: vapiResult.message };
    }

    const liveUpdate = {
      status: 'calling' as const,
      outcome: 'calling' as const,
      vapiCallId: vapiResult.vapiCallId,
      callerNumber: vapiResult.callerNumber || null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await callRef.set(
      {
        ...liveUpdate,
        providerRawCreateResponse: vapiResult.raw,
      },
      { merge: true },
    );
    await updateAiOutreachOwnerListingStatus(adminDb, call.agencyId, call.ownerListingId, {
      latestAiCallId: call.id,
      aiOutreachStatus: liveUpdate.status,
      aiOutreachOutcome: liveUpdate.outcome,
      aiOutreachUpdatedAt: liveUpdate.updatedAt,
    });

    return { call: { ...call, ...liveUpdate } };
  } catch (providerError) {
    const failedUpdate = {
      status: 'failed' as const,
      outcome: 'failed' as const,
      providerErrorCode: 'vapi_create_failed',
      providerErrorMessage: providerError instanceof Error ? providerError.message : 'Vapi call create failed.',
      endedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await callRef.set(failedUpdate, { merge: true });
    await updateAiOutreachOwnerListingStatus(adminDb, call.agencyId, call.ownerListingId, {
      latestAiCallId: call.id,
      aiOutreachStatus: failedUpdate.status,
      aiOutreachOutcome: failedUpdate.outcome,
      aiOutreachUpdatedAt: failedUpdate.updatedAt,
    });
    return { call: { ...call, ...failedUpdate }, message: failedUpdate.providerErrorMessage };
  }
}
