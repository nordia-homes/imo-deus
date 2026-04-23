'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase/init';
import { hasDemoFirebaseConfig } from '@/firebase/config';
import { getStoredRuntimeMode, RUNTIME_MODE_CHANGED_EVENT, type RuntimeMode } from '@/lib/runtime-mode';

/**
 * A client-side component that ensures Firebase is initialized only once
 * in the browser and provides the necessary services through FirebaseProvider.
 */
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const [runtimeMode, setRuntimeMode] = useState<RuntimeMode>('real');
  const [isResolved, setIsResolved] = useState(false);

  useEffect(() => {
    const applyRuntimeMode = (nextMode: RuntimeMode) => {
      if (nextMode === 'demo' && !hasDemoFirebaseConfig()) {
        setRuntimeMode('real');
        setIsResolved(true);
        return;
      }

      setRuntimeMode(nextMode);
      setIsResolved(true);
    };

    applyRuntimeMode(getStoredRuntimeMode());

    const handleModeChanged = (event: Event) => {
      const customEvent = event as CustomEvent<RuntimeMode>;
      applyRuntimeMode(customEvent.detail || 'real');
    };

    window.addEventListener(RUNTIME_MODE_CHANGED_EVENT, handleModeChanged as EventListener);

    return () => {
      window.removeEventListener(RUNTIME_MODE_CHANGED_EVENT, handleModeChanged as EventListener);
    };
  }, []);

  const firebaseServices = useMemo(() => {
    if (!isResolved) return null;
    return initializeFirebase(runtimeMode);
  }, [isResolved, runtimeMode]);

  if (!isResolved || !firebaseServices) {
    return null;
  }

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
