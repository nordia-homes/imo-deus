import type { CSSProperties } from 'react';
import type { Agency, ThemePreset } from '@/lib/types';

const DEFAULT_CLASSIC_PRIMARY_HEX = '#22c55e';
const DEFAULT_CLASSIC_PRIMARY_HSL = '145 63% 45%';
const FOREST_PRIMARY_HEX = '#8EB69B';

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

const THEME_VARIABLE_NAMES = Object.keys(FOREST_THEME_VARIABLES) as Array<keyof typeof FOREST_THEME_VARIABLES>;

export function resolveThemePreset(value?: string | null): ThemePreset {
  return value === 'forest' ? 'forest' : 'classic';
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
  return preset === 'forest' ? FOREST_THEME_VARIABLES : {};
}

function getThemePrimaryHsl(preset: ThemePreset, primaryColor?: string | null) {
  if (preset === 'forest') {
    return hexToHsl(FOREST_PRIMARY_HEX) || DEFAULT_CLASSIC_PRIMARY_HSL;
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
  delete root.dataset.appTheme;

  for (const variableName of THEME_VARIABLE_NAMES) {
    root.style.removeProperty(variableName);
  }

  root.style.removeProperty('--primary');
  root.style.removeProperty('--ring');
}
