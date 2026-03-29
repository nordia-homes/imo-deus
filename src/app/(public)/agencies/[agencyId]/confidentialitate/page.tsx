'use client';

import { ShieldCheck } from 'lucide-react';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { defaultPrivacyPolicy } from '@/lib/legal-content';

const legalShellClassName =
  'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';

export default function AgencyPrivacyPage() {
  const { agency } = usePublicAgency();
  const content = agency?.privacyPolicy?.trim() || defaultPrivacyPolicy;

  return (
    <div className="container mx-auto px-4 pb-8 pt-8 md:pb-10 md:pt-12">
      <section className={`${legalShellClassName} p-6 md:p-8`}>
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-semibold text-emerald-100">
            <ShieldCheck className="h-4 w-4" />
            Confidentialitate
          </div>
          <h1 className="mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight text-white">
            Confidentialitate
          </h1>
          <p className="mt-4 text-base leading-7 text-emerald-50/78 md:text-lg">
            Informatii despre modul in care {agency?.name || 'agentia'} utilizeaza datele transmise prin website.
          </p>
        </div>

        <article className="mt-8 rounded-[1.75rem] border border-white/8 bg-black/20 p-5 md:p-7">
          <div className="whitespace-pre-wrap text-sm leading-8 text-emerald-50/82 md:text-base">
            {content}
          </div>
        </article>
      </section>
    </div>
  );
}
