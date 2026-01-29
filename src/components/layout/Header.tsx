
'use client';

import Link from "next/link";
import { Button } from "../ui/button";
import { Home } from "lucide-react";

export function Header() {
    return (
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-2">
                    <Home className="h-6 w-6 text-primary" />
                    <span className="font-bold text-lg">Dream Homes</span>
                </Link>
                <nav className="hidden items-center gap-6 md:flex">
                    <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        For Sale
                    </Link>
                     <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        About Us
                    </Link>
                     <Link href="#" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                        Contact
                    </Link>
                </nav>
                <Button>
                    List Your Property
                </Button>
            </div>
        </header>
    );
}
