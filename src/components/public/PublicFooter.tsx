'use client';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Skeleton } from '../ui/skeleton';
import type { Agency } from '@/lib/types';
import { Facebook, Instagram, Linkedin } from 'lucide-react';

const SocialButton = ({ href, children }: { href?: string; children: React.ReactNode }) => {
  if (!href) return null;
  return (
    <Button asChild variant="ghost" size="icon">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
};

export function PublicFooter({ agency, isLoading }: { agency: Agency | null, isLoading: boolean }) {
  if (isLoading) {
      return (
           <footer className="border-t bg-background">
            <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="space-y-4 col-span-1 md:col-span-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
                    <div className="space-y-4"><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-24" /></div>
                    <div className="space-y-4"><Skeleton className="h-6 w-32" /><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-24" /></div>
                </div>
                <div className="mt-12 border-t pt-8 flex flex-col sm:flex-row justify-between items-center">
                    <Skeleton className="h-4 w-64" />
                    <div className="flex gap-2 mt-4 sm:mt-0"><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-8 w-8 rounded-full" /><Skeleton className="h-8 w-8 rounded-full" /></div>
                </div>
            </div>
        </footer>
      )
  }

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-4 lg:col-span-5">
            <Link href={`/agencies/${agency?.id}`} className="flex items-center gap-3 mb-4">
                 {agency?.logoUrl ? (
                    <Image src={agency.logoUrl} alt={`${agency.name} Logo`} width={40} height={40} className="h-10 w-auto" />
                ) : (
                    <div className="h-10 w-10 bg-muted rounded-full"/>
                )}
                 <span className="font-bold text-xl">{agency?.name || 'Agenție Imobiliară'}</span>
            </Link>
            <p className="text-muted-foreground text-sm">
              Partenerul tău de încredere în imobiliare. Găsim împreună casa visurilor tale.
            </p>
          </div>
          <div className="md:col-span-8 lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Navigare</h3>
              <ul className="mt-4 space-y-2">
                <li><Link href={`/agencies/${agency?.id}`} className="text-sm text-muted-foreground hover:text-primary">Acasă</Link></li>
                <li><Link href={`/agencies/${agency?.id}#properties`} className="text-sm text-muted-foreground hover:text-primary">Proprietăți</Link></li>
                <li><Link href={`/agencies/${agency?.id}/contact`} className="text-sm text-muted-foreground hover:text-primary">Contact</Link></li>
              </ul>
            </div>
             <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Contact</h3>
              <ul className="mt-4 space-y-2">
                {agency?.email && <li><a href={`mailto:${agency.email}`} className="text-sm text-muted-foreground hover:text-primary">{agency.email}</a></li>}
                {agency?.phone && <li><a href={`tel:${agency.phone}`} className="text-sm text-muted-foreground hover:text-primary">{agency.phone}</a></li>}
                {agency?.address && <li className="text-sm text-muted-foreground">{agency.address}</li>}
              </ul>
            </div>
             <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">Urmărește-ne</h3>
               <div className="flex -ml-2 mt-3">
                    <SocialButton href={agency?.facebookUrl}><Facebook /></SocialButton>
                    <SocialButton href={agency?.instagramUrl}><Instagram /></SocialButton>
                    <SocialButton href={agency?.linkedinUrl}><Linkedin /></SocialButton>
                </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {agency?.name || 'EstateFlow'}. Toate drepturile rezervate.</p>
        </div>
      </div>
    </footer>
  );
}

    