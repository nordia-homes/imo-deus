// src/firebase/server.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// Initialize Firebase for server-side usage
export function initializeServerFirebase() {
  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  return {
    firestore: getFirestore(app),
  };
}
