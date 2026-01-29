'use client';

import { useRouter } from 'next/navigation';
import React, {
  createContext,
  useContext,
  ReactNode,
  useCallback,
} from 'react';
import {
  useAuth as useFirebaseAuth,
  useUser,
} from '@/firebase';
import {
  signInWithEmailAndPassword,
  signOut,
  AuthError,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

function FullScreenLoader() {
    return (
        <div className="h-screen w-screen flex items-center justify-center bg-background">
            <div className="animate-pulse flex space-x-4">
                <div className="rounded-full bg-muted h-12 w-12"></div>
            </div>
        </div>
    )
}

type AuthContextType = {
  isLoggedIn: boolean;
  login: (email: string, pass: string, onError: (error: AuthError) => void) => void;
  signup: (email: string, pass: string, onError: (error: AuthError) => void) => void;
  logout: () => void;
  isUserLoading: boolean;
  resetPassword: (email: string, onSuccess: () => void, onError: (error: AuthError) => void) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const auth = useFirebaseAuth();
  const { user, isUserLoading } = useUser();

  const login = useCallback((email: string, pass: string, onError: (error: AuthError) => void) => {
    signInWithEmailAndPassword(auth, email, pass)
      .catch((error: AuthError) => {
        onError(error);
      });
  }, [auth]);

  const signup = useCallback((email: string, pass: string, onError: (error: AuthError) => void) => {
    createUserWithEmailAndPassword(auth, email, pass)
      .catch((error: AuthError) => {
        onError(error);
      });
  }, [auth]);
  
  const resetPassword = useCallback((email: string, onSuccess: () => void, onError: (error: AuthError) => void) => {
    sendPasswordResetEmail(auth, email)
        .then(() => {
            onSuccess();
        })
        .catch((error: AuthError) => {
            onError(error);
        });
  }, [auth]);

  const logout = useCallback(() => {
    signOut(auth).then(() => {
        router.push('/login');
    });
  }, [auth, router]);

  const value = { isLoggedIn: !!user, login, signup, logout, isUserLoading, resetPassword };

  // We use isUserLoading from Firebase provider, which handles the initial auth state check.
  if (isUserLoading) {
      return <FullScreenLoader />;
  }

  return (
    <AuthContext.Provider value={value}>
        {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
