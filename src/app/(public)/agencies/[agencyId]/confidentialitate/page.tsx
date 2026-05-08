'use client';

import { ShieldCheck, Building2, Mail, MapPin, Phone, UserCircle2, BadgeInfo } from 'lucide-react';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { buildPrivacySections, getAgencyLegalIdentity } from '@/lib/legal-content';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

export default function AgencyPrivacyPage() {
  const { agency } = usePublicAgency();
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
  const identity = getAgencyLegalIdentity(agency);
  const sections = buildPrivacySections(agency);
  const legalShellClassName = isAgentfinderTheme
    ? 'public-premium-panel rounded-[2rem]'
    : 'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';
  const metaCardClassName = isAgentfinderTheme
    ? 'rounded-[1.5rem] border border-slate-200 bg-white/88 p-5'
    : 'rounded-[1.5rem] border border-white/8 bg-black/20 p-5';

  return (
    <div className="container mx-auto px-4 pb-8 pt-8 md:pb-10 md:pt-12">
      <section className={`${legalShellClassName} p-6 md:p-8`}>
        <div className="max-w-5xl">
          <div className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold", isAgentfinderTheme ? "border border-sky-200 bg-sky-50 text-sky-700" : "border border-emerald-300/20 bg-emerald-400/10 text-emerald-100")}>
            <ShieldCheck className="h-4 w-4" />
            Confidentialitate
          </div>
          <h1 className={cn("mt-5 text-[clamp(2rem,4vw,3.5rem)] font-semibold tracking-tight", isAgentfinderTheme ? "text-slate-950" : "text-white")}>
            Politica de confidentialitate
          </h1>
          <p className={cn("mt-4 max-w-4xl text-base leading-7 md:text-lg", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/78")}>
            Aceasta pagina explica in mod detaliat cum colecteaza, utilizeaza si protejeaza {identity.displayName} datele cu caracter personal transmise prin website-ul public.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className={metaCardClassName}>
            <div className={cn("flex items-center gap-3", isAgentfinderTheme ? "text-sky-700" : "text-emerald-200")}>
              <Building2 className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">Denumire legala</p>
            </div>
            <p className={cn("mt-3 text-lg font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{identity.legalCompanyName}</p>
          </div>
          <div className={metaCardClassName}>
            <div className={cn("flex items-center gap-3", isAgentfinderTheme ? "text-sky-700" : "text-emerald-200")}>
              <BadgeInfo className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">CUI</p>
            </div>
            <p className={cn("mt-3 text-lg font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{identity.companyTaxId}</p>
          </div>
          <div className={metaCardClassName}>
            <div className={cn("flex items-center gap-3", isAgentfinderTheme ? "text-sky-700" : "text-emerald-200")}>
              <UserCircle2 className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">Reprezentant legal</p>
            </div>
            <p className={cn("mt-3 text-lg font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{identity.legalRepresentative}</p>
          </div>
          <div className={`${metaCardClassName} md:col-span-2 xl:col-span-1`}>
            <div className={cn("flex items-center gap-3", isAgentfinderTheme ? "text-sky-700" : "text-emerald-200")}>
              <MapPin className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">Sediu social</p>
            </div>
            <p className={cn("mt-3 text-lg font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{identity.registeredOffice}</p>
          </div>
          <div className={metaCardClassName}>
            <div className={cn("flex items-center gap-3", isAgentfinderTheme ? "text-sky-700" : "text-emerald-200")}>
              <Phone className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">Telefon</p>
            </div>
            <p className={cn("mt-3 text-lg font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{identity.phone}</p>
          </div>
          <div className={metaCardClassName}>
            <div className={cn("flex items-center gap-3", isAgentfinderTheme ? "text-sky-700" : "text-emerald-200")}>
              <Mail className="h-5 w-5" />
              <p className="text-sm font-semibold uppercase tracking-[0.16em]">Email</p>
            </div>
            <p className={cn("mt-3 break-all text-lg font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{identity.email}</p>
          </div>
        </div>

        <article className={cn("mt-8 space-y-6 rounded-[1.75rem] p-5 md:p-7", isAgentfinderTheme ? "border border-slate-200 bg-white/84" : "border border-white/8 bg-black/20")}>
          {sections.map((section) => (
            <section key={section.title} className={cn("rounded-[1.5rem] p-5", isAgentfinderTheme ? "border border-slate-200 bg-slate-50/80" : "border border-white/6 bg-white/[0.02]")}>
              <h2 className={cn("text-lg font-semibold md:text-xl", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{section.title}</h2>
              <div className="mt-4 space-y-4">
                {section.paragraphs.map((paragraph, index) => (
                  <p key={`${section.title}-${index}`} className={cn("text-sm leading-8 md:text-base", isAgentfinderTheme ? "text-slate-600" : "text-emerald-50/82")}>
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>
      </section>
    </div>
  );
}
