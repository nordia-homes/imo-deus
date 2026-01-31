'use client';
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import type { Agency } from "@/lib/types";

export function PublicHeader({ agency, isLoading }: { agency: Agency | null, isLoading: boolean }) {
    
    if (isLoading) {
        return (
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Skeleton className="h-10 w-40" />
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
            </header>
        )
    }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href={`/agencies/${agency?.id}`} className="flex items-center gap-3">
          {agency?.logoUrl ? (
            <Image src={agency.logoUrl} alt={`${agency.name} Logo`} width={40} height={40} className="h-10 w-auto" />
          ) : (
             <div className="h-10 w-10 bg-muted rounded-full"/>
          )}
          <span className="font-bold text-xl hidden sm:inline-block">{agency?.name || 'Agenție Imobiliară'}</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link href={`/agencies/${agency?.id}`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Acasă
          </Link>
          <Link href={`/agencies/${agency?.id}/contact`} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
            Contact
          </Link>
        </nav>
        <Button asChild>
          <Link href="/login">Login Agent</Link>
        </Button>
      </div>
    </header>
  );
}

    