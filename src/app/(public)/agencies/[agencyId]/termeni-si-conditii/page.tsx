'use client';

import { ScrollText } from 'lucide-react';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { defaultTermsAndConditions } from '@/lib/legal-content';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

export default function AgencyTermsPage() {
  const { agency } = usePublicAgency();
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
  const content = agency?.termsAndConditions?.trim() || defaultTermsAndConditions;
  const legalShellClassName = isAgentfinderTheme
    ? 'public-premium-panel rounded-[2rem]'
    : 'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';

  return (
    <div className="container mx-auto px-4 pb-8 pt-8 md:pb-10 md:pt-12">
      <section className={`${legalShellClassName} p-6 md:p-8`}>
        <div className="max-w-4xl">
          <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold", isAgentfinderTheme ? "border border-sky-200 bg-sky-50 text-sky-700" : "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100")}>
            <ScrollText className="h-4 w-4" />
            Termeni si conditii
          </div>
          <h1 className={cn("mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight", isAgentfinderTheme ? "text-slate-950" : "text-white")}>
            Termeni si conditii
          </h1>
          <p className={cn("mt-4 text-base leading-7 md:text-lg", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/78")}>
            Informatii privind utilizarea website-ului public al {agency?.name || 'agentiei'}.
          </p>
        </div>

        <article className={cn("mt-8 rounded-[1.75rem] p-5 md:p-7", isAgentfinderTheme ? "border border-slate-200 bg-white/84" : "border border-white/8 bg-black/20")}>
          <div className={cn("whitespace-pre-wrap text-sm leading-8 md:text-base", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/82")}>
            {content}
          </div>
        </article>
      </section>
    </div>
  );
}
