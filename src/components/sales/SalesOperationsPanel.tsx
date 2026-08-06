'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSearch2,
  Loader2,
  Save,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import type { SalesEmailSettings } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Health = {
  status: 'healthy' | 'setup_required' | 'not_configured';
  capabilities: {
    webhookSecretConfigured: boolean;
    inboundDomainConfigured: boolean;
    externalMalwareScannerConfigured: boolean;
    ocrEnabled: boolean;
  };
  lastEventAt?: string | null;
};

const defaults: SalesEmailSettings = {
  id: 'default',
  inboundProvider: 'generic',
  attachmentRetentionDays: 365,
  completedSaleRetentionDays: 1825,
  ocrEnabled: false,
  malwareScanRequired: false,
  dailyDigestHour: 8,
  updatedAt: '',
  updatedByUid: '',
};

export function SalesOperationsPanel() {
  const { user, userProfile } = useAgency();
  const { toast } = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [settings, setSettings] = useState<SalesEmailSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'platform_admin';

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const headers = { Authorization: 'Bearer ' + token };
      const [healthResponse, settingsResponse] = await Promise.all([
        fetch('/api/email/health', { headers }),
        fetch('/api/sales/settings', { headers }),
      ]);
      const [healthPayload, settingsPayload] = await Promise.all([
        healthResponse.json(),
        settingsResponse.json(),
      ]);
      if (healthResponse.ok) setHealth(healthPayload);
      if (settingsResponse.ok) setSettings(settingsPayload.settings);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!user || !isAdmin) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sales/settings', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Setările nu au putut fi salvate.');
      setSettings(payload.settings);
      toast({ title: 'Setările operaționale au fost salvate' });
    } catch (error) {
      toast({
        title: 'Salvarea a eșuat',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="sales-operations-panel flex min-h-[220px] items-center justify-center rounded-[30px] border border-[var(--app-surface-border)] p-6">
        <div className="text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
          <p className="mt-3 text-sm font-medium">Verific infrastructura email…</p>
          <p className="mt-1 text-xs text-[var(--app-muted-foreground)]">Webhook, scanner și OCR</p>
        </div>
      </div>
    );
  }

  const capabilityCards = [
    {
      label: 'Webhook',
      value: health?.capabilities.webhookSecretConfigured ? 'Protejat' : 'De configurat',
      detail: 'Recepție securizată',
      active: Boolean(health?.capabilities.webhookSecretConfigured),
      Icon: Activity,
      tone: 'blue',
    },
    {
      label: 'Scanner',
      value: health?.capabilities.externalMalwareScannerConfigured ? 'Extern activ' : 'Politică locală',
      detail: 'Fișiere verificate',
      active: Boolean(health?.capabilities.externalMalwareScannerConfigured),
      Icon: ScanSearch,
      tone: 'violet',
    },
    {
      label: 'OCR',
      value: health?.capabilities.ocrEnabled ? 'Activ' : 'Opțional',
      detail: 'Text extras automat',
      active: Boolean(health?.capabilities.ocrEnabled),
      Icon: FileSearch2,
      tone: 'emerald',
    },
    {
      label: 'Ultimul eveniment',
      value: health?.lastEventAt ? new Date(health.lastEventAt).toLocaleDateString('ro-RO') : '—',
      detail: 'Activitate inbound',
      active: Boolean(health?.lastEventAt),
      Icon: Clock3,
      tone: 'amber',
    },
  ] as const;

  return (
    <div className="sales-operations-panel rounded-[28px] border border-[var(--app-surface-border)] p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(260px,.7fr)_minmax(0,1.3fr)] xl:items-center">
        <div className="flex items-start gap-3.5">
          <div className="sales-operations-panel__shield grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-blue-600">Starea serviciilor</p>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[.1em]',
                  health?.status === 'healthy'
                    ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700'
                    : 'border-amber-500/20 bg-amber-500/8 text-amber-700'
                )}
              >
                {health?.status === 'healthy' ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <ShieldAlert className="h-3 w-3" />
                )}
                {health?.status === 'healthy' ? 'Activ' : 'Atenție'}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-semibold tracking-[-.02em]">Infrastructură email</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--app-muted-foreground)]">
              Forwarding, scanare și OCR — fără acces la inbox.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {capabilityCards.map(({ label, value, active, Icon, tone }) => (
            <div
              key={label}
              className="sales-operations-panel__capability flex min-w-0 items-center gap-2.5 rounded-2xl border border-[var(--app-surface-border)] px-3 py-2.5"
            >
              <div className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-xl',
                tone === 'blue' && 'bg-blue-500/10 text-blue-600',
                tone === 'violet' && 'bg-violet-500/10 text-violet-600',
                tone === 'emerald' && 'bg-emerald-500/10 text-emerald-600',
                tone === 'amber' && 'bg-amber-500/10 text-amber-600'
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-emerald-500' : 'bg-slate-300')} />
                  <p className="truncate text-[9px] font-semibold uppercase tracking-[.1em] text-[var(--app-muted-foreground)]">{label}</p>
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {isAdmin ? (
        <details className="sales-operations-panel__policies mt-5 rounded-[20px] border border-[var(--app-surface-border)]">
          <summary className="sales-operations-panel__summary flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold">Politici agenție</p>
              <p className="mt-0.5 text-[11px] text-[var(--app-muted-foreground)]">
                Retenția documentelor, OCR și scanarea antivirus
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-blue-500/8 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[.12em] text-blue-700">
                Admin
              </span>
              <ChevronDown className="sales-operations-panel__chevron h-4 w-4 text-[var(--app-muted-foreground)]" />
            </div>
          </summary>

          <div className="border-t border-[var(--app-surface-border)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="sales-operations-panel__field rounded-2xl border border-[var(--app-surface-border)] p-3">
                <span className="text-xs font-medium">Păstrare atașamente</span>
                <span className="mt-0.5 block text-[11px] text-[var(--app-muted-foreground)]">Număr de zile</span>
                <Input
                  type="number"
                  min={30}
                  max={3650}
                  value={settings.attachmentRetentionDays}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    attachmentRetentionDays: Number(event.target.value),
                  }))}
                  className="mt-2 h-10 rounded-xl border-[var(--app-surface-border)]"
                />
              </label>
              <label className="sales-operations-panel__field rounded-2xl border border-[var(--app-surface-border)] p-3">
                <span className="text-xs font-medium">Dosar finalizat</span>
                <span className="mt-0.5 block text-[11px] text-[var(--app-muted-foreground)]">Număr de zile</span>
                <Input
                  type="number"
                  min={365}
                  max={3650}
                  value={settings.completedSaleRetentionDays}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    completedSaleRetentionDays: Number(event.target.value),
                  }))}
                  className="mt-2 h-10 rounded-xl border-[var(--app-surface-border)]"
                />
              </label>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="sales-operations-panel__toggle flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] p-3">
                <Checkbox
                  checked={settings.ocrEnabled}
                  onCheckedChange={(checked) => setSettings((current) => ({
                    ...current,
                    ocrEnabled: checked === true,
                  }))}
                />
                <span>
                  <span className="block text-sm font-medium">OCR pentru documentele primite</span>
                  <span className="block text-[11px] text-[var(--app-muted-foreground)]">Extrage automat textul pentru verificare</span>
                </span>
              </label>
              <label className="sales-operations-panel__toggle flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--app-surface-border)] p-3">
                <Checkbox
                  checked={settings.malwareScanRequired}
                  onCheckedChange={(checked) => setSettings((current) => ({
                    ...current,
                    malwareScanRequired: checked === true,
                  }))}
                />
                <span>
                  <span className="block text-sm font-medium">Scanner antivirus extern</span>
                  <span className="block text-[11px] text-[var(--app-muted-foreground)]">Blochează aprobarea până la verificare</span>
                </span>
              </label>
            </div>

            <Button
              className="sales-operations-panel__save mt-4 h-11 w-full rounded-2xl text-white"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvează politicile
            </Button>
          </div>
        </details>
      ) : null}
    </div>
  );
}
