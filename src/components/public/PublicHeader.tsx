'use client';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";
import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Agency } from "@/lib/types";
import Image from "next/image";
import { ModernMenuIcon } from "../icons/ModernMenuIcon";

export function PublicHeader({ agency, isLoading }: { agency: Agency | null, isLoading: boolean }) {
  const pathname = usePathname();

  const navLinks = [
    { href: `/agencies/${agency?.id}`, label: 'Acasă' },
    { href: `/agencies/${agency?.id}/properties`, label: 'Proprietăți' },
    { href: `/agencies/${agency?.id}/about`, label: 'Despre Noi' },
    { href: `/agencies/${agency?.id}/contact`, label: 'Contact' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F1E33] animated-glow">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        {/* Logo */}
        <Link href={`/agencies/${agency?.id}`} className="flex items-center gap-2">
            {agency?.logoUrl ? (
                <Image src={agency.logoUrl} alt={agency.name} width={240} height={65} className="w-60 h-auto" />
            ) : (
                <span className="text-xl font-bold text-white">{agency?.name}</span>
            )}
        </Link>
        
        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium transition-colors hover:text-primary",
                pathname === link.href ? "text-primary" : "text-white/80"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        
        {/* Mobile Menu Button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/10">
              <ModernMenuIcon className="h-6 w-6" />
              <span className="sr-only">Deschide meniul</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-[#0F1E33] text-white p-0 border-r border-white/10 w-3/4">
            <div className="p-6">
                <Link href={`/agencies/${agency?.id}`} className="flex items-center gap-2 mb-8">
                     {agency?.logoUrl ? (
                        <Image src={agency.logoUrl} alt={agency.name} width={240} height={65} className="w-48 h-auto" />
                    ) : (
                        <span className="text-xl font-bold text-white">{agency?.name}</span>
                    )}
                </Link>
                <nav className="flex flex-col gap-4">
                    {navLinks.map((link) => (
                        <SheetClose asChild key={link.href}>
                             <Link
                                href={link.href}
                                className={cn(
                                    "text-lg font-medium transition-colors hover:text-primary p-2 rounded-md",
                                    pathname === link.href ? "text-primary bg-white/5" : "text-white/80"
                                )}
                                >
                                {link.label}
                            </Link>
                        </SheetClose>
                    ))}
                </nav>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
