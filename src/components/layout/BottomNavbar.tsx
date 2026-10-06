'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { executeCrmAction } from '@/lib/crm/client-actions';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  CalendarCheck,
  Check,
  Inbox,
  Handshake,
  Palette,
  PhoneCall,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
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
  { href: '/inbox', label: 'Storia', icon: Inbox },
  { href: '/properties', label: 'Proprietati', icon: Building2 },
  { href: '/sales-management', label: 'Vanzari', icon: Handshake },
  { href: '/collaboration', label: 'Colaborari', icon: Handshake },
  { href: '/ai-calls', label: 'Apeluri AI', icon: PhoneCall },
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
  const currentPath = pathname ?? '';
  const { agency, user, userProfile } = useAgency();
  const { toast } = useToast();
  const [savingTheme, setSavingTheme] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const activeTheme = resolveThemePreset(agency?.themePreset);

  const handleThemeSelect = async (themePreset: ThemePreset) => {
    setSavingTheme(true);
    try {
      await executeCrmAction(user, { kind: 'update_agency', expectedUpdatedAt: agency?.updatedAt || null, patch: { themePreset } });
      if (typeof document !== 'undefined') {
        applyAgencyThemeToRoot(document.documentElement, {
          primaryColor: agency?.primaryColor,
          themePreset,
        });
      }
      setIsAppearanceOpen(false);
    } catch (error) {
      toast({ title: 'Tema nu a fost salvată', description: error instanceof Error ? error.message : 'Reîncearcă.', variant: 'destructive' });
    } finally { setSavingTheme(false); }
  };

  return (
    <>
      {currentPath !== '/inbox' && <nav className="agentfinder-bottom-nav fixed bottom-2 left-4 right-4 z-40 h-16 overflow-hidden rounded-2xl border bg-background/80 shadow-2xl backdrop-blur-lg md:hidden">
        <div className="agentfinder-bottom-nav__inner grid h-full grid-cols-8">
          {navItems.map((item) => {
            const isActive = currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  'agentfinder-bottom-nav__item flex items-center justify-center text-muted-foreground transition-colors hover:bg-accent/50',
                  isActive && 'agentfinder-bottom-nav__item--active text-primary font-semibold'
                )}
              >
                <span className="agentfinder-bottom-nav__icon">
                  <item.icon className="h-5 w-5" />
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            aria-label="Deschide setarile de aspect"
            title="Aspect"
            className="agentfinder-bottom-nav__item agentfinder-bottom-nav__aspect flex items-center justify-center text-muted-foreground transition-colors hover:bg-accent/50"
            onClick={() => setIsAppearanceOpen(true)}
          >
            <span className="agentfinder-bottom-nav__icon">
              <Palette className="h-5 w-5" />
            </span>
          </button>
        </div>
      </nav>}

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
              {userProfile?.role === 'admin' ? 'Tema se aplică agenției după salvare.' : 'Tema agenției poate fi schimbată de administrator.'}
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
                  disabled={savingTheme || userProfile?.role !== 'admin'}
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
