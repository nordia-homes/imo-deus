
'use client';
import type { Agency } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";

interface PublicFooterProps {
    agency: Agency | null;
    isLoading?: boolean;
}

export function PublicFooter({ agency, isLoading }: PublicFooterProps) {

    if (isLoading) {
        return (
            <footer className="border-t bg-muted/40">
                <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col items-center justify-center">
                        <Skeleton className="h-4 w-64" />
                    </div>
                </div>
            </footer>
        )
    }

    return (
        <footer className="border-t bg-muted/40">
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

