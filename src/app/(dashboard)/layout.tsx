'use client';
import { AppShell } from '@/components/layout/app-shell';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';


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

function hexToHsl(hex: string): string | null {
    if (!hex || !hex.startsWith('#')) return null;

    let hexValue = hex.replace(/#/, '');
    
    if(hexValue.length === 3) {
        hexValue = hexValue.split('').map(char => char + char).join('');
    }

    if(hexValue.length !== 6) return null;

    const r = parseInt(hexValue.substring(0, 2), 16) / 255;
    const g = parseInt(hexValue.substring(2, 4), 16) / 255;
    const b = parseInt(hexValue.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    let l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);

    return `${h} ${s}% ${l}%`;
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  useEffect(() => {
    // We only want to redirect when we are certain about the auth state
    if (!isUserLoading && !user) {
      router.replace('/login');
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const root = document.documentElement;
    const defaultPrimary = '250 65% 55%';

    if (userProfile?.agencyPrimaryColor) {
        const hslColor = hexToHsl(userProfile.agencyPrimaryColor);
        if (hslColor) {
             root.style.setProperty('--primary', hslColor);
             root.style.setProperty('--ring', hslColor);
        } else {
             root.style.setProperty('--primary', defaultPrimary);
             root.style.setProperty('--ring', defaultPrimary);
        }
    } else {
      // Reset to default when color is removed or not present
      root.style.setProperty('--primary', defaultPrimary);
      root.style.setProperty('--ring', defaultPrimary);
    }
    
    // Cleanup function to reset styles when component unmounts or user logs out
    return () => {
        root.style.setProperty('--primary', defaultPrimary);
        root.style.setProperty('--ring', defaultPrimary);
    }
  }, [userProfile]);

  // While checking auth state or if user is not logged in (and about to be redirected), show a loader.
  if (isUserLoading || !user) {
      return <FullScreenLoader />;
  }

  return <AppShell>{children}</AppShell>;
}
