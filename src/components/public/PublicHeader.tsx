'use client';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import type { Agency } from '@/lib/types';
import Image from 'next/image';

export function PublicHeader({ agency }: { agency: Agency | null }) {
  if (!agency) return null;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/agencies/${agency.id}`} className="flex items-center gap-2">
          {agency.logoUrl ? (
            <Image src={agency.logoUrl} alt={`${agency.name} Logo`} width={32} height={32} className="h-8 w-auto object-contain" />
          ) : (
            <Home className="h-6 w-6 text-primary" />
          )}
          <span className="font-bold text-lg">{agency.name}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link href={`/agencies/${agency.id}/properties`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Proprietăți
          </Link>
          <Link href={`/agencies/${agency.id}/contact`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Contact
          </Link>
        </nav>
        <Button asChild>
          <Link href="/login">Portal Agenți</Link>
        </Button>
      </div>
    </header>
  );
}
