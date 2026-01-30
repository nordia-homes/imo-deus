
'use client';
import { ReactNode, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Agency } from '@/lib/types';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';

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
  params: { agencyId: string };
}) {
  const firestore = useFirestore();

  const agencyDocRef = useMemoFirebase(() => {
      if (!params.agencyId) return null;
      return doc(firestore, 'agencies', params.agencyId);
  }, [firestore, params.agencyId]);

  const { data: agency, isLoading } = useDoc<Agency>(agencyDocRef);

  useEffect(() => {
    const root = document.documentElement;
    if (agency?.primaryColor) {
      const hslColor = hexToHsl(agency.primaryColor);
      if (hslColor) {
        root.style.setProperty('--primary', hslColor);
        root.style.setProperty('--ring', hslColor);
      }
    }
    // Cleanup function to reset the color when the component unmounts or agency changes
    return () => {
        const defaultPrimary = '250 65% 55%';
        root.style.setProperty('--primary', defaultPrimary);
        root.style.setProperty('--ring', defaultPrimary);
    }
  }, [agency]);

  return (
    <div>
      <PublicHeader agency={agency} isLoading={isLoading} />
      <main className="min-h-screen bg-background">{children}</main>
      <PublicFooter agency={agency} isLoading={isLoading} />
    </div>
  );
}

