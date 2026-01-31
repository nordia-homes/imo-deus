'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's error overlay,
 * providing rich, contextual debugging information for security rule violations.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      // Throw the error asynchronously in a new task.
      // This ensures it doesn't interfere with React's render cycle, which can
      // cause warnings in development with hot-reloading. The Next.js development
      // overlay will catch this unhandled exception and display it.
      setTimeout(() => {
        throw err;
      }, 0);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // This component now only sets up the listener and renders nothing.
  return null;
}
