
'use client';
import { ReactNode, use, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Agency } from '@/lib/types';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicAgencyProvider } from '@/context/PublicAgencyContext';
import { notFound } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

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


export default function AgencyPublicLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ agencyId: string }>;
}) {
  const firestore = useFirestore();
  const { agencyId } = use(params);

  const agencyDocRef = useMemoFirebase(() => {
      if (!agencyId) return null;
      return doc(firestore, 'agencies', agencyId);
  }, [firestore, agencyId]);

  const { data: agency, isLoading: isAgencyLoading, error } = useDoc<Agency>(agencyDocRef);

  useEffect(() => {
    // If loading is finished and there's still no agency or an error occurred, show 404
    if (!isAgencyLoading && (error || !agency)) {
        notFound();
    }
  }, [isAgencyLoading, agency, error]);
  
  useEffect(() => {
    const root = document.documentElement;
    const defaultPrimary = '145 63% 45%';
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

  const providerValue = {
    agency,
    agencyId,
    isAgencyLoading,
    siteBasePath: `/agencies/${agencyId}`,
    isCustomDomain: false,
  };

  // Render a loading shell while fetching agency data
  if (isAgencyLoading || !agency) {
      return (
          <>
              <PublicHeader agency={null} isLoading={true} />
               <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_28%),linear-gradient(180deg,_#050505_0%,_#0b0b0d_42%,_#121214_100%)]">
                  <section className="relative h-[60vh] flex items-center justify-center text-center">
                      <div className="relative z-10 p-4">
                          <Skeleton className="h-16 w-96 mb-4" />
                          <Skeleton className="h-8 w-80 mb-8" />
                      </div>
                  </section>
              </main>
          </>
      )
  }

  return (
    <PublicAgencyProvider value={providerValue}>
      <PublicHeader agency={agency} isLoading={isAgencyLoading} />
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_24%),linear-gradient(180deg,_#050505_0%,_#0b0b0d_42%,_#121214_100%)] text-stone-100">{children}</main>
      <PublicFooter />
    </PublicAgencyProvider>
  );
}
