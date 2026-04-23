'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import type { Auth, User } from 'firebase/auth';
import { onIdTokenChanged } from 'firebase/auth';
import type { FirebaseStorage } from 'firebase/storage';

interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
}

interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  storage: FirebaseStorage;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * Provides the core Firebase services and user authentication state to the component tree.
 * This is the single source of truth for Firebase connectivity and user status.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  auth,
  storage,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start in a loading state until the first auth check completes.
    userError: null,
  });

  useEffect(() => {
    let isMounted = true;

    setUserAuthState({
      user: null,
      isUserLoading: true,
      userError: null,
    });

    const unsubscribe = onIdTokenChanged(
      auth,
      (user) => {
        if (!isMounted) return;
        setUserAuthState({ user, isUserLoading: false, userError: null });
      },
      (error) => {
        if (!isMounted) return;
        console.error("FirebaseProvider: Auth token listener error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );

    void auth.authStateReady().catch((error) => {
      if (!isMounted) return;
      console.error("FirebaseProvider: authStateReady failed:", error);
      setUserAuthState({ user: null, isUserLoading: false, userError: error instanceof Error ? error : new Error('Auth state could not be resolved.') });
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [auth]);

  // Memoize the context value to prevent unnecessary re-renders of consuming components.
  const contextValue = useMemo((): FirebaseContextState => ({
    firebaseApp,
    firestore,
    auth,
    storage,
    user: userAuthState.user,
    isUserLoading: userAuthState.isUserLoading,
    userError: userAuthState.userError,
  }), [firebaseApp, firestore, auth, storage, userAuthState]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access all core Firebase services and the user authentication state.
 * Throws an error if used outside of a FirebaseProvider.
 */
export const useFirebase = (): FirebaseContextState => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
};

/** Hook to access the Firebase Auth instance directly. */
export const useAuth = (): Auth => useFirebase().auth;

/** Hook to access the Firestore instance directly. */
export const useFirestore = (): Firestore => useFirebase().firestore;

/** Hook to access the Firebase App instance directly. */
export const useFirebaseApp = (): FirebaseApp => useFirebase().firebaseApp;

/** Hook to access the Firebase Storage instance directly. */
export const useStorage = (): FirebaseStorage => useFirebase().storage;
