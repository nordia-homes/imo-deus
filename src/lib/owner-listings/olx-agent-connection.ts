import { createHash, randomUUID } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  createBrowserbaseContext,
  createBrowserbaseSession,
  deleteBrowserbaseContext,
  getBrowserbaseContext,
  getBrowserbaseSession,
  getBrowserbaseSessionLiveUrls,
  isBrowserbaseConfigured,
  openBrowserbasePage,
  releaseBrowserbaseSession,
} from '@/lib/owner-listings/browserbase';

export type AgentOlxConnectionStatus =
  | 'not_configured'
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'expired'
  | 'error';

export type AgentOlxConnection = {
  id: string;
  agencyId: string;
  uid: string;
  provider: 'browserbase';
  contextId?: string;
  status: AgentOlxConnectionStatus;
  loginSessionId?: string | null;
  loginSessionExpiresAt?: string | null;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastUsedAt?: string | null;
  lastError?: string | null;
  browserLeaseId?: string | null;
  browserLeaseUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const CONNECTION_COLLECTION = 'ownerListingOlxConnections';

export function getAgentOlxConnectionId(agencyId: string, uid: string) {
  return createHash('sha256').update(`${agencyId}:${uid}`).digest('hex');
}

export function getAgentOlxConnectionRef(adminDb: Firestore, agencyId: string, uid: string) {
  return adminDb.collection(CONNECTION_COLLECTION).doc(getAgentOlxConnectionId(agencyId, uid));
}

export async function getAgentOlxConnection(
  adminDb: Firestore,
  agencyId: string,
  uid: string
): Promise<AgentOlxConnection | null> {
  const snapshot = await getAgentOlxConnectionRef(adminDb, agencyId, uid).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() } as AgentOlxConnection;
}

export async function getAgentOlxConnectionPublicStatus(
  adminDb: Firestore,
  agencyId: string,
  uid: string
) {
  if (!isBrowserbaseConfigured()) {
    return {
      configured: false,
      status: 'not_configured' as const,
      connectedAt: null,
      lastVerifiedAt: null,
      lastError: null,
    };
  }

  const connection = await getAgentOlxConnection(adminDb, agencyId, uid);
  return {
    configured: true,
    status: connection?.status || ('disconnected' as const),
    connectedAt: connection?.connectedAt || null,
    lastVerifiedAt: connection?.lastVerifiedAt || null,
    lastError: connection?.lastError || null,
  };
}

