'use client';

import Link from "next/link";
import { Button } from "../ui/button";
import type { Agency } from "@/lib/types";
import { Building2, Globe, Menu, Users, Phone } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { Skeleton } from "../ui/skeleton";
import { cn } from "@/lib/utils";
import { usePathname } from "next/navigation";
import Image from 'next/image';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface PublicHeaderProps {
  agency: Agency | null;
  isLoading: boolean;
}

export function PublicHeader({ agency, isLoading }: PublicHeaderProps) {
    const pathname = usePathname();

    const navLinks = [
        { href: `/agencies/${agency?.id}`, label: 'Acasă', icon: Globe },
        { href: `/agencies/${agency?.id}/properties`, label: 'Proprietăți', icon: Building2 },
        { href: `/agencies/${agency?.id}/about`, label: 'Despre Noi', icon: Users },
        { href: `/agencies/${agency?.id}/contact`, label: 'Contact', icon: Phone },
    ];
    
    if (isLoading) {
        return (
             <header className="sticky top-0 z-40 w-full bg-[#0F1E33] text-white shadow-md animated-glow">
                <div className="container mx-auto flex h-20 items-center justify-between px-4">
                    <Skeleton className="h-10 w-40 bg-white/20" />
                    <div className="hidden items-center gap-2 md:flex">
                        <Skeleton className="h-9 w-24 bg-white/20" />
                        <Skeleton className="h-9 w-24 bg-white/20" />
                        <Skeleton className="h-9 w-24 bg-white/20" />
                    </div>
                    <Skeleton className="h-9 w-9 md:hidden bg-white/20" />
                </div>
            </header>
        )
    }

    return (
        <header className="sticky top-0 z-40 w-full bg-[#0F1E33] text-white shadow-md animated-glow">
            <div className="container mx-auto flex h-20 items-center justify-between px-4">
                <Link href={`/agencies/${agency?.id}`} className="flex items-center gap-2">
                    {agency?.logoUrl ? (
                        <div className="relative h-14 w-48">
                             <Image
                                src={agency.logoUrl}
                                alt={`${agency.name} logo`}
                                fill
                                style={{ objectFit: 'contain' }}
                                priority
                            />
                        </div>
                    ) : (
                        <span className="text-2xl font-bold">{agency?.name || ''}</span>
                    )}
                </Link>
                
                <nav className="hidden items-center gap-1 md:flex">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href;
                        return (
                            <Button key={link.label} asChild variant="ghost" className={cn("hover:bg-white/10", isActive && "bg-white/10 font-bold")}>
                                <Link href={link.href}>
                                     {link.label}
                                </Link>
                            </Button>
                        )
                    })}
                </nav>

                <div className="md:hidden">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-white/10">
                                <Menu />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 bg-[#0F1E33] text-white border-r-white/20">
                             <nav className="flex flex-col gap-4 pt-8">
                                {navLinks.map((link) => (
                                    <Button key={link.label} asChild variant="ghost" className="justify-start text-lg h-12 hover:bg-white/10">
                                         <Link href={link.href}>
                                            <link.icon className="mr-3 h-5 w-5" />
                                            {link.label}
                                        </Link>
                                    </Button>
                                ))}
                            </nav>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </header>
    )
}