'use client';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoggedIn, isUserLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // We only want to redirect when we are certain about the auth state
    if (!isUserLoading && !isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, isUserLoading, router]);

  // While checking auth state or if user is not logged in (and about to be redirected), show a loader.
  if (isUserLoading || !isLoggedIn) {
      return <FullScreenLoader />;
  }

  return <AppShell>{children}</AppShell>;
}
