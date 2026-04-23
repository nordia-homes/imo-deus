'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { doc } from 'firebase/firestore';
import {
  Building2,
  CalendarCheck,
  Check,
  Palette,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { updateDocumentNonBlocking, useFirestore } from '@/firebase';
import { THEME_PRESET_OPTIONS, applyAgencyThemeToRoot, resolveThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { ThemePreset } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const navItems = [
  { href: '/viewings', label: 'Vizionari', icon: CalendarCheck },
  { href: '/leads', label: 'Cumparatori', icon: Users },
  { href: '/properties', label: 'Proprietati', icon: Building2 },
];

const themeVisuals: Record<
  ThemePreset,
  {
    colorName: string;
    swatch: string;
    swatchBorder: string;
  }
> = {
  classic: {
    colorName: 'Albastru inchis',
    swatch: '#0F1E33',
    swatchBorder: 'rgba(15, 30, 51, 0.38)',
  },
  forest: {
    colorName: 'Verde regal',
    swatch: '#235347',
    swatchBorder: 'rgba(35, 83, 71, 0.38)',
  },
  agentfinder: {
    colorName: 'Alb light',
    swatch: '#F8FBFF',
    swatchBorder: 'rgba(174, 195, 225, 0.92)',
  },
};

export function BottomNavbar() {
  const pathname = usePathname();
  const firestore = useFirestore();
  const { agency, agencyId } = useAgency();
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const activeTheme = resolveThemePreset(agency?.themePreset);

  const handleThemeSelect = (themePreset: ThemePreset) => {
    if (typeof document !== 'undefined') {
      applyAgencyThemeToRoot(document.documentElement, {
        primaryColor: agency?.primaryColor,
        themePreset,
      });
    }

    if (agencyId) {
      updateDocumentNonBlocking(doc(firestore, 'agencies', agencyId), { themePreset });
    }

    setIsAppearanceOpen(false);
  };

  return (
    <>
      <nav className="agentfinder-bottom-nav fixed bottom-2 left-4 right-4 z-40 h-16 overflow-hidden rounded-2xl border bg-background/80 shadow-2xl backdrop-blur-lg md:hidden">
        <div className="agentfinder-bottom-nav__inner grid h-full grid-cols-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'agentfinder-bottom-nav__item flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50',
                  isActive && 'agentfinder-bottom-nav__item--active text-primary font-semibold'
                )}
              >
                <span className="agentfinder-bottom-nav__icon">
                  <item.icon className="h-5 w-5" />
                </span>
                <span className="agentfinder-bottom-nav__label">{item.label}</span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Deschide setarile de aspect"
            className="agentfinder-bottom-nav__item agentfinder-bottom-nav__aspect flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
            onClick={() => setIsAppearanceOpen(true)}
          >
            <span className="agentfinder-bottom-nav__icon">
              <Palette className="h-5 w-5" />
            </span>
            <span className="agentfinder-bottom-nav__label">Aspect</span>
          </button>
        </div>
      </nav>

      <button
        type="button"
        aria-label="Alege aspectul aplicatiei"
        className="agentfinder-appearance-pulse-launcher fixed bottom-6 right-6 z-40 hidden items-center gap-3 rounded-full border border-[var(--app-sidebar-border)] bg-[var(--app-topbar-bg)] px-4 py-3 text-left text-[var(--app-page-foreground)] shadow-[0_20px_48px_rgba(0,0,0,0.24)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[var(--app-surface-border)] hover:bg-[var(--app-surface-soft)] md:flex"
        onClick={() => setIsAppearanceOpen(true)}
      >
        <span className="agentfinder-appearance-pulse-launcher__pulse" aria-hidden="true">
          <span className="agentfinder-appearance-pulse-launcher__dot" />
        </span>
        <span className="agentfinder-appearance-pulse-launcher__copy">
          <span className="agentfinder-appearance-pulse-launcher__label">Alege aspectul</span>
          <span className="agentfinder-appearance-pulse-launcher__subtle">Schimba tema aplicatiei</span>
        </span>
        <Palette className="h-4 w-4 shrink-0 text-[var(--app-highlight-soft)]" />
      </button>

      <Dialog open={isAppearanceOpen} onOpenChange={setIsAppearanceOpen}>
        <DialogContent className="agentfinder-appearance-dialog w-[calc(100vw-2rem)] max-w-[430px] rounded-[28px] border bg-background p-0">
          <DialogHeader className="agentfinder-appearance-dialog__header">
            <div className="agentfinder-appearance-dialog__badge">
              <Sparkles className="h-4 w-4" />
              Aspect aplicatie
            </div>
            <DialogTitle className="agentfinder-appearance-dialog__title">
              Alege energia vizuala
            </DialogTitle>
            <DialogDescription className="agentfinder-appearance-dialog__description">
              Schimba tema CRM-ului instant, cu o previzualizare fina si salvare automata.
            </DialogDescription>
          </DialogHeader>

          <div className="agentfinder-appearance-dialog__options">
            {THEME_PRESET_OPTIONS.map((theme) => {
              const visual = themeVisuals[theme.value];
              const isActive = activeTheme === theme.value;

              return (
                <button
                  key={theme.value}
                  type="button"
                  className={cn(
                    'agentfinder-appearance-dialog__option',
                    isActive && 'agentfinder-appearance-dialog__option--active'
                  )}
                  onClick={() => handleThemeSelect(theme.value)}
                >
                  <span
                    className="agentfinder-appearance-dialog__swatch"
                    style={{
                      background: visual.swatch,
                      borderColor: visual.swatchBorder,
                    }}
                    aria-hidden="true"
                  />
                  <span className="agentfinder-appearance-dialog__copy">
                    <span className="agentfinder-appearance-dialog__name">{theme.label}</span>
                    <span className="agentfinder-appearance-dialog__accent">{visual.colorName}</span>
                  </span>
                  <span className="agentfinder-appearance-dialog__check" aria-hidden="true">
                    {isActive && <Check className="h-4 w-4" />}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
