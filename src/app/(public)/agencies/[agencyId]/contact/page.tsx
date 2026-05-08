'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Mail, Phone } from 'lucide-react';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicContactForm } from '@/components/public/PublicContactForm';
import { Button } from '@/components/ui/button';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

export default function AgencyContactPage() {
  const { agency, agencyId, isAgencyLoading } = usePublicAgency();
  const publicPath = usePublicPath();
  const [isEmailVisible, setIsEmailVisible] = useState(false);
  const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
  const sectionShellClassName = isAgentfinderTheme
    ? 'public-premium-panel rounded-[2rem]'
    : 'rounded-[2rem] border border-emerald-400/15 bg-[linear-gradient(160deg,rgba(7,10,9,0.96)_0%,rgba(10,15,13,0.95)_55%,rgba(13,23,18,0.98)_100%)] shadow-[0_30px_90px_-44px_rgba(0,0,0,0.82)]';
  const softCardClassName = isAgentfinderTheme
    ? 'public-premium-soft-panel rounded-[1.6rem]'
    : 'rounded-[1.6rem] border border-white/8 bg-white/[0.03] shadow-[0_20px_60px_-42px_rgba(0,0,0,0.72)]';
  const eyebrowClassName = isAgentfinderTheme ? 'text-sky-700/80' : 'text-emerald-300/70';
  const headingClassName = isAgentfinderTheme ? 'text-slate-950' : 'text-white';
  const bodyClassName = isAgentfinderTheme ? 'text-slate-600' : 'text-emerald-50/72';
  const iconWrapClassName = isAgentfinderTheme
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-emerald-300/18 bg-emerald-400/10 text-emerald-300';
  const labelClassName = isAgentfinderTheme ? 'text-slate-500' : 'text-emerald-300/72';
  const valueClassName = isAgentfinderTheme ? 'text-slate-950' : 'text-white';

  if (isAgencyLoading || !agency || !agencyId) {
    return (
      <div className="container mx-auto space-y-8 px-4 py-8 md:space-y-10 md:py-12">
        <Skeleton className="h-48 rounded-[2rem]" />
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <Skeleton className="h-[620px] rounded-[2rem]" />
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-[2rem]" />
            <Skeleton className="h-64 rounded-[2rem]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-8 px-4 py-8 md:space-y-10 md:py-12">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <article className="order-2 lg:order-1">
          <PublicContactForm agencyId={agencyId} />
        </article>

        <div className="order-1 space-y-6 lg:order-2">
          <article className={`${sectionShellClassName} p-6 md:p-7`}>
            <div className="space-y-4">
              <div>
                <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", eyebrowClassName)}>Contact rapid</p>
                <h2 className={cn("mt-3 text-3xl font-semibold tracking-tight", headingClassName)}>Orice decizie incepe cu un prim pas!</h2>
              </div>
              <p className={cn("text-sm leading-7", bodyClassName)}>
                Uneori e mai simplu sa ne suni decat sa ne scrii. Daca ai deja o proprietate in minte, spune-ne asta din start si mergem mai repede spre pasul urmator.
              </p>
            </div>

            <div className="mt-6 space-y-3">
              <div className={`${softCardClassName} p-4`}>
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", iconWrapClassName)}>
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", labelClassName)}>Telefon</p>
                    <p className={cn("mt-2 text-lg font-semibold", valueClassName)}>{agency.phone || 'Disponibil la cerere'}</p>
                  </div>
                </div>
              </div>

              <div className={`${softCardClassName} p-4`}>
                <div className="flex items-start gap-4">
                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", iconWrapClassName)}>
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className={cn("text-xs font-semibold uppercase tracking-[0.18em]", labelClassName)}>Email</p>
                    {agency.email ? (
                      isEmailVisible ? (
                        <p className={cn("mt-2 break-all text-lg font-semibold", valueClassName)}>{agency.email}</p>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setIsEmailVisible(true)}
                          className={cn("mt-1 h-auto px-0 py-0 text-left text-base font-semibold hover:bg-transparent", isAgentfinderTheme ? "text-sky-700 hover:text-sky-800" : "text-emerald-200 hover:text-emerald-100")}
                        >
                          Afiseaza adresa de email
                        </Button>
                      )
                    ) : (
                      <p className={cn("mt-2 text-lg font-semibold", valueClassName)}>Disponibil la cerere</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
              {agency.phone ? (
                <Button asChild className={cn("h-12 rounded-full px-6 text-sm font-semibold", isAgentfinderTheme ? "public-premium-primary-button border-0 shadow-none" : "border border-white/10 bg-white text-black shadow-[0_18px_40px_-22px_rgba(255,255,255,0.35)] hover:bg-stone-100")}>
                  <Link href={`tel:${agency.phone}`}>Suna acum</Link>
                </Button>
              ) : null}
              {agency.email ? (
                <Button asChild variant="outline" className={cn("h-12 rounded-full px-6 text-sm font-semibold", isAgentfinderTheme ? "public-premium-outline-button text-slate-700" : "border border-white/10 bg-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.08]")}>
                  <Link href={`mailto:${agency.email}`}>Trimite email</Link>
                </Button>
              ) : null}
            </div>
          </article>

          <article className={`${softCardClassName} overflow-hidden p-5 md:p-6`}>
            <div className="space-y-4">
              <div>
                <p className={cn("text-sm font-semibold uppercase tracking-[0.2em]", eyebrowClassName)}>Mai multe optiuni</p>
                <h3 className={cn("mt-2 text-2xl font-semibold tracking-tight", headingClassName)}>Vrei sa vezi tot portofoliul?</h3>
              </div>

              <p className={cn("text-sm leading-7", isAgentfinderTheme ? "text-slate-600" : "text-stone-300")}>
                Daca vrei sa compari mai multe zone, bugete sau tipuri de proprietati, poti merge direct in lista completa si
                continua cautarea in ritmul tau.
              </p>

              <Button
                asChild
                variant="outline"
                className={cn("h-12 w-full rounded-full px-6 text-sm font-semibold", isAgentfinderTheme ? "public-premium-outline-button text-slate-700" : "border border-emerald-300/18 bg-emerald-400/8 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-emerald-400/12")}
              >
                <Link href={publicPath('/properties')} className="inline-flex items-center justify-center gap-2">
                  Vezi toate proprietatile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
