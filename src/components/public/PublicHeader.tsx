'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Agency } from '@/lib/types';
import Image from 'next/image';
import { Home } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet';
import { Menu } from 'lucide-react';

type PublicHeaderProps = {
  agency: Agency | null;
  isLoading: boolean;
};

export function PublicHeader({ agency, isLoading }: PublicHeaderProps) {
  const pathname = usePathname();
  const agencyId = agency?.id;

  const navLinks = [
    { href: `/agencies/${agencyId}`, text: 'Acasă' },
    { href: `/agencies/${agencyId}#properties`, text: 'Proprietăți' },
    { href: `/agencies/${agencyId}/about`, text: 'Despre Noi' },
    { href: `/agencies/${agencyId}/contact`, text: 'Contact' },
  ];

  const renderLogo = () => {
    if (isLoading) {
      return <Skeleton className="h-10 w-48" />;
    }
    if (agency) {
      return (
        <Link href={`/agencies/${agency.id}`} className="flex items-center gap-2">
          {agency.logoUrl ? (
            <Image src={agency.logoUrl} alt={`${agency.name} Logo`} width={40} height={40} className="h-10 w-auto object-contain" />
          ) : (
            <Home className="h-8 w-8 text-primary" />
          )}
          <span className="text-xl font-bold">{agency.name}</span>
        </Link>
      );
    }
    return null;
  };
  
  const renderNav = (isMobile = false) => {
      if(isLoading || !agencyId) {
          return <div className="flex gap-4"><Skeleton className="h-6 w-20" /><Skeleton className="h-6 w-20" /></div>
      }

      return (
          <nav className={cn("items-center gap-6 text-sm font-medium", isMobile ? "flex flex-col gap-4 mt-8" : "hidden md:flex")}>
              {navLinks.map(link => {
                  const isActive = pathname === link.href;
                  return (
                    <Link key={link.text} href={link.href} className={cn("text-muted-foreground transition-colors hover:text-foreground", isActive && "text-primary font-semibold", isMobile && "text-lg")}>
                        {link.text}
                    </Link>
                  )
              })}
          </nav>
      )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {renderLogo()}
        {renderNav()}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            {renderNav(true)}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
