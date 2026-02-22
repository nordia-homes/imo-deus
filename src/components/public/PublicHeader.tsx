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
        <Link href={href} className={cn("flex items-center gap-4 p-4 rounded-lg text-lg font-medium", isActive ? "bg-primary/10 text-primary" : "text-white/80 hover:bg-white/10")} onClick={onClick}>
          {children}
        </Link>
      </SheetClose>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0F1E33] text-white animated-glow">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        <Link href={`/agencies/${agencyId}`} className="flex items-center gap-2">
          {isLoading ? <Skeleton className="h-10 w-40" /> : (
            agency?.logoUrl ? (
              <div className="relative h-12 w-40 md:w-60">
                 <Image src={agency.logoUrl} alt={agency.name} fill className="object-contain" />
              </div>
            ) : (
               <span className="text-xl font-bold">{agency?.name || 'Agenție Imobiliară'}</span>
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
                  'text-sm font-medium transition-colors hover:text-primary',
                  isActive ? 'text-primary' : 'text-white/80'
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
              <Button variant="ghost" size="icon" className="text-white">
                <ModernMenuIcon className="h-7 w-7" />
                <span className="sr-only">Deschide meniu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[80vw] bg-[#0F1E33] p-4 text-white border-r-white/20">
               <div className="flex flex-col h-full">
                  <div className="p-4">
                     {agency?.logoUrl ? (
                        <div className="relative h-12 w-40">
                          <Image src={agency.logoUrl} alt={agency.name} fill className="object-contain" />
                        </div>
                      ) : (
                        <span className="text-2xl font-bold">{agency?.name}</span>
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
