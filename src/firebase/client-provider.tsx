'use client';

import React, { useMemo } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

/**
 * A client-side component that ensures Firebase is initialized only once
 * in the browser and provides the necessary services through FirebaseProvider.
 */
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const firebaseServices = useMemo(() => {
    // initializeFirebase is memoized internally, but we use useMemo here
    // as a strong guarantee it runs only once per component lifecycle.
    return initializeFirebase();
  }, []);

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
