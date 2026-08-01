import 'server-only';

import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import type { FacebookLocalRunnerDevice } from '@/lib/types';

export const FACEBOOK_LOCAL_DEVICE_COLLECTION = 'facebookLocalRunnerDevices';
export const FACEBOOK_JOB_COLLECTION = 'facebookCloudPublishingJobs';
export const FACEBOOK_CONNECTION_COLLECTION = 'facebookCloudConnections';
export const FACEBOOK_LOCAL_DEVICE_ONLINE_MS = 90_000;
export const FACEBOOK_LOCAL_LEASE_MS = 8 * 60_000;

type DeviceContext = {
  adminDb: Firestore;
  agencyId: string;
  ownerUid: string;
  deviceId: string;
  deviceRef: FirebaseFirestore.DocumentReference;
  device: FacebookLocalRunnerDevice;
};

export function createDeviceToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashDeviceToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function deviceUnauthorized(message: string, status = 401): never {
  const error = new Error(message);
  (error as Error & { status?: number }).status = status;
  throw error;
}

export async function requireFacebookLocalDevice(
  authorizationHeader: string | null | undefined,
  agencyHeader: string | null | undefined,
  deviceHeader: string | null | undefined
): Promise<DeviceContext> {
  if (!authorizationHeader?.startsWith('Device ')) {
    deviceUnauthorized('Device authentication is missing.');
  }
  const token = authorizationHeader.slice('Device '.length).trim();
  const agencyId = String(agencyHeader || '').trim();
  const deviceId = String(deviceHeader || '').trim();
  if (!token || !agencyId || !deviceId || !/^[A-Za-z0-9_-]{8,160}$/.test(deviceId)) {
    deviceUnauthorized('Device authentication is invalid.');
  }

  const deviceRef = adminDb
    .collection('agencies').doc(agencyId)
    .collection(FACEBOOK_LOCAL_DEVICE_COLLECTION).doc(deviceId);
  const snapshot = await deviceRef.get();
  if (!snapshot.exists) deviceUnauthorized('The local runner device is no longer registered.');
  const raw = snapshot.data() as FacebookLocalRunnerDevice & { tokenHash?: string; revokedAt?: string | null };
  if (raw.revokedAt || !raw.tokenHash || !constantTimeEqual(hashDeviceToken(token), raw.tokenHash)) {
    deviceUnauthorized('The local runner device token is invalid.');
  }
  return {
    adminDb,
    agencyId,
    ownerUid: raw.ownerUid,
    deviceId,
    deviceRef,
    device: { ...raw, id: snapshot.id },
  };
}

export function publicDevice(
  id: string,
  value: Record<string, unknown>
): FacebookLocalRunnerDevice {
  return {
    id,
    agencyId: String(value.agencyId || ''),
    ownerUid: String(value.ownerUid || ''),
    name: String(value.name || 'Laptop Windows'),
    platform: 'windows',
    appVersion: typeof value.appVersion === 'string' ? value.appVersion : null,
    timezone: 'Europe/Bucharest',
    status: value.status === 'on_battery' || value.status === 'error' ? value.status : 'online',
    isPrimary: value.isPrimary !== false,
    lastSeenAt: typeof value.lastSeenAt === 'string' ? value.lastSeenAt : null,
    lastError: typeof value.lastError === 'string' ? value.lastError : null,
    nextWakeAt: typeof value.nextWakeAt === 'string' ? value.nextWakeAt : null,
    powerSource: value.powerSource === 'ac' || value.powerSource === 'battery' ? value.powerSource : 'unknown',
    wakeTimersEnabled: typeof value.wakeTimersEnabled === 'boolean' ? value.wakeTimersEnabled : null,
    createdAt: String(value.createdAt || ''),
    updatedAt: String(value.updatedAt || ''),
  };
}

export function isDeviceOnline(device: Pick<FacebookLocalRunnerDevice, 'lastSeenAt' | 'status'>) {
  return device.status === 'online'
    && Boolean(device.lastSeenAt)
    && Date.now() - new Date(device.lastSeenAt as string).getTime() <= FACEBOOK_LOCAL_DEVICE_ONLINE_MS;
}

export function localServerError(error: unknown) {
  const status =
    error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
  return {
    status,
    message: error instanceof Error ? error.message : 'Unexpected local runner error.',
  };
}

export function randomCooldownIso() {
  const seconds = crypto.randomInt(90, 121);
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function localJobReadyAt(job: Record<string, unknown>) {
  const candidate = typeof job.nextRunAt === 'string'
    ? job.nextRunAt
    : typeof job.scheduledAt === 'string'
      ? job.scheduledAt
      : typeof job.createdAt === 'string'
        ? job.createdAt
        : new Date(0).toISOString();
  return new Date(candidate).getTime();
}

