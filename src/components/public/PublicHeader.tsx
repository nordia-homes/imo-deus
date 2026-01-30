
'use client';
import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { Home } from "lucide-react";
import type { Agency } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";

interface PublicHeaderProps {
    agency: Agency | null;
    isLoading?: boolean;
}

export function PublicHeader({ agency, isLoading }: PublicHeaderProps) {

    const agencyId = agency?.id;

    if (isLoading) {
        return (
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                    <div className="hidden items-center gap-6 md:flex">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-20" />
                    </div>
                </div>
            </header>
        )
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href={agencyId ? `/agencies/${agencyId}` : '/'} className="flex items-center gap-2">
                    {agency?.logoUrl ? (
                        <Image src={agency.logoUrl} alt={`${agency.name} Logo`} width={32} height={32} className="h-8 w-8 object-contain rounded-full" />
                    ) : (
                        <Home className="h-6 w-6 text-primary" />
                    )}
                    <span className="font-bold text-lg">{agency?.name || 'EstateFlow'}</span>
                </Link>
                <nav className="hidden items-center gap-6 md:flex">
                    <Link href={agencyId ? `/agencies/${agencyId}/properties` : '#'} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        Proprietăți
                    </Link>
                     <Link href={agencyId ? `/agencies/${agencyId}/contact` : '#'} className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        Contact
                    </Link>
                </nav>
            </div>
        </header>
    );
}
