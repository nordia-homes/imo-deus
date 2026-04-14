'use client';

import Link from 'next/link';
import { Copyright } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';

export function PublicFooter() {
    const pathname = usePathname();
    const displayPath = pathname.replace(/^\/__public\/[^/]+/, '') || '/';
    const isPropertyDetailPage = /^\/(?:agencies\/[^/]+\/)?properties\/[^/]+$/.test(displayPath);
    const { agencyId } = usePublicAgency();
    const publicPath = usePublicPath();

    return (
        <footer className={`${isPropertyDetailPage ? 'hidden md:block' : 'block'} border-t border-[var(--public-card-border)] bg-[var(--public-footer-bg)]`}>
            <div className="container mx-auto px-4 pb-5 pt-3 md:py-5">
                <div className="flex flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-white/8 bg-white/[0.03] px-4 py-4 text-center shadow-[0_20px_60px_-42px_rgba(0,0,0,0.72)] md:flex-row md:gap-3">
                    <Copyright className="h-4 w-4 text-[var(--public-accent-soft)]" />
                    <p className="text-sm font-medium text-white/90">2026 drepturi rezervate Nordia Homes</p>
                    {agencyId ? (
                      <div className="flex items-center gap-2 text-sm text-white/65">
                        <Link
                          href={publicPath('/termeni-si-conditii')}
                          className="transition-colors hover:text-[var(--public-accent-soft)]"
                        >
                          Termeni si conditii
                        </Link>
                        <span className="text-[var(--public-accent)] opacity-60">•</span>
                        <Link
                          href={publicPath('/confidentialitate')}
                          className="transition-colors hover:text-[var(--public-accent-soft)]"
                        >
                          Confidentialitate
                        </Link>
                      </div>
                    ) : null}
                </div>
            </div>
        </footer>
    );
}
