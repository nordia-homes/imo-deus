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
        <Link href={href} className={cn("flex items-center gap-4 rounded-2xl p-4 text-lg font-medium transition-colors", isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")} onClick={onClick}>
          {children}
        </Link>
      </SheetClose>
    );
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/80 text-slate-900 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <Link href={`/agencies/${agencyId}`} className="flex items-center gap-2">
          {isLoading ? <Skeleton className="h-10 w-40" /> : (
            agency?.logoUrl ? (
              <div className="relative h-12 w-40 md:w-60">
                 <Image src={agency.logoUrl} alt={agency.name} fill className="object-contain" />
              </div>
            ) : (
               <span className="text-xl font-bold tracking-tight text-slate-900">{agency?.name || 'Agenție Imobiliară'}</span>
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
                  isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
              <Button variant="ghost" size="icon" className="rounded-full text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                <ModernMenuIcon className="h-7 w-7" />
                <span className="sr-only">Deschide meniu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80vw] border-r border-slate-200 bg-white/95 p-4 text-slate-900 backdrop-blur-xl">
               <div className="flex flex-col h-full">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                     {agency?.logoUrl ? (
                        <div className="relative h-12 w-40">
                          <Image src={agency.logoUrl} alt={agency.name} fill className="object-contain" />
                        </div>
                      ) : (
                        <span className="text-2xl font-bold tracking-tight">{agency?.name}</span>
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
