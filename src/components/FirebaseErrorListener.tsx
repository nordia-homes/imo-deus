'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's error overlay,
 * providing rich, contextual debugging information for security rule violations.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Set the error in state to trigger a re-render.
      // During the re-render, the error will be thrown.
      setError(error);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // If an error has been set, throw it. Next.js will catch it and display the overlay.
  if (error) {
    throw error;
  }

  // This component renders nothing to the DOM.
  return null;
}