async function ensureAgentContext(adminDb: Firestore, agencyId: string, uid: string) {
  const connectionRef = getAgentOlxConnectionRef(adminDb, agencyId, uid);
  const existing = await getAgentOlxConnection(adminDb, agencyId, uid);

  if (existing?.contextId) {
    const contextExists = await getBrowserbaseContext(existing.contextId)
      .then(() => true)
      .catch(() => false);
    if (contextExists) return { connectionRef, contextId: existing.contextId, existing };
  }

  const context = await createBrowserbaseContext();
  const timestamp = new Date().toISOString();
  await connectionRef.set(
    {
      agencyId,
      uid,
      provider: 'browserbase',
      contextId: context.id,
      status: 'disconnected',
      loginSessionId: null,
      loginSessionExpiresAt: null,
      connectedAt: null,
      lastVerifiedAt: null,
      lastError: null,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return { connectionRef, contextId: context.id, existing };
}

export async function startAgentOlxConnection(
  adminDb: Firestore,
  agencyId: string,
  uid: string
) {
  const { connectionRef, contextId, existing } = await ensureAgentContext(adminDb, agencyId, uid);
  const connectingAt = new Date().toISOString();
  await connectionRef.set(
    {
      status: 'connecting',
      lastError: null,
      updatedAt: connectingAt,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  let pendingSessionId = '';
  try {
    if (existing?.loginSessionId) {
      const previousSession = await getBrowserbaseSession(existing.loginSessionId).catch(() => null);
      if (previousSession?.status === 'RUNNING' || previousSession?.status === 'PENDING') {
        await releaseBrowserbaseSession(existing.loginSessionId).catch(() => undefined);
      }
    }

    const session = await createBrowserbaseSession({
      contextId,
      purpose: 'olx-login',
      agencyId,
      uid,
    });
    pendingSessionId = session.id;
    await openBrowserbasePage(
      session.id,
      'https://www.olx.ro/myaccount/?backUrl=%2Fmyaccount'
    );
    const liveUrls = await getBrowserbaseSessionLiveUrls(session.id);
    const timestamp = new Date().toISOString();
    await connectionRef.set(
      {
        status: 'connecting',
        loginSessionId: session.id,
        loginSessionExpiresAt: session.expiresAt || null,
        lastError: null,
        updatedAt: timestamp,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      status: 'connecting' as const,
      liveViewUrl: `${liveUrls.debuggerFullscreenUrl}${liveUrls.debuggerFullscreenUrl.includes('?') ? '&' : '?'}navbar=false`,
      expiresAt: session.expiresAt || null,
    };
  } catch (error) {
    if (pendingSessionId) {
      await releaseBrowserbaseSession(pendingSessionId).catch(() => undefined);
    }
    const message =
      error instanceof Error ? error.message.slice(0, 300) : 'Sesiunea OLX nu a putut fi pornita.';
    await connectionRef.set(
      {
        status: 'error',
        loginSessionId: null,
        loginSessionExpiresAt: null,
        lastError: message,
        updatedAt: new Date().toISOString(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    throw error;
  }
}

export async function acquireAgentOlxBrowserLease(
  adminDb: Firestore,
  agencyId: string,
  uid: string
) {
  const connectionRef = getAgentOlxConnectionRef(adminDb, agencyId, uid);
  const leaseId = randomUUID();
  const now = Date.now();
  const leaseUntil = new Date(now + 4 * 60 * 1000).toISOString();
  const acquired = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(connectionRef);
    if (!snapshot.exists) return false;
    const data = snapshot.data() as Partial<AgentOlxConnection>;
    const existingLeaseUntil = data.browserLeaseUntil
      ? new Date(data.browserLeaseUntil).getTime()
      : 0;
    if (Number.isFinite(existingLeaseUntil) && existingLeaseUntil > now) return false;
    transaction.set(
      connectionRef,
      {
        browserLeaseId: leaseId,
        browserLeaseUntil: leaseUntil,
        updatedAt: new Date(now).toISOString(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return true;
  });
  return acquired ? leaseId : null;
}

export async function releaseAgentOlxBrowserLease(
  adminDb: Firestore,
  agencyId: string,
  uid: string,
  leaseId: string
) {
  const connectionRef = getAgentOlxConnectionRef(adminDb, agencyId, uid);
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(connectionRef);
    if (!snapshot.exists || snapshot.data()?.browserLeaseId !== leaseId) return;
    transaction.set(
      connectionRef,
      {
        browserLeaseId: FieldValue.delete(),
        browserLeaseUntil: FieldValue.delete(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function markAgentOlxConnection(
  adminDb: Firestore,
  agencyId: string,
  uid: string,
  input: {
    status: AgentOlxConnectionStatus;
    error?: string | null;
    verified?: boolean;
    used?: boolean;
    clearLoginSession?: boolean;
  }
) {
  const timestamp = new Date().toISOString();
  const connectionRef = getAgentOlxConnectionRef(adminDb, agencyId, uid);
  await connectionRef.set(
    {
      status: input.status,
      lastError: input.error || null,
      ...(input.verified
        ? {
            connectedAt: timestamp,
            lastVerifiedAt: timestamp,
          }
        : {}),
      ...(input.used ? { lastUsedAt: timestamp } : {}),
      ...(input.clearLoginSession
        ? {
            loginSessionId: null,
            loginSessionExpiresAt: null,
          }
        : {}),
      updatedAt: timestamp,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export async function disconnectAgentOlxConnection(
  adminDb: Firestore,
  agencyId: string,
  uid: string
) {
  const connection = await getAgentOlxConnection(adminDb, agencyId, uid);
  if (connection?.loginSessionId) {
    await releaseBrowserbaseSession(connection.loginSessionId).catch(() => undefined);
  }
  if (connection?.contextId) {
    await deleteBrowserbaseContext(connection.contextId).catch(() => undefined);
  }
  await getAgentOlxConnectionRef(adminDb, agencyId, uid).delete();
}
