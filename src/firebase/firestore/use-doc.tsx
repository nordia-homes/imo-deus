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

  const [state, setState] = useState<UseDocResult<T> & {
    reference: typeof memoizedDocRef;
  }>({ reference: memoizedDocRef, data: null, isLoading: !!memoizedDocRef, error: null });

  useEffect(() => {
    if (!memoizedDocRef) {
      setState({ reference: memoizedDocRef, data: null, isLoading: false, error: null });
      return;
    }

    setState({ reference: memoizedDocRef, data: null, isLoading: true, error: null });

    let isSubscribed = true;
    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!isSubscribed) return;

        const docExists = snapshot.exists();
        
        setState({ reference: memoizedDocRef,
          data: docExists ? { ...(snapshot.data() as T), id: snapshot.id } : null,
          error: null, isLoading: false });
      },
      (err: FirestoreError) => {
        if (!isSubscribed) return;

        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });

        setState({ reference: memoizedDocRef, error: contextualError, data: null, isLoading: false });
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

  // A dependent reference (e.g. profile -> agency) can appear during render,
  // before the subscription effect runs. Never expose the previous reference's
  // loaded state: route guards would mistake it for a missing document.
  if (!memoizedDocRef) return { data: null, isLoading: false, error: null };
  if (state.reference !== memoizedDocRef) return { data: null, isLoading: true, error: null };
  return { data: state.data, isLoading: state.isLoading, error: state.error };
}
