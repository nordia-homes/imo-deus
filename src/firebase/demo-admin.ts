import { applicationDefault, cert, getApp, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getDemoAdminApp(): App {
  const existing = getApps().find((candidate) => candidate.name === 'demo-admin');
  if (existing) {
    return getApp('demo-admin');
  }

  const projectId = process.env.DEMO_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.DEMO_FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.DEMO_FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const isHostedRuntime = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);

  if (isHostedRuntime && projectId) {
    return initializeApp(
      {
        credential: applicationDefault(),
        projectId,
      },
      'demo-admin'
    );
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Demo Firebase admin credentials are missing. Set DEMO_FIREBASE_PROJECT_ID, DEMO_FIREBASE_CLIENT_EMAIL and DEMO_FIREBASE_PRIVATE_KEY.'
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
    },
    'demo-admin'
  );
}

export function getDemoAdminDb() {
  return getFirestore(getDemoAdminApp());
}

export function getDemoAdminAuth() {
  return getAuth(getDemoAdminApp());
}
