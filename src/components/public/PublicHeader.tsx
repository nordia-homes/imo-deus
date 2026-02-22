'use client';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Home, Menu, Phone, Users, Building } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "../ui/skeleton";
import type { Agency } from "@/lib/types";
import { ImoDeusTextLogo } from "../icons/ImoDeusTextLogo";
import { usePathname } from 'next/navigation';
import { cn } from "@/lib/utils";


export function PublicHeader({ agency, isLoading }: { agency: Agency | null, isLoading: boolean }) {
    const pathname = usePathname();

    const navLinks = agency ? [
        { href: `/agencies/${agency.id}`, text: 'Acasă', icon: <Home className="h-5 w-5" /> },
        { href: `/agencies/${agency.id}/properties`, text: 'Proprietăți', icon: <Building className="h-5 w-5" /> },
        { href: `/agencies/${agency.id}/about`, text: 'Despre Noi', icon: <Users className="h-5 w-5" /> },
        { href: `/agencies/${agency.id}/contact`, text: 'Contact', icon: <Phone className="h-5 w-5" /> },
    ] : [];

    const brandLogo = (
        <Link href={agency ? `/agencies/${agency.id}`: '#'} className="flex items-center gap-2">
            {agency?.logoUrl ? (
                <img src={agency.logoUrl} alt={agency.name} className="h-8 w-auto" />
            ) : (
                <ImoDeusTextLogo className="w-36" />
            )}
        </Link>
    );

    if (isLoading) {
        return (
            <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#0F1E33] px-4 md:px-6">
                <Skeleton className="h-8 w-36 bg-white/10" />
                <Skeleton className="h-8 w-8 md:hidden bg-white/10" />
                <div className="hidden items-center gap-6 md:flex">
                    <Skeleton className="h-6 w-20 bg-white/10" />
                    <Skeleton className="h-6 w-20 bg-white/10" />
                    <Skeleton className="h-6 w-20 bg-white/10" />
                </div>
            </header>
        );
    }
    
    return (
        <header className="sticky top-0 z-50 flex h-20 items-center justify-between border-b border-white/10 bg-[#0F1E33] px-4 shadow-lg md:px-6 text-white animated-glow">
            {brandLogo}
            <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
                {navLinks.map(link => (
                     <Link
                        key={link.href}
                        href={link.href}
                        className={cn("transition-colors hover:text-primary", pathname === link.href ? "text-primary font-semibold" : "text-white/80")}
                    >
                        {link.text}
                    </Link>
                ))}
            </nav>
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="shrink-0 md:hidden bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="bg-[#0F1E33] border-r-white/10 text-white">
                    <nav className="grid gap-6 text-lg font-medium">
                        <div className="mb-4">
                           {brandLogo}
                        </div>
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn("flex items-center gap-4 px-2.5", pathname === link.href ? "text-primary" : "text-white/80 hover:text-white")}
                            >
                                {link.icon}
                                {link.text}
                            </Link>
                        ))}
                    </nav>
                </SheetContent>
            </Sheet>
        </header>
    );
}
