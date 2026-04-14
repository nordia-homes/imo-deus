'use client';
import { PublicHeader } from "@/components/public/PublicHeader";
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Agency, ClientPortal } from '@/lib/types';
import { useParams, notFound } from 'next/navigation';
import { ReactNode, useEffect } from 'react';
import { Skeleton } from "@/components/ui/skeleton";
import { applyAgencyThemeToRoot, resetAgencyThemeOnRoot } from '@/lib/theme';


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
        applyAgencyThemeToRoot(root, agency);
        return () => {
            resetAgencyThemeOnRoot(root);
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
            </>
        )
    }

    return (
        <>
            <PublicHeader agency={agency} isLoading={isLoading} />
            <main className="min-h-screen bg-background">{children}</main>
        </>
    );
}
