import type { Agency } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import Image from 'next/image';

export function PublicHeader({ agency }: { agency: Agency | null }) {
  if (!agency) {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center px-4 sm:px-6 lg:px-8">
                <p className="font-semibold">Agenție Indisponibilă</p>
            </div>
        </header>
    );
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/agencies/${agency.id}`} className="flex items-center gap-3">
          {agency.logoUrl ? (
            <Image src={agency.logoUrl} alt={`${agency.name} logo`} width={32} height={32} className="h-8 w-auto" />
          ) : (
            <div className="h-8 w-8 bg-primary rounded-md"></div>
          )}
          <span className="font-bold text-lg hidden sm:inline">{agency.name}</span>
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
           <Link href={`/agencies/${agency.id}/contact`}>Contact Rapid</Link>
        </Button>
      </div>
    </header>
  );
}
