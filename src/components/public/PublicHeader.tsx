'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetTitle } from '@/components/ui/sheet';
import { Home, Building2, KeyRound, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Agency } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { ModernMenuIcon } from '../icons/ModernMenuIcon';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';

interface PublicHeaderProps {
  agency: Agency | null;
  isLoading: boolean;
}

export function PublicHeader({ agency, isLoading }: PublicHeaderProps) {
  const pathname = usePathname();
  const displayPath = (pathname ?? '/').replace(/^\/__public\/[^/]+/, '') || '/';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const agencyId = agency?.id;
  const { agency: contextAgency } = usePublicAgency();
  const publicPath = usePublicPath();
  const isAgentfinderTheme = getAgencyThemePreset(contextAgency || agency) === 'agentfinder';
  const headerLogoUrl = isAgentfinderTheme
    ? 'https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/Logo_Nordia_Website.png?alt=media&token=a4ac649c-de17-4131-9734-9e0e3b928df6'
    : agency?.logoUrl;

  const navLinks = [
    { href: publicPath(), label: 'Acasă', icon: <Home /> },
    { href: publicPath('/properties'), label: 'Proprietăți', icon: <Building2 /> },
    { href: publicPath('/proprietari'), label: 'Proprietari', icon: <KeyRound /> },
    { href: publicPath('/contact'), label: 'Contact', icon: <Mail /> },
  ];

  const MobileNavLink = ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void; }) => {
    const isActive = displayPath === href;
    return (
      <SheetClose asChild>
        <Link
          href={href}
          className={cn(
            'flex items-center gap-4 rounded-2xl p-4 text-lg font-medium transition-colors',
            isAgentfinderTheme
              ? isActive
                ? 'border border-slate-200/80 bg-white/92 text-slate-950'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-950'
              : isActive
                ? 'bg-white/10 text-white'
                : 'text-stone-300 hover:bg-white/5 hover:text-white'
          )}
          onClick={onClick}
        >
          {children}
        </Link>
      </SheetClose>
    );
  };

  return (
    <header
      className={cn(
        'sticky top-0 z-50 backdrop-blur-xl',
        isAgentfinderTheme
          ? 'bg-transparent px-4 pt-5 sm:px-5 lg:px-6 xl:px-8'
          : 'border-b border-white/10 bg-[var(--public-header-bg)] text-stone-100 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.82)]'
      )}
    >
      <div
        className={cn(
          'container relative mx-auto flex items-center justify-between',
          isAgentfinderTheme
            ? 'landing-glass-panel rounded-[30px] px-5 py-4 md:px-6'
            : 'h-16 px-4 md:h-20'
        )}
      >
        <Link href={publicPath()} className="flex min-w-0 items-center gap-3 text-left">
          {isLoading ? <Skeleton className="h-10 w-40" /> : (
            <>
              {headerLogoUrl ? (
                <div
                  className={cn(
                    'relative px-1',
                    isAgentfinderTheme ? 'h-9 w-28 md:h-10 md:w-36' : 'h-9 w-28 md:h-12 md:w-60'
                  )}
                >
                   <Image src={headerLogoUrl} alt={agency?.name || 'Logo agentie'} fill className="object-contain" />
                </div>
              ) : (
                 <span className={cn('truncate text-base font-semibold tracking-[0.02em] md:text-xl', isAgentfinderTheme ? 'text-slate-950' : 'text-stone-100')}>
                   {agency?.name || 'Agentie Imobiliara'}
                 </span>
              )}
              <span
                className={cn(
                  'whitespace-nowrap pl-1 md:pl-2',
                  isAgentfinderTheme ? 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 md:text-xs' : 'text-lg text-[var(--public-accent)] md:text-2xl'
                )}
                style={isAgentfinderTheme ? undefined : { fontFamily: '"Brush Script MT", "Segoe Script", cursive', lineHeight: 1 }}
              >
                Cautarea se opreste aici!
              </span>
            </>
          )}
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {agencyId && navLinks.map(link => {
            const isActive = displayPath === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isAgentfinderTheme
                    ? isActive
                      ? 'border border-slate-200/80 bg-white/92 text-slate-950 shadow-[0_14px_30px_rgba(37,55,88,0.06)]'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-950'
                    : isActive
                      ? 'bg-white/10 text-white'
                      : 'text-stone-300 hover:bg-white/5 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute right-4 md:hidden">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-10 w-10 rounded-full border border-white/10',
                  isAgentfinderTheme
                    ? 'border-slate-200 bg-white/82 text-slate-700 hover:bg-white hover:text-slate-950'
                    : 'bg-[#18191d] text-stone-200 hover:bg-[#202126] hover:text-white'
                )}
              >
                <ModernMenuIcon className="h-7 w-7" />
                <span className="sr-only">Deschide meniu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className={cn(
                'w-[80vw] border-r border-white/10 p-4 backdrop-blur-xl',
                isAgentfinderTheme ? 'bg-[#f8fbff]/98 text-slate-950' : 'bg-[#101113]/98 text-stone-100'
              )}
            >
               <SheetTitle className="sr-only">Meniu navigare</SheetTitle>
               <div className="flex h-full flex-col">
                  <div className={cn('rounded-2xl border border-white/10 p-4', isAgentfinderTheme ? 'border-slate-200/80 bg-white/92' : 'bg-[#18191d]')}>
                     {headerLogoUrl ? (
                        <div className="relative h-12 w-40 px-1">
                          <Image src={headerLogoUrl} alt={agency?.name || 'Logo agentie'} fill className="object-contain" />
                        </div>
                      ) : (
                        <span className={cn('text-2xl font-bold tracking-tight', isAgentfinderTheme ? 'text-slate-950' : 'text-stone-100')}>{agency?.name}</span>
                      )}
                  </div>
                 <nav className="mt-8 flex flex-col gap-2">
                  {agencyId && navLinks.map(link => (
                    <MobileNavLink key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}>
                      {React.cloneElement(link.icon as React.ReactElement, { className: 'h-5 w-5' })}
                      {link.label}
                    </MobileNavLink>
                  ))}
                </nav>
               </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
