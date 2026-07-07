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

  const isHostedRuntime = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);

  if (isHostedRuntime) {
    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
    if (!projectId) {
      throw new Error(
        'FIREBASE_PROJECT_ID sau GOOGLE_CLOUD_PROJECT trebuie setat pentru Firebase Admin in mediul gazduit.'
      );
    }

    return initializeApp(
      {
        credential: applicationDefault(),
        projectId,
        storageBucket: resolveStorageBucket(projectId),
      },
      REAL_ADMIN_APP_NAME
    );
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Variabilele de mediu Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) nu sunt setate corect in environment variables ale aplicatiei.'
    );
  }

  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
    throw new Error(
      'Cheia privata FIREBASE_PRIVATE_KEY din environment variables pare a fi invalida.'
    );
  }

  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  return initializeApp(
    {
      credential: cert(serviceAccount),
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
