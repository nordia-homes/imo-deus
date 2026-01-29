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
  const { isLoggedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace('/login');
    }
  }, [isLoggedIn, router]);

  if (!isLoggedIn) {
      return <FullScreenLoader />;
  }

  return <AppShell>{children}</AppShell>;
}
