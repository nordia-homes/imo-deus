import type { Agency } from '@/lib/types';
import Link from 'next/link';

export function PublicFooter({ agency }: { agency: Agency | null }) {
    return (
        <footer className="bg-muted border-t">
            <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col items-center justify-between sm:flex-row gap-4">
                    <p className="text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} {agency?.name || 'Agenție Imobiliară'}. Toate drepturile rezervate.
                    </p>
                    <p className="text-xs text-muted-foreground/50">
                        Powered by EstateFlow
                    </p>
                </div>
            </div>
        </footer>
    );
}
