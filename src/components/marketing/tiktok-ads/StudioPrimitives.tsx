'use client';

import { forwardRef, type ReactNode } from 'react';
import { ArrowUpRight, Building2, Check, Heart, MessageCircle, Play, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import { Button as BaseButton, type ButtonProps } from '@/components/ui/button';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function StudioButton({ variant = 'default', className = '', ...props }, ref) {
  return <BaseButton ref={ref} variant={variant} className={`tt-button tt-button--${variant} ${className}`} {...props} />;
});

export function StatusBadge({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return <span className={`tt-badge ${active ? 'tt-badge--active' : ''}`}><span aria-hidden="true" />{children}</span>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="tt-empty"><div className="tt-empty-art" aria-hidden="true"><div /><div /><span><Play /></span></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function MetricCard({ label, value, icon, accent = 'cyan' }: { label: string; value: string; icon: ReactNode; accent?: string }) {
  return <article className={`tt-metric tt-metric--${accent}`}><div className="tt-metric-top"><span className="tt-icon-tile">{icon}</span><span className="tt-metric-dot" aria-hidden="true" /></div><p>{label}</p><strong>{value}</strong><span className="tt-metric-caption">{value === '—' ? 'În așteptarea raportului' : 'În intervalul selectat'}</span></article>;
}

export function PhonePreview({ asset, username, text, cta = 'Află mai multe' }: { asset?: { url: string; thumbnailUrl?: string | null }; username?: string | null; text?: string; cta?: string }) {
  return <aside className="tt-preview">
    <div className="tt-preview-label"><span className="tt-live-dot" /> PREVIZUALIZARE <span>9:16</span></div>
    <div className="tt-preview-heading"><h3>Așa începe<br /><em>prima impresie.</em></h3><p>Mesajul tău, în format TikTok.</p></div><div className="tt-phone"><div className="tt-phone-island" aria-hidden="true" /><div className="tt-phone-screen">
      {asset ? <video controls playsInline src={asset.url} poster={asset.thumbnailUrl || undefined} className="tt-phone-video" /> : <div className="tt-phone-placeholder"><div className="tt-building-art" aria-hidden="true"><Building2 /><span /><span /></div><span className="tt-placeholder-label">PROPRIETATEA TA.<br /><strong>În lumina potrivită.</strong></span><p>Selectează un videoclip<br />pentru previzualizare.</p></div>}
      <div className="tt-phone-top" aria-hidden="true">Urmărești <strong>Pentru tine</strong></div>
      <div className="tt-phone-actions" aria-hidden="true"><span className="tt-phone-avatar"><Building2 /></span><Heart /><MessageCircle /><Share2 /></div>
      <div className="tt-phone-copy"><strong>@{username || 'profilul_agenției'}</strong><span className="tt-sponsored">Sponsorizat</span><p>{text || 'Povestea următoarei tale proprietăți începe aici.'}</p><div className="tt-phone-cta">{cta}<ArrowUpRight /></div></div>
    </div></div>
    <p className="tt-preview-note"><ShieldCheck />Previzualizare orientativă. Crearea nu activează reclama.</p>
  </aside>;
}

export function PermissionChip({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  return <span className={`tt-permission ${allowed ? 'tt-permission--yes' : ''}`}>{allowed ? <Check /> : <span className="tt-permission-minus">−</span>}{children}</span>;
}

export function StudioEyebrow({ children }: { children: ReactNode }) {
  return <span className="tt-eyebrow"><Sparkles size={13} />{children}</span>;
}

/** Decorative, code-native property illustration; never presented as portfolio data. */
export function StudioScene() {
  return <div className="tt-scene" aria-hidden="true">
    <div className="tt-scene-halo" />
    <div className="tt-scene-sheet tt-scene-sheet--back"><span>O NOUĂ PERSPECTIVĂ</span><div /><i /></div>
    <div className="tt-scene-sheet tt-scene-sheet--front">
      <span className="tt-scene-brand"><Sparkles size={12} /> PROPERTY STORIES</span>
      <div className="tt-architecture"><div className="tt-arch-sun" /><div className="tt-arch-wall" /><div className="tt-arch-window" /><div className="tt-arch-podium" /><div className="tt-arch-plant"><i /><i /><i /></div></div>
      <div className="tt-scene-caption"><small>URMĂTOAREA POVESTE</small><strong>Începe acasă.</strong><span>Un loc. O emoție. Un nou început.</span></div>
      <span className="tt-scene-play"><Play size={16} fill="currentColor" /></span>
    </div>
    <div className="tt-scene-tag tt-scene-tag--video"><ClapperboardIcon /><span>Creat pentru<br /><strong>vertical.</strong></span><b>9:16</b></div>
    <div className="tt-scene-tag tt-scene-tag--spark"><Sparkles size={16} /><span>De la proprietate la poveste</span></div>
  </div>;
}

function ClapperboardIcon() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="8" width="18" height="13" rx="3" /><path d="m3 8 17-5 1 5M8 4.5l3 4M14 3l3 4M10 13l5 3-5 3z" /></svg>;
}
