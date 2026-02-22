'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Building2, Home, Mail } from 'lucide-react';
import type { Agency } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ModernMenuIcon } from '../icons/ModernMenuIcon';
import Image from 'next/image';


const NavLink = ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
  <Button variant="ghost" asChild className="text-white/80 hover:bg-white/10 hover:text-white transition-colors duration-200">
    <Link href={href} onClick={onClick}>{children}</Link>
  </Button>
);

const MobileNavLink = ({ href, children, onClick }: { href: string; children: React.ReactNode; onClick?: () => void }) => (
  <SheetClose asChild>
    <Link href={href} onClick={onClick} className="flex items-center gap-4 px-4 py-3 text-lg font-medium text-white/80 hover:bg-white/10 rounded-lg">
      {children}
    </Link>
  </SheetClose>
);


export function PublicHeader({ agency, isLoading }: { agency: Agency | null, isLoading: boolean }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const agencyLogo = agency?.logoUrl;
  const agencyName = agency?.name || 'ImoDeus';
  const agencyId = agency?.id;

  const navLinks = [
    { href: `/agencies/${agencyId}`, label: 'Acasă', icon: <Home /> },
    { href: `/agencies/${agencyId}/properties`, label: 'Proprietăți', icon: <Building2 /> },
    { href: `/agencies/${agencyId}/about`, label: 'Despre Noi', icon: <Building2 /> },
    { href: `/agencies/${agencyId}/contact`, label: 'Contact', icon: <Mail /> },
  ];

  const Logo = () => {
    if (isLoading) {
      return <Skeleton className="h-8 w-32" />;
    }
    if (agencyLogo) {
      return (
        <Image
          src={agencyLogo}
          alt={`${agencyName} Logo`}
          width={240}
          height={68}
          className="w-40 md:w-60 h-auto"
          priority
        />
      );
    }
    return (
      <span className="text-2xl font-bold">{agencyName}</span>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0F1E33] animated-glow border-b border-white/10">
      <div className="container mx-auto px-4">
        <div className="flex h-20 items-center justify-between">
          <Link href={`/agencies/${agencyId}`} className="shrink-0">
             <Logo />
          </Link>

          {/* Desktop Menu */}
          <nav className="hidden md:flex items-center gap-2">
            {agencyId && navLinks.map(link => (
              <NavLink key={link.href} href={link.href}>{link.label}</NavLink>
            ))}
          </nav>

          {/* Mobile Menu */}
          <div className="md:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <ModernMenuIcon className="h-7 w-7" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-[#0F1E33] text-white border-r-white/10 p-0">
                <div className="p-6">
                  <Link href={`/agencies/${agencyId}`} onClick={() => setIsMenuOpen(false)}>
                     <Logo />
                  </Link>
                </div>
                <nav className="flex flex-col gap-2 p-4">
                  {agencyId && navLinks.map(link => (
                    <MobileNavLink key={link.href} href={link.href} onClick={() => setIsMenuOpen(false)}>
                      {React.cloneElement(link.icon, { className: 'h-5 w-5' })}
                      {link.label}
                    </MobileNavLink>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
