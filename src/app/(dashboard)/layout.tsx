'use client';
import { AppShell } from '@/components/layout/app-shell';
import { useRouter, usePathname } from 'next/navigation';
import React, { useEffect } from 'react';
import { useUser } from '@/firebase';
import { AgencyProvider, useAgency } from '@/context/AgencyContext';
import { PushNotificationsBootstrap } from '@/components/notifications/PushNotificationsBootstrap';
import { applyAgencyThemeToRoot, resetAgencyThemeOnRoot } from '@/lib/theme';


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

function DashboardRoot({ children }: { children: React.ReactNode }) {
    const { agency, agencyId, userProfile, isAgencyLoading } = useAgency();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const root = document.documentElement;
        applyAgencyThemeToRoot(root, agency);

        return () => {
            resetAgencyThemeOnRoot(root);
        }
    }, [agency]);

    useEffect(() => {
        if (!isAgencyLoading && userProfile?.role === 'platform_admin') {
            router.replace('/master-admin');
            return;
        }

        // We redirect if loading is finished, and we can determine there is no agency.
        // The best way to know is to check if the loaded user profile has an agencyId.
        if (!isAgencyLoading && !agencyId && pathname !== '/settings') {
            router.replace('/settings');
        }
    }, [agencyId, isAgencyLoading, pathname, router, userProfile?.role]);

    // We show the loader if ANY data is still loading.
    if (isAgencyLoading) {
        return <FullScreenLoader />;
    }

    if (userProfile?.role === 'platform_admin') {
        return <FullScreenLoader />;
    }
    
    // After loading, if the user has no agency ID and is not on the settings page, keep showing the loader
    // until the redirect from the useEffect happens.
    if (!agencyId && pathname !== '/settings') {
        return <FullScreenLoader />;
    }

    // Also, if the user profile has an agency ID, but the agency data itself hasn't arrived yet
    // (or is null, indicating an invalid ID), we should also wait.
    if (agencyId && !agency && pathname !== '/settings') {
        return <FullScreenLoader />;
    }

    return <AppShell>{children}</AppShell>;
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // We only want to redirect when we are certain about the auth state
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  // While checking auth state or if user is not logged in (and about to be redirected), show a loader.
  if (isUserLoading || !user) {
      return <FullScreenLoader />;
  }

  return (
    <AgencyProvider>
        <PushNotificationsBootstrap />
        <DashboardRoot>
            {children}
        </DashboardRoot>
    </AgencyProvider>
  );
}
