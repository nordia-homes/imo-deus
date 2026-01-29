'use client';

import { useRouter } from 'next/navigation';
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
  useCallback,
} from 'react';

// A simple skeleton loader
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
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // localStorage is not available on the server, so we use useEffect.
    const storedAuth = localStorage.getItem('isLoggedIn') === 'true';
    setIsLoggedIn(storedAuth);
    setLoading(false);
  }, []);

  const login = useCallback(() => {
    localStorage.setItem('isLoggedIn', 'true');
    setIsLoggedIn(true);
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('isLoggedIn');
    setIsLoggedIn(false);
    router.push('/login');
  }, [router]);

  const value = { isLoggedIn, login, logout };

  if (loading) {
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
