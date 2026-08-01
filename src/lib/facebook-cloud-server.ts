import 'server-only';

import type { Firestore } from 'firebase-admin/firestore';
import type {
  FacebookCloudConnection,
  FacebookCloudPublishingJob,
  Property,
} from '@/lib/types';

function runnerConfig() {
  const url = String(process.env.FACEBOOK_CLOUD_RUNNER_URL || '').replace(/\/+$/, '');
  const token = String(process.env.FACEBOOK_CLOUD_RUNNER_TOKEN || '');
  if (!url || !token) {
    const error = new Error('Runnerul Facebook cloud nu este configurat.');
    (error as Error & { status?: number }).status = 503;
    throw error;
  }
  return { url, token };
}

export async function facebookRunnerRequest<T>(
  pathname: string,
  init?: RequestInit
): Promise<T> {
  const { url, token } = runnerConfig();
  const response = await fetch(`${url}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(65_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { message?: string };
    const error = new Error(payload.message || `Runnerul Facebook a răspuns cu ${response.status}.`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function facebookRunnerBinary(pathname: string): Promise<Response> {
  const { url, token } = runnerConfig();
  const response = await fetch(`${url}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const error = new Error(`Captura browserului nu este disponibilă (${response.status}).`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return response;
}

export function formatFacebookCloudError(error: unknown) {
  const status =
    error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
  return {
    status,
    message: error instanceof Error ? error.message : 'A apărut o eroare neașteptată.',
  };
}

export async function getOwnedConnection(
  db: Firestore,
  agencyId: string,
  ownerUid: string,
  connectionId: string
) {
  const ref = db.collection('agencies').doc(agencyId).collection('facebookCloudConnections').doc(connectionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    const error = new Error('Contul Facebook nu a fost găsit.');
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  const connection = { id: snapshot.id, ...snapshot.data() } as FacebookCloudConnection;
  if (connection.ownerUid !== ownerUid) {
    const error = new Error('Nu ai dreptul să folosești acest cont Facebook.');
    (error as Error & { status?: number }).status = 403;
    throw error;
  }
  return { ref, connection };
}

export function toRunnerJob(
  job: FacebookCloudPublishingJob,
  property: Property,
  ownerUid: string
) {
  return {
    id: job.id,
    agencyId: job.agencyId,
    ownerUid,
    connectionId: job.connectionId,
    propertyId: property.id,
    propertyTitle: property.title,
    propertyDescription: property.description || '',
    propertyImages: property.images || [],
    groups: job.groups.map(({ name, url }) => ({ name, url })),
    scheduledAt: job.scheduledAt || null,
  };
}
