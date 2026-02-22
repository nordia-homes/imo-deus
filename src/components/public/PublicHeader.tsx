'use client';
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetClose } from "@/components/ui/sheet";
import { Menu, Home, Building2, Phone } from "lucide-react";
import Link from "next/link";
import type { Agency } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";
import { ImoDeusTextLogo } from '../icons/ImoDeusTextLogo';

const navLinks = [
    { href: '/', label: 'Acasă', icon: Home },
    { href: '/properties', label: 'Proprietăți', icon: Building2 },
    { href: '/about', label: 'Despre Noi', icon: Home },
    { href: '/contact', label: 'Contact', icon: Phone },
];

export function PublicHeader({ agency, isLoading }: { agency: Agency | null, isLoading: boolean }) {
    
    if (isLoading) {
        return (
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-14 items-center">
                    <Skeleton className="h-8 w-32" />
                    <div className="flex flex-1 items-center justify-end space-x-4">
                        <Skeleton className="h-8 w-24" />
                        <Skeleton className="h-8 w-24" />
                    </div>
                </div>
          </header>
        )
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#0F1E33]/95 backdrop-blur supports-[backdrop-filter]:bg-[#0F1E33]/60 animated-glow">
            <div className="container flex h-20 items-center">
                <div className="flex-1">
                    <Link href={agency ? `/agencies/${agency.id}`: '#'} className="flex items-center gap-2 text-xl font-bold">
                        <ImoDeusTextLogo className="w-60" />
                    </Link>
                </div>
                
                <nav className="hidden flex-1 items-center justify-end space-x-2 md:flex">
                    {navLinks.map(link => (
                        <Button key={link.label} variant="ghost" asChild className="text-white hover:bg-white/10">
                            <Link href={agency ? `/agencies/${agency.id}${link.href.replace('/', '')}` : '#'}>
                                {link.label}
                            </Link>
                        </Button>
                    ))}
                </nav>

                <div className="md:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                                <Menu />
                                <span className="sr-only">Open menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="bg-[#0F1E33] text-white border-l-white/10">
                            <nav className="flex flex-col gap-4 mt-8">
                                {navLinks.map(link => (
                                    <SheetClose key={link.label} asChild>
                                        <Link href={agency ? `/agencies/${agency.id}${link.href.replace('/', '')}` : '#'} className="flex items-center gap-3 rounded-lg p-3 text-lg font-medium hover:bg-white/10">
                                            <link.icon className="h-5 w-5" />
                                            {link.label}
                                        </Link>
                                    </SheetClose>
                                ))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    );
}
