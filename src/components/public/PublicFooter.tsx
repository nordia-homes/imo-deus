'use client';

import { Copyright } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function PublicFooter() {
    const pathname = usePathname();
    const isPropertyDetailPage = /^\/agencies\/[^/]+\/properties\/[^/]+$/.test(pathname);

    return (
        <footer className={`${isPropertyDetailPage ? 'hidden md:block' : 'block'} border-t border-emerald-400/12 bg-[linear-gradient(180deg,rgba(6,8,8,0.96)_0%,rgba(9,12,11,0.98)_100%)]`}>
            <div className="container mx-auto px-4 pb-5 pt-3 md:py-5">
                <div className="flex items-center justify-center gap-2 rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-center shadow-[0_20px_60px_-42px_rgba(0,0,0,0.72)]">
                    <Copyright className="h-4 w-4 text-emerald-300/85" />
                    <p className="text-sm font-medium text-white/90">2026 drepturi rezervate Nordia Homes</p>
                </div>
            </div>
        </footer>
    );
}
