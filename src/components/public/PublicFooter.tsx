'use client';

import Link from 'next/link';
import { Copyright } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function PublicFooter() {
    const pathname = usePathname();
    const displayPath = pathname.replace(/^\/__public\/[^/]+/, '') || '/';
    const isPropertyDetailPage = /^\/(?:agencies\/[^/]+\/)?properties\/[^/]+$/.test(displayPath);
    const { agencyId, agency } = usePublicAgency();
    const publicPath = usePublicPath();
    const isClassicTheme = getAgencyThemePreset(agency) === 'classic';

    return (
        <footer
            className={cn(
                isPropertyDetailPage ? 'hidden md:block' : 'block',
                isClassicTheme
                    ? 'border-t border-emerald-300/10 bg-[linear-gradient(180deg,rgba(6,8,8,0.98)_0%,rgba(9,12,11,1)_100%)]'
                    : 'border-t border-[var(--public-card-border)] bg-[var(--public-footer-bg)]'
            )}
        >
            <div className="container mx-auto px-4 pb-5 pt-3 md:py-5">
                <div
                    className={cn(
                        'flex flex-col items-center justify-center gap-2 rounded-[1.5rem] px-4 py-4 text-center shadow-[0_20px_60px_-42px_rgba(0,0,0,0.72)] md:flex-row md:gap-3',
                        isClassicTheme
                            ? 'border border-emerald-300/10 bg-emerald-400/[0.04]'
                            : 'border border-white/8 bg-white/[0.03]'
                    )}
                >
                    <Copyright className={cn('h-4 w-4', isClassicTheme ? 'text-emerald-300' : 'text-[var(--public-accent-soft)]')} />
                    <p className={cn('text-sm font-medium', isClassicTheme ? 'text-stone-100' : 'text-white/90')}>
                        2026 drepturi rezervate Nordia Homes
                    </p>
                    {agencyId ? (
                        <div className={cn('flex items-center gap-2 text-sm', isClassicTheme ? 'text-stone-300' : 'text-white/65')}>
                            <Link
                                href={publicPath('/termeni-si-conditii')}
                                className={cn('transition-colors', isClassicTheme ? 'hover:text-emerald-300' : 'hover:text-[var(--public-accent-soft)]')}
                            >
                                Termeni si conditii
                            </Link>
                            <span className={cn(isClassicTheme ? 'text-emerald-400/70' : 'text-[var(--public-accent)] opacity-60')}>•</span>
                            <Link
                                href={publicPath('/confidentialitate')}
                                className={cn('transition-colors', isClassicTheme ? 'hover:text-emerald-300' : 'hover:text-[var(--public-accent-soft)]')}
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
