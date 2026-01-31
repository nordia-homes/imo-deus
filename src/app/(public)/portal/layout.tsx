'use client';
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Agency, ClientPortal } from '@/lib/types';
import { useParams, notFound } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Skeleton } from "@/components/ui/skeleton";

// Theme helper
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
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
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


// This layout gets the portalId from params, fetches the portal, then fetches the agency to style the header/footer.
export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const portalId = params.portalId as string;
    const firestore = useFirestore();

    // 1. Fetch portal data to get agencyId
    const portalDocRef = useMemoFirebase(() => doc(firestore, 'portals', portalId), [firestore, portalId]);
    const { data: portal, isLoading: isPortalLoading, error: portalError } = useDoc<ClientPortal>(portalDocRef);
    
    const agencyId = portal?.agencyId;

    // 2. Fetch agency data using agencyId
    const agencyDocRef = useMemoFirebase(() => {
        if (!agencyId) return null;
        return doc(firestore, 'agencies', agencyId);
    }, [firestore, agencyId]);
    const { data: agency, isLoading: isAgencyLoading, error: agencyError } = useDoc<Agency>(agencyDocRef);
    
    // Combined loading state
    const isLoading = isPortalLoading || isAgencyLoading;

    // Handle not found
    useEffect(() => {
        if (!isPortalLoading && (portalError || !portal)) {
            notFound();
        }
    }, [isPortalLoading, portal, portalError]);
    
    // Apply agency theme
    useEffect(() => {
        const root = document.documentElement;
        const defaultPrimary = '250 65% 55%'; // A fallback color
        if (agency?.primaryColor) {
          const hslColor = hexToHsl(agency.primaryColor);
          if (hslColor) {
            root.style.setProperty('--primary', hslColor);
            root.style.setProperty('--ring', hslColor);
          }
        } else {
             root.style.setProperty('--primary', defaultPrimary);
             root.style.setProperty('--ring', defaultPrimary);
        }
        return () => {
            root.style.setProperty('--primary', defaultPrimary);
            root.style.setProperty('--ring', defaultPrimary);
        }
    }, [agency]);

    if (isLoading) {
        return (
            <>
                <PublicHeader agency={null} isLoading={true} />
                <main className="min-h-screen bg-background container mx-auto max-w-5xl py-12 px-4 space-y-8">
                  <Skeleton className="h-10 w-2/3" />
                  <Skeleton className="h-6 w-1/2" />
                  <div className="grid md:grid-cols-2 gap-8">
                    <Skeleton className="h-[500px] w-full" />
                    <Skeleton className="h-[500px] w-full" />
                  </div>
                </main>
                <PublicFooter agency={null} isLoading={true} />
            </>
        )
    }

    return (
        <>
            <PublicHeader agency={agency} isLoading={isLoading} />
            <main className="min-h-screen bg-background">{children}</main>
            <PublicFooter agency={agency} isLoading={isLoading} />
        </>
    );
}