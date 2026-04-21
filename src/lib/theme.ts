import type { CSSProperties } from 'react';
import type { Agency, ThemePreset } from '@/lib/types';

const DEFAULT_CLASSIC_PRIMARY_HEX = '#22c55e';
const DEFAULT_CLASSIC_PRIMARY_HSL = '145 63% 45%';
const FOREST_PRIMARY_HEX = '#8EB69B';
const AGENTFINDER_PRIMARY_HEX = '#445b84';

type ThemeOption = {
  value: ThemePreset;
  label: string;
  description: string;
};

type ThemeVariableMap = Record<`--${string}`, string>;

export const THEME_PRESET_OPTIONS: ThemeOption[] = [
  {
    value: 'classic',
    label: 'Classic',
    description: 'Tema actuala a aplicatiei, pastrata exact asa cum este acum.',
  },
  {
    value: 'forest',
    label: 'Forest',
    description: 'Paleta dark green gradient bazata pe verde inchis, salvie si ivory.',
  },
  {
    value: 'agentfinder',
    label: 'AgentFinder',
    description: 'Tema inspirata din AgentFinder, cu tonuri slate blue, accent violet si titluri mai expresive.',
  },
];

const FOREST_THEME_VARIABLES: ThemeVariableMap = {
  '--background': '172 39% 11%',
  '--foreground': '120 26% 92%',
  '--card': '168 39% 13%',
  '--card-foreground': '120 26% 92%',
  '--popover': '168 39% 13%',
  '--popover-foreground': '120 26% 92%',
  '--secondary': '164 28% 21%',
  '--secondary-foreground': '120 26% 92%',
  '--muted': '164 28% 19%',
  '--muted-foreground': '127 17% 73%',
  '--accent': '161 39% 23%',
  '--accent-foreground': '120 26% 92%',
  '--border': '160 25% 27%',
  '--input': '160 25% 27%',
  '--app-shell-bg': '#0b2b26',
  '--app-shell-bg-gradient': 'linear-gradient(180deg, #0b2b26 0%, #051f20 100%)',
  '--app-topbar-bg': 'rgba(11, 43, 38, 0.94)',
  '--app-sidebar-bg': '#0b2b26',
  '--app-footer-bg': '#0b2b26',
  '--app-sidebar-border': 'rgba(218, 241, 222, 0.08)',
  '--app-sidebar-thumb': '#235347',
  '--app-sidebar-thumb-hover': '#2d6556',
  '--app-sidebar-active-bg': 'linear-gradient(135deg, #235347 0%, #8eb69b 100%)',
  '--app-sidebar-active-foreground': '#051f20',
  '--app-surface-solid': '#163832',
  '--app-surface-elevated': 'linear-gradient(180deg, rgba(22, 56, 50, 0.98) 0%, rgba(11, 43, 38, 0.98) 100%)',
  '--app-surface-soft': 'rgba(218, 241, 222, 0.05)',
  '--app-surface-input': '#163832',
  '--app-surface-border': 'rgba(218, 241, 222, 0.12)',
  '--app-highlight': '#8eb69b',
  '--app-highlight-soft': '#daf1de',
  '--app-highlight-glow': 'rgba(142, 182, 155, 0.24)',
  '--public-shell-bg': 'radial-gradient(circle at top, rgba(142, 182, 155, 0.12), transparent 24%), linear-gradient(180deg, #051f20 0%, #0b2b26 44%, #163832 100%)',
  '--public-header-bg': 'rgba(5, 31, 32, 0.94)',
  '--public-footer-bg': 'linear-gradient(180deg, rgba(5, 31, 32, 0.96) 0%, rgba(11, 43, 38, 0.98) 100%)',
  '--public-card-bg': 'radial-gradient(circle at top left, rgba(142, 182, 155, 0.2), transparent 28%), linear-gradient(135deg, rgba(11, 43, 38, 0.98) 0%, rgba(5, 31, 32, 0.99) 52%, rgba(22, 56, 50, 0.96) 100%)',
  '--public-card-bg-soft': 'radial-gradient(circle at top left, rgba(142, 182, 155, 0.12), transparent 28%), linear-gradient(145deg, rgba(11, 43, 38, 0.96) 0%, rgba(5, 31, 32, 0.98) 52%, rgba(22, 56, 50, 0.96) 100%)',
  '--public-card-border': 'rgba(142, 182, 155, 0.20)',
  '--public-accent': '#8eb69b',
  '--public-accent-soft': '#daf1de',
  '--public-accent-strong': '#235347',
  '--public-muted': 'rgba(218, 241, 222, 0.74)',
};

const AGENTFINDER_THEME_VARIABLES: ThemeVariableMap = {
  '--background': '220 33% 96%',
  '--foreground': '224 71% 4%',
  '--card': '0 0% 100%',
  '--card-foreground': '224 71% 4%',
  '--popover': '0 0% 100%',
  '--popover-foreground': '224 71% 4%',
  '--primary': '220 28% 44%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '220 13% 91%',
  '--secondary-foreground': '224 71% 4%',
  '--muted': '220 9% 89%',
  '--muted-foreground': '220 9% 45%',
  '--accent': '260 85% 75%',
  '--accent-foreground': '0 0% 100%',
  '--border': '220 13% 91%',
  '--input': '220 13% 86%',
  '--ring': '260 85% 75%',
  '--radius': '0.75rem',
  '--font-body': 'var(--font-inter)',
  '--font-headline': 'var(--font-space-grotesk)',
  '--app-shell-bg': 'hsl(var(--background))',
  '--app-shell-bg-gradient': 'linear-gradient(180deg, #eef3fb 0%, #f8fbff 100%)',
  '--app-topbar-bg': 'hsl(214 45% 97%)',
  '--app-sidebar-bg': 'hsl(214 45% 97%)',
  '--app-footer-bg': 'hsl(214 45% 97%)',
  '--app-sidebar-border': 'hsl(214 34% 87%)',
  '--app-sidebar-thumb': 'hsl(220 28% 44%)',
  '--app-sidebar-thumb-hover': 'hsl(220 28% 50%)',
  '--app-sidebar-active-bg': 'hsl(220 28% 44%)',
  '--app-sidebar-active-foreground': 'hsl(0 0% 100%)',
  '--app-surface-solid': 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,253,0.98))',
  '--app-surface-elevated': 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,253,0.98))',
  '--app-surface-soft': 'linear-gradient(145deg, rgba(244,248,254,0.96), rgba(255,255,255,0.9))',
  '--app-surface-input': 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(246,249,255,0.96))',
  '--app-surface-border': 'hsl(var(--border))',
  '--app-highlight': '#445b84',
  '--app-highlight-soft': '#6f86b0',
  '--app-highlight-glow': 'rgba(68, 91, 132, 0.16)',
  '--app-nav-foreground': 'hsl(224 46% 18%)',
  '--app-nav-muted': 'hsl(217 40% 34%)',
  '--app-nav-hover-bg': 'hsl(212 52% 93%)',
  '--app-nav-hover-foreground': 'hsl(217 40% 34%)',
  '--app-page-foreground': 'hsl(var(--foreground))',
  '--app-page-muted': 'hsl(var(--muted-foreground))',
  '--public-shell-bg': 'linear-gradient(180deg, #eef3fb 0%, #f8fbff 100%)',
  '--public-header-bg': 'rgba(255, 255, 255, 0.9)',
  '--public-footer-bg': 'linear-gradient(180deg, rgba(245,248,252,0.96) 0%, rgba(238,243,250,0.98) 100%)',
  '--public-card-bg': 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,253,0.98))',
  '--public-card-bg-soft': 'linear-gradient(145deg, rgba(244,248,254,0.96), rgba(255,255,255,0.9))',
  '--public-card-border': 'hsl(var(--border))',
  '--public-accent': '#445b84',
  '--public-accent-soft': '#b680f6',
  '--public-accent-strong': '#445b84',
  '--public-muted': 'hsl(var(--muted-foreground))',
  '--agentfinder-card-bg': 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,249,253,0.98))',
  '--agentfinder-card-bg-soft': 'linear-gradient(145deg, rgba(244,248,254,0.96), rgba(255,255,255,0.9))',
  '--agentfinder-card-bg-blue': 'radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 36%), linear-gradient(135deg, rgba(244,248,253,0.98), rgba(232,240,251,0.98))',
  '--agentfinder-card-bg-green': 'radial-gradient(circle at top right, rgba(255,255,255,0.88), transparent 34%), linear-gradient(135deg, rgba(245,251,247,0.98), rgba(233,246,238,0.98))',
  '--agentfinder-card-bg-violet': 'radial-gradient(circle at top left, rgba(255,255,255,0.9), transparent 34%), linear-gradient(135deg, rgba(248,246,252,0.98), rgba(238,235,248,0.98))',
  '--agentfinder-card-bg-sky': 'radial-gradient(circle at top right, rgba(255,255,255,0.88), transparent 34%), linear-gradient(135deg, rgba(244,247,253,0.98), rgba(227,236,250,0.98))',
  '--agentfinder-shell-panel': 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(241,246,253,0.98) 62%, rgba(248,251,255,0.98))',
  '--agentfinder-shell-glow': 'radial-gradient(circle at top left, rgba(86,121,180,0.18), transparent 42%), radial-gradient(circle at top right, rgba(165,188,225,0.16), transparent 34%)',
  '--agentfinder-card-shadow': '0 18px 48px rgba(37, 55, 88, 0.08)',
  '--agentfinder-card-shadow-strong': '0 24px 56px rgba(37, 55, 88, 0.12)',
  '--agentfinder-soft-shadow': '0 12px 24px rgba(33, 51, 84, 0.06)',
  '--agentfinder-pill-shadow': '0 12px 30px rgba(33, 51, 84, 0.08)',
  '--agentfinder-primary-button': '#415782',
  '--agentfinder-primary-button-hover': '#384d75',
  '--agentfinder-primary-button-shadow': '0 14px 30px rgba(47, 66, 104, 0.22)',
  '--agentfinder-dark-button': '#152033',
  '--agentfinder-dark-button-hover': '#101827',
  '--agentfinder-dark-button-shadow': '0 14px 30px rgba(21, 32, 51, 0.18)',
  '--agentfinder-pill-bg': 'rgba(255,255,255,0.92)',
  '--agentfinder-pill-border': 'rgba(255,255,255,0.9)',
  '--agentfinder-pill-foreground': '#59709b',
  '--agentfinder-success-bg': '#dcfce7',
  '--agentfinder-success-border': '#a7f3d0',
  '--agentfinder-success-foreground': '#065f46',
  '--agentfinder-warning-bg': '#fef3c7',
  '--agentfinder-warning-border': '#fcd34d',
  '--agentfinder-warning-foreground': '#92400e',
  '--agentfinder-danger-bg': '#ffe4e6',
  '--agentfinder-danger-border': '#fecdd3',
  '--agentfinder-danger-foreground': '#9f1239',
};

const THEME_VARIABLE_NAMES = Array.from(
  new Set([
    ...Object.keys(FOREST_THEME_VARIABLES),
    ...Object.keys(AGENTFINDER_THEME_VARIABLES),
  ])
) as Array<keyof typeof FOREST_THEME_VARIABLES | keyof typeof AGENTFINDER_THEME_VARIABLES>;

export function resolveThemePreset(value?: string | null): ThemePreset {
  if (value === 'forest' || value === 'agentfinder') {
    return value;
  }

  return 'classic';
}

export function hexToHsl(hex: string): string | null {
  if (!hex || !hex.startsWith('#')) return null;

  let hexValue = hex.replace('#', '');
  if (hexValue.length === 3) {
    hexValue = hexValue
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (hexValue.length !== 6) return null;

  const r = parseInt(hexValue.substring(0, 2), 16) / 255;
  const g = parseInt(hexValue.substring(2, 4), 16) / 255;
  const b = parseInt(hexValue.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function getThemeVariables(preset: ThemePreset): ThemeVariableMap {
  if (preset === 'forest') return FOREST_THEME_VARIABLES;
  if (preset === 'agentfinder') return AGENTFINDER_THEME_VARIABLES;

  return {};
}

function getThemePrimaryHsl(preset: ThemePreset, primaryColor?: string | null) {
  if (preset === 'forest') {
    return hexToHsl(FOREST_PRIMARY_HEX) || DEFAULT_CLASSIC_PRIMARY_HSL;
  }

  if (preset === 'agentfinder') {
    return hexToHsl(AGENTFINDER_PRIMARY_HEX) || DEFAULT_CLASSIC_PRIMARY_HSL;
  }

  return hexToHsl(primaryColor || DEFAULT_CLASSIC_PRIMARY_HEX) || DEFAULT_CLASSIC_PRIMARY_HSL;
}

export function getAgencyThemePreset(agency?: Pick<Agency, 'themePreset'> | null) {
  return resolveThemePreset(agency?.themePreset);
}

export function getAgencyThemeStyle(
  agency?: Pick<Agency, 'primaryColor' | 'themePreset'> | null
): CSSProperties {
  const preset = getAgencyThemePreset(agency);
  const primaryHsl = getThemePrimaryHsl(preset, agency?.primaryColor);
  const themeVariables = getThemeVariables(preset);

  return {
    ...themeVariables,
    ['--primary' as string]: primaryHsl,
    ['--ring' as string]: primaryHsl,
  };
}

export function applyAgencyThemeToRoot(
  root: HTMLElement,
  agency?: Pick<Agency, 'primaryColor' | 'themePreset'> | null
) {
  const preset = getAgencyThemePreset(agency);
  const style = getAgencyThemeStyle(agency);

  root.dataset.appTheme = preset;

  for (const variableName of THEME_VARIABLE_NAMES) {
    root.style.removeProperty(variableName);
  }

  Object.entries(style).forEach(([key, value]) => {
    root.style.setProperty(key, String(value));
  });
}

export function resetAgencyThemeOnRoot(root: HTMLElement) {
  root.dataset.appTheme = 'classic';

  for (const variableName of THEME_VARIABLE_NAMES) {
    root.style.removeProperty(variableName);
  }

  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
}
