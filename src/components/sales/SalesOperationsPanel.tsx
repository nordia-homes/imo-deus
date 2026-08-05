'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Loader2, Save, ScanSearch, ShieldAlert } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import type { SalesEmailSettings } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Health = {
  status: 'healthy' | 'setup_required' | 'not_configured';
  capabilities: { webhookSecretConfigured: boolean; inboundDomainConfigured: boolean; externalMalwareScannerConfigured: boolean; ocrEnabled: boolean };
  lastEventAt?: string | null;
};

const defaults: SalesEmailSettings = { id: 'default', inboundProvider: 'generic', attachmentRetentionDays: 365, completedSaleRetentionDays: 1825, ocrEnabled: false, malwareScanRequired: false, dailyDigestHour: 8, updatedAt: '', updatedByUid: '' };

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
      const headers = { Authorization: `Bearer ${token}` };
      const [healthResponse, settingsResponse] = await Promise.all([fetch('/api/email/health', { headers }), fetch('/api/sales/settings', { headers })]);
      const [healthPayload, settingsPayload] = await Promise.all([healthResponse.json(), settingsResponse.json()]);
      if (healthResponse.ok) setHealth(healthPayload);
      if (settingsResponse.ok) setSettings(settingsPayload.settings);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!user || !isAdmin) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/sales/settings', { method: 'PATCH', headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(settings) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Setările nu au putut fi salvate.');
      setSettings(payload.settings);
      toast({ title: 'Setările operaționale au fost salvate' });
    } catch (error) {
      toast({ title: 'Salvarea a eșuat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 rounded-2xl border border-[var(--app-surface-border)] p-4 text-sm text-[var(--app-muted-foreground)]"><Loader2 className="h-4 w-4 animate-spin" /> Verific infrastructura email…</div>;

  return (
    <div className="space-y-4 rounded-[24px] border border-[var(--app-surface-border)] bg-[radial-gradient(circle_at_90%_0%,rgba(14,165,233,.12),transparent_38%),var(--app-surface)] p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Starea infrastructurii</p><p className="mt-1 text-xs text-[var(--app-muted-foreground)]">Nu oferă acces la contul Gmail; monitorizează doar forwardingul și procesarea documentelor.</p></div>{health?.status === 'healthy' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <ShieldAlert className="h-5 w-5 text-amber-500" />}</div>
      <div className="grid grid-cols-2 gap-2">
        <Badge variant="outline" className="justify-center rounded-xl py-2"><Activity className="mr-1 h-3.5 w-3.5" /> Webhook {health?.capabilities.webhookSecretConfigured ? 'protejat' : 'neconfigurat'}</Badge>
        <Badge variant="outline" className="justify-center rounded-xl py-2"><ScanSearch className="mr-1 h-3.5 w-3.5" /> Scanner {health?.capabilities.externalMalwareScannerConfigured ? 'extern activ' : 'politică locală'}</Badge>
        <Badge variant="outline" className="justify-center rounded-xl py-2">OCR {health?.capabilities.ocrEnabled ? 'activ' : 'opțional'}</Badge>
        <Badge variant="outline" className="justify-center rounded-xl py-2"><Clock3 className="mr-1 h-3.5 w-3.5" /> Ultimul event {health?.lastEventAt ? new Date(health.lastEventAt).toLocaleDateString('ro-RO') : '—'}</Badge>
      </div>
      {isAdmin ? <div className="space-y-3 border-t border-[var(--app-surface-border)] pt-4"><p className="text-sm font-medium">Politici agenție</p><div className="grid grid-cols-2 gap-3"><div><Label className="text-xs">Păstrare atașamente (zile)</Label><Input type="number" min={30} max={3650} value={settings.attachmentRetentionDays} onChange={(event) => setSettings((current) => ({ ...current, attachmentRetentionDays: Number(event.target.value) }))} className="mt-1 rounded-xl" /></div><div><Label className="text-xs">Dosar finalizat (zile)</Label><Input type="number" min={365} max={3650} value={settings.completedSaleRetentionDays} onChange={(event) => setSettings((current) => ({ ...current, completedSaleRetentionDays: Number(event.target.value) }))} className="mt-1 rounded-xl" /></div></div><div className="flex items-center gap-2"><Checkbox checked={settings.ocrEnabled} onCheckedChange={(checked) => setSettings((current) => ({ ...current, ocrEnabled: checked === true }))} /><Label>Activează OCR pentru documentele primite</Label></div><div className="flex items-center gap-2"><Checkbox checked={settings.malwareScanRequired} onCheckedChange={(checked) => setSettings((current) => ({ ...current, malwareScanRequired: checked === true }))} /><Label>Cere scanner antivirus extern înainte de aprobare</Label></div><Button className="w-full rounded-xl" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvează politicile</Button></div> : null}
    </div>
  );
}
