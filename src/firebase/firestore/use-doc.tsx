'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { WithId } from '@/lib/types';


/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * 
 * CRITICAL: The `memoizedDocRef` parameter MUST be memoized using `useMemoFirebase`
 * from `@/firebase`. Failure to do so will result in an error and potential infinite loops.
 *
 * @template T Type for document data. Defaults to `DocumentData`.
 * @param {DocumentReference<DocumentData> | null | undefined} memoizedDocRef -
 * The memoized Firestore DocumentReference. The hook is dormant if null/undefined.
 * @returns {UseDocResult<T>} Object with data, isLoading, and error state.
 */
export function useDoc<T = DocumentData>(
  memoizedDocRef: (DocumentReference<DocumentData> & { __memo?: boolean }) | null | undefined,
): UseDocResult<T> {

  if (memoizedDocRef && !memoizedDocRef.__memo) {
    throw new Error('DocumentReference passed to useDoc was not memoized. Please use the `useMemoFirebase` hook.');
  }

  const [data, setData] = useState<WithId<T> | null>(null);
  const [isLoading, setIsLoading] = useState(!!memoizedDocRef);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    let isSubscribed = true;
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!isSubscribed) return;

        const docExists = snapshot.exists();
        
        setData(currentData => {
            if (!docExists) {
                return null;
            }
            const newData = { ...(snapshot.data() as T), id: snapshot.id };
            if (JSON.stringify(currentData) === JSON.stringify(newData)) {
                return currentData;
            }
            return newData;
        });

        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        if (!isSubscribed) return;

        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => {
      isSubscribed = false;
      try {
        unsubscribe();
      } catch (e) {
        console.warn("Caught an error during Firestore unsubscribe:", e);
      }
    };
  }, [memoizedDocRef]);

  return { data, isLoading, error };
}
