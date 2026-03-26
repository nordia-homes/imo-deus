'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Home, Building2, Info, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Agency } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { ModernMenuIcon } from '../icons/ModernMenuIcon';

interface PublicHeaderProps {
  agency: Agency | null;
  isLoading: boolean;
}

export function PublicHeader({ agency, isLoading }: PublicHeaderProps) {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const agencyId = agency?.id;

  const navLinks = [
    { href: `/agencies/${agencyId}`, label: 'Acasă', icon: <Home /> },
    { href: `/agencies/${agencyId}/properties`, label: 'Proprietăți', icon: <Building2 /> },
    { href: `/agencies/${agencyId}/about`, label: 'Despre Noi', icon: <Info /> },
    { href: `/agencies/${agencyId}/contact`, label: 'Contact', icon: <Mail /> },
  ];

  const MobileNavLink = ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void; }) => {
    const isActive = pathname === href;
    return (
      <SheetClose asChild>
        <Link href={href} className={cn("flex items-center gap-4 rounded-2xl p-4 text-lg font-medium transition-colors", isActive ? "bg-white/10 text-white" : "text-stone-300 hover:bg-white/5 hover:text-white")} onClick={onClick}>
          {children}
        </Link>
      </SheetClose>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#101113]/95 text-stone-100 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.82)] backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:h-20">
        <Link href={`/agencies/${agencyId}`} className="flex min-w-0 items-center gap-2">
          {isLoading ? <Skeleton className="h-10 w-40" /> : (
            agency?.logoUrl ? (
              <div className="relative h-9 w-28 rounded-xl bg-[#18191d] px-1 md:h-12 md:w-60">
                 <Image src={agency.logoUrl} alt={agency.name} fill className="object-contain" />
              </div>
            ) : (
               <span className="truncate text-base font-semibold tracking-[0.02em] text-stone-100 md:text-xl">{agency?.name || 'Agentie Imobiliara'}</span>
            )
          )}
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {agencyId && navLinks.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-white/10 text-white' : 'text-stone-300 hover:bg-white/5 hover:text-white'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-white/10 bg-[#18191d] text-stone-200 hover:bg-[#202126] hover:text-white">
                <ModernMenuIcon className="h-7 w-7" />
                <span className="sr-only">Deschide meniu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80vw] border-r border-white/10 bg-[#101113]/98 p-4 text-stone-100 backdrop-blur-xl">
               <div className="flex flex-col h-full">
                  <div className="rounded-2xl border border-white/10 bg-[#18191d] p-4">
                     {agency?.logoUrl ? (
                        <div className="relative h-12 w-40 rounded-xl bg-[#111214] px-1">
                          <Image src={agency.logoUrl} alt={agency.name} fill className="object-contain" />
                        </div>
                      ) : (
                        <span className="text-2xl font-bold tracking-tight text-stone-100">{agency?.name}</span>
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
