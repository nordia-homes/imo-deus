import { useMemo, type DependencyList } from 'react';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

// Re-export core hooks and providers from their new locations
export * from './init';
export * from './provider';
export * from './client-provider';
export * from './auth/use-user';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';

type Memoizable = object | null | undefined;

/**
 * A hook for memoizing Firebase queries or document references.
 * This is CRITICAL for preventing infinite loops in `useDoc` and `useCollection`.
 * It tags the memoized object with a `__memo` property, which the hooks check for.
 *
 * @param factory A function that returns the Firestore query or reference.
 * @param deps The dependency array for `useMemo`.
 * @returns The memoized query or reference.
 */
export function useMemoFirebase<T extends Memoizable>(factory: () => T, deps: DependencyList): T {
    const memoized = useMemo(factory, deps);

    if (memoized && typeof memoized === 'object') {
        // Tag the object to indicate it's been memoized.
        (memoized as T & { __memo?: boolean }).__memo = true;
    }
    
    return memoized;
}
