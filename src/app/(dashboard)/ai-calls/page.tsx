'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, orderBy, query } from 'firebase/firestore';
import { Bot, Loader2, PhoneCall, Save, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_AI_OUTREACH_SETTINGS } from '@/lib/ai-outreach/defaults';
import { getAiOutreachOutcomeMeta } from '@/lib/ai-outreach/status';
import type { AiOutreachCall, AiOutreachSettings } from '@/lib/ai-outreach/types';
import { cn } from '@/lib/utils';

const badgeToneClasses = {
  neutral: 'border-slate-200 bg-slate-50 text-slate-700',
  pending: 'border-amber-200 bg-amber-50 text-amber-700',
  info: 'border-blue-200 bg-blue-50 text-blue-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  danger: 'border-rose-200 bg-rose-50 text-rose-700',
  warning: 'border-orange-200 bg-orange-50 text-orange-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
};

export default function AiCallsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { agencyId } = useAgency();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AiOutreachSettings | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const aiCallsQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'aiOutreachCalls'), orderBy('createdAt', 'desc')) : null),
    [agencyId, firestore],
  );
  const { data: calls, isLoading: isLoadingCalls } = useCollection<AiOutreachCall>(aiCallsQuery);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!user) return;
      setIsLoadingSettings(true);
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/ai-outreach/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.message || 'Nu am putut incarca setarile AI.');
        }
        if (isMounted) {
          setSettings(payload.settings as AiOutreachSettings);
        }
      } catch (error) {
        toast({
          title: 'Setari AI indisponibile',
          description: error instanceof Error ? error.message : 'Nu am putut incarca setarile.',
          variant: 'destructive',
        });
        if (isMounted && agencyId) {
          setSettings({ ...DEFAULT_AI_OUTREACH_SETTINGS, agencyId });
        }
      } finally {
        if (isMounted) setIsLoadingSettings(false);
      }
    }

    loadSettings();
    return () => {
      isMounted = false;
    };
  }, [agencyId, toast, user]);

  const stats = useMemo(() => {
    const list = calls ?? [];
    const completed = list.filter((call) => call.status === 'completed').length;
    const positive = list.filter((call) => ['collaborates', 'verbal_agreement', 'negotiation_success'].includes(call.outcome)).length;
    const failed = list.filter((call) => call.status === 'failed').length;

    return {
      total: list.length,
      completed,
      positive,
      failed,
    };
  }, [calls]);

  const updateSetting = <K extends keyof AiOutreachSettings>(key: K, value: AiOutreachSettings[K]) => {
    setSettings((current) => (current ? { ...current, [key]: value } : current));
  };

  const saveSettings = async () => {
    if (!user || !settings) return;
    setIsSaving(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch('/api/ai-outreach/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Nu am putut salva setarile.');
      }
      setSettings(payload.settings as AiOutreachSettings);
      toast({ title: 'Setari salvate', description: 'AI-ul va folosi noile limite la urmatoarele apeluri.' });
    } catch (error) {
      toast({
        title: 'Salvare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut salva setarile.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 px-3 pb-8 pt-3 sm:px-4 xl:px-5">
      <div className="rounded-[1.5rem] border border-white/75 bg-[linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] px-5 py-5 text-white shadow-[0_18px_48px_-34px_rgba(15,23,42,0.24)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100">
              <Bot className="h-3.5 w-3.5" />
              AI Outreach
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.04em]">Apeluri AI</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">
              Configureaza comisionul, limitele de negociere si urmareste apelurile catre proprietari.
            </p>
          </div>
          <Button onClick={saveSettings} disabled={isSaving || isLoadingSettings || !settings} className="rounded-full bg-emerald-500 text-white hover:bg-emerald-600">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salveaza setarile
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total apeluri</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.total}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Finalizate</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">{stats.completed}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pozitive</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-emerald-600">{stats.positive}</CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Esuate</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-rose-600">{stats.failed}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Setari agentie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoadingSettings || !settings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Incarcam setarile...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <Label className="font-semibold">Apeluri AI active</Label>
                    <p className="text-sm text-muted-foreground">Permite agentilor sa porneasca apeluri AI.</p>
                  </div>
                  <Switch checked={settings.enabled} onCheckedChange={(value) => updateSetting('enabled', value)} />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Comision dorit</Label>
                    <Input value={settings.desiredCommissionValue} onChange={(event) => updateSetting('desiredCommissionValue', event.target.value)} />
                  </div>
                  <div>
                    <Label>Comision minim</Label>
                    <Input value={settings.minimumCommissionValue} onChange={(event) => updateSetting('minimumCommissionValue', event.target.value)} />
                  </div>
                </div>

                <div>
                  <Label>Tip comision</Label>
                  <Select value={settings.commissionType} onValueChange={(value) => updateSetting('commissionType', value as AiOutreachSettings['commissionType'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Procent</SelectItem>
                      <SelectItem value="fixed">Suma fixa</SelectItem>
                      <SelectItem value="mixed">Mixt</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Start apeluri</Label>
                    <Input value={settings.callWindowStart} onChange={(event) => updateSetting('callWindowStart', event.target.value)} />
                  </div>
                  <div>
                    <Label>Stop apeluri</Label>
                    <Input value={settings.callWindowEnd} onChange={(event) => updateSetting('callWindowEnd', event.target.value)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <Label>Negociere AI</Label>
                    <Switch checked={settings.allowNegotiation} onCheckedChange={(value) => updateSetting('allowNegotiation', value)} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <Label>Acord verbal permis</Label>
                    <Switch checked={settings.allowVerbalAgreement} onCheckedChange={(value) => updateSetting('allowVerbalAgreement', value)} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <Label>Colectare adresa exacta</Label>
                    <Switch checked={settings.allowExactAddressCollection} onCheckedChange={(value) => updateSetting('allowExactAddressCollection', value)} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl border p-3">
                    <Label>Disclosure AI</Label>
                    <Switch checked={settings.discloseAi} onCheckedChange={(value) => updateSetting('discloseAi', value)} />
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-emerald-600" />
              Istoric apeluri
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-2xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anunt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Comision</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingCalls ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Se incarca apelurile...
                      </TableCell>
                    </TableRow>
                  ) : (calls ?? []).length ? (
                    (calls ?? []).map((call) => {
                      const meta = getAiOutreachOutcomeMeta(call.outcome);
                      return (
                        <TableRow key={call.id}>
                          <TableCell className="max-w-[280px] truncate font-medium">{call.ownerListingTitle || call.ownerListingId}</TableCell>
                          <TableCell>
                            <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', badgeToneClasses[meta.tone])}>{meta.label}</span>
                          </TableCell>
                          <TableCell>{call.ownerPhone}</TableCell>
                          <TableCell>{call.result?.acceptedCommissionValue || call.result?.desiredCommission || '-'}</TableCell>
                          <TableCell>{call.agentName || '-'}</TableCell>
                          <TableCell>{call.createdAt ? new Date(call.createdAt).toLocaleString('ro-RO') : '-'}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nu exista apeluri AI inca.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
