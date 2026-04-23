'use client';
import { firebaseConfig, demoFirebaseConfig, hasDemoFirebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { RuntimeMode } from '@/lib/runtime-mode';

/**
 * Initializes and returns the Firebase app and associated services.
 * This function handles both server-side and client-side initialization,
 * ensuring that `initializeApp` is called only once.
 */
export function initializeFirebase(mode: RuntimeMode = 'real') {
  const appName = mode === 'demo' ? 'demo-app' : '[DEFAULT]';
  const existingApp = getApps().find((candidate) => candidate.name === appName);

  const options: FirebaseOptions =
    mode === 'demo' && hasDemoFirebaseConfig() ? demoFirebaseConfig : firebaseConfig;

  const app = existingApp
    ? getApp(appName)
    : mode === 'demo'
      ? initializeApp(options, appName)
      : getApps().find((candidate) => candidate.name === '[DEFAULT]')
        ? getApp()
        : initializeApp(options);

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}
