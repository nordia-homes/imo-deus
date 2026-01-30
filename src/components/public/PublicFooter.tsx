'use client';

import type { Agency } from "@/lib/types";

export function PublicFooter({ agency }: { agency: Agency | null }) {
    return (
        <footer className="border-t">
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-center">
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} {agency?.name || 'EstateFlow'}. Toate drepturile rezervate.
                    </p>
                </div>
            </div>
        </footer>
    );
}
