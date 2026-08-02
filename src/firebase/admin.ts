import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getStorage } from 'firebase-admin/storage';

const REAL_ADMIN_APP_NAME = 'real-admin';
const DEFAULT_PROJECT_ID = 'studio-652232171-42fb6';
const DEFAULT_STORAGE_BUCKET = 'studio-652232171-42fb6.firebasestorage.app';

function resolveStorageBucket(projectId?: string | null) {
  return (
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    (projectId ? `${projectId}.firebasestorage.app` : DEFAULT_STORAGE_BUCKET)
  );
}

function getRealAdminApp(): App {
  const existing = getApps().find((candidate) => candidate.name === REAL_ADMIN_APP_NAME);
  if (existing) {
    return getApp(REAL_ADMIN_APP_NAME);
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    DEFAULT_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const hasAnyExplicitCredential = Boolean(clientEmail || privateKey);

  if (hasAnyExplicitCredential && (!clientEmail || !privateKey)) {
    throw new Error(
      'Credentialele Firebase explicite sunt incomplete. Configureaza FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL si FIREBASE_PRIVATE_KEY impreuna sau elimina-le pentru Application Default Credentials.'
    );
  }

  if (
    privateKey &&
    (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') ||
      !privateKey.includes('-----END PRIVATE KEY-----'))
  ) {
    throw new Error(
      'Cheia privata FIREBASE_PRIVATE_KEY din environment variables pare a fi invalida.'
    );
  }

  const credential =
    clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey } satisfies ServiceAccount)
      : applicationDefault();

  return initializeApp(
    {
      credential,
      projectId,
      storageBucket: resolveStorageBucket(projectId),
    },
    REAL_ADMIN_APP_NAME
  );
}

export const adminDb = getFirestore(getRealAdminApp());
export const adminAuth = getAuth(getRealAdminApp());
export const adminMessaging = getMessaging(getRealAdminApp());
export const adminStorage = getStorage(getRealAdminApp());
