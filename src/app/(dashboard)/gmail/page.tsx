'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, setDoc } from 'firebase/firestore';
import {
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  CircleDashed,
  Cloud,
  CopyPlus,
  Edit3,
  FileWarning,
  Files,
  HeartHandshake,
  Home,
  Inbox,
  KeyRound,
  Laptop2,
  Loader2,
  Mail,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { GmailForwardingSetup } from '@/components/sales/GmailForwardingSetup';
import { GmailTemplateEditorDialog, type GmailTemplateDraft } from '@/components/sales/GmailTemplateEditorDialog';
import { SalesOperationsPanel } from '@/components/sales/SalesOperationsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { DesktopGmailRunnerStatus } from '@/lib/desktop/gmail-runner';
import { applySalesEmailTemplateOverrides, DEFAULT_SALES_EMAIL_TEMPLATES } from '@/lib/sales';
import type { SaleParticipantRole, SalesEmailTemplate, SalesEmailTemplateOverride } from '@/lib/types';
import { cn } from '@/lib/utils';

type TemplateAudience = Extract<SaleParticipantRole, 'owner' | 'buyer'>;

const statusLabel: Record<DesktopGmailRunnerStatus['state'], string> = {
  idle: 'Pregătit pentru conectare',
  starting: 'Deschid sesiunea Gmail…',
  needs_login: 'Autentifică-te în fereastra Gmail',
  connected: 'Cont Gmail conectat',
  preparing: 'Pregătesc mesajul',
  waiting_for_send: 'Mesaj Gmail pregătit',
  sent_ui_confirmed: 'Trimitere confirmată',
  stopped: 'Sesiune închisă',
  error: 'Conexiunea necesită atenție',
};

const audienceMeta = {
  owner: {
    label: 'Proprietar',
    eyebrow: 'Comunicare de vânzare',
    description: 'Acte, programări și confirmări pentru partea care vinde.',
    icon: Home,
    accent: 'from-cyan-500 via-blue-500 to-indigo-500',
    glow: 'bg-cyan-400/20',
    active: 'border-cyan-400/35 bg-[linear-gradient(135deg,rgba(6,182,212,.16),rgba(59,130,246,.08))] text-cyan-950 dark:text-cyan-100',
    iconStyle: 'bg-cyan-500/12 text-cyan-600',
  },
  buyer: {
    label: 'Cumpărător',
    eyebrow: 'Comunicare de achiziție',
    description: 'Pași simpli și informații clare pentru partea care cumpără.',
    icon: KeyRound,
    accent: 'from-violet-500 via-fuchsia-500 to-rose-500',
    glow: 'bg-fuchsia-400/20',
    active: 'border-fuchsia-400/35 bg-[linear-gradient(135deg,rgba(168,85,247,.15),rgba(236,72,153,.07))] text-fuchsia-950 dark:text-fuchsia-100',
    iconStyle: 'bg-fuchsia-500/12 text-fuchsia-600',
  },
} satisfies Record<TemplateAudience, {
  label: string;
  eyebrow: string;
  description: string;
  icon: typeof Home;
  accent: string;
  glow: string;
  active: string;
  iconStyle: string;
}>;

function templateVisual(template: SalesEmailTemplate) {
  if (template.stage === 'completed') {
    return {
      label: 'Finalizare',
      bar: 'bg-[linear-gradient(90deg,#10b981,#22c55e,#84cc16)]',
      icon: 'bg-emerald-500/12 text-emerald-600',
      pill: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-700 dark:text-emerald-300',
      Glyph: HeartHandshake,
    };
  }
  if (template.id.includes('appointment')) {
    return {
      label: 'Programare',
      bar: 'bg-[linear-gradient(90deg,#8b5cf6,#d946ef,#ec4899)]',
      icon: 'bg-violet-500/12 text-violet-600',
      pill: 'border-violet-500/20 bg-violet-500/8 text-violet-700 dark:text-violet-300',
      Glyph: CalendarCheck2,
    };
  }
  if (template.id.includes('missing')) {
    return {
      label: 'Documente lipsă',
      bar: 'bg-[linear-gradient(90deg,#f59e0b,#f97316,#ef4444)]',
      icon: 'bg-amber-500/12 text-amber-600',
      pill: 'border-amber-500/20 bg-amber-500/8 text-amber-700 dark:text-amber-300',
      Glyph: FileWarning,
    };
  }
  return {
    label: 'Documente necesare',
    bar: 'bg-[linear-gradient(90deg,#06b6d4,#3b82f6,#6366f1)]',
    icon: 'bg-blue-500/12 text-blue-600',
    pill: 'border-blue-500/20 bg-blue-500/8 text-blue-700 dark:text-blue-300',
    Glyph: Files,
  };
}

export default function GmailPage() {
  const firestore = useFirestore();
  const { agencyId, user, userProfile } = useAgency();
  const { toast } = useToast();
  const [activeAudience, setActiveAudience] = useState<TemplateAudience>('owner');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalesEmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [updatingTemplateIds, setUpdatingTemplateIds] = useState<Set<string>>(() => new Set());
  const [isDesktop, setIsDesktop] = useState(false);
  const [runnerStatus, setRunnerStatus] = useState<DesktopGmailRunnerStatus | null>(null);

  const templatesQuery = useMemoFirebase(
    () => agencyId ? collection(firestore, 'agencies', agencyId, 'salesEmailTemplates') : null,
    [agencyId, firestore]
  );
  const { data: customTemplates } = useCollection<SalesEmailTemplate>(templatesQuery);
  const templateOverridesQuery = useMemoFirebase(
    () => user?.uid ? collection(firestore, 'users', user.uid, 'emailTemplateOverrides') : null,
    [firestore, user?.uid]
  );
  const { data: templateOverrides } = useCollection<SalesEmailTemplateOverride>(templateOverridesQuery);
  const baseTemplates = useMemo(
    () => [
      ...DEFAULT_SALES_EMAIL_TEMPLATES,
      ...(customTemplates || []).filter(
        (item) => item.createdByUid === userProfile?.id || item.approvalStatus === 'approved' || userProfile?.role === 'admin'
      ),
    ],
    [customTemplates, userProfile?.id, userProfile?.role]
  );
  const templates = useMemo(
    () => applySalesEmailTemplateOverrides(baseTemplates, templateOverrides),
    [baseTemplates, templateOverrides]
  );
  const personalizedTemplateIds = useMemo(
    () => new Set((templateOverrides || []).map((override) => override.baseTemplateId)),
    [templateOverrides]
  );

  const enabledTemplateIds = userProfile?.enabledSalesEmailTemplateIds || [];
  const enabledTemplateIdSet = useMemo(
    () => new Set(enabledTemplateIds),
    [enabledTemplateIds]
  );
  const activeTemplateCount = useMemo(
    () => templates.filter((template) => template.isActive !== false && enabledTemplateIdSet.has(template.id)).length,
    [enabledTemplateIdSet, templates]
  );
  const activeTemplateCounts = useMemo(
    () => ({
      owner: templates.filter((template) => template.recipientRole === 'owner' && template.isActive !== false && enabledTemplateIdSet.has(template.id)).length,
      buyer: templates.filter((template) => template.recipientRole === 'buyer' && template.isActive !== false && enabledTemplateIdSet.has(template.id)).length,
    }),
    [enabledTemplateIdSet, templates]
  );

  const searchableTemplates = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('ro');
    return templates.filter((template) => {
      if (!['owner', 'buyer'].includes(template.recipientRole)) return false;
      if (!value) return true;
      return [template.name, template.description, template.subject]
        .join(' ')
        .toLocaleLowerCase('ro')
        .includes(value);
    });
  }, [search, templates]);

  const templatesByAudience = useMemo(
    () => ({
      owner: searchableTemplates.filter((template) => template.recipientRole === 'owner'),
      buyer: searchableTemplates.filter((template) => template.recipientRole === 'buyer'),
    }),
    [searchableTemplates]
  );

  const templateCounts = useMemo(
    () => ({
      owner: templates.filter((template) => template.recipientRole === 'owner').length,
      buyer: templates.filter((template) => template.recipientRole === 'buyer').length,
    }),
    [templates]
  );

  useEffect(() => {
    const desktop = window.imodeusDesktop;
    if (!desktop || typeof desktop.getGmailRunnerStatus !== 'function') return;
    void desktop.isDesktop().then(setIsDesktop).catch(() => setIsDesktop(false));
    void desktop.getGmailRunnerStatus().then(setRunnerStatus).catch(() => undefined);
    if (typeof desktop.onGmailRunnerStatusChanged !== 'function') return;
    return desktop.onGmailRunnerStatusChanged(setRunnerStatus);
  }, []);

  const apiRequest = useCallback(async (url: string, init?: RequestInit) => {
    if (!user) throw new Error('Sesiunea a expirat.');
    const token = await user.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + token,
        ...(init?.headers || {}),
      },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Operațiunea nu a putut fi finalizată.');
    return payload;
  }, [user]);

  const connectGmail = async () => {
    if (!isDesktop || typeof window.imodeusDesktop?.connectGmailRunner !== 'function') {
      toast({
        title: 'Deschide Imodeus Desktop',
        description: 'Conectarea fără OAuth folosește profilul Gmail local din aplicația desktop.',
      });
      return;
    }
    try {
      setRunnerStatus(await window.imodeusDesktop.connectGmailRunner());
    } catch (error) {
      toast({
        title: 'Gmail nu a putut fi deschis',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
        variant: 'destructive',
      });
    }
  };

  const saveTemplate = async (draft: GmailTemplateDraft) => {
    if (!draft.name || !draft.subject || !draft.body) {
      toast({
        title: 'Template incomplet',
        description: 'Completează numele, subiectul și mesajul.',
        variant: 'destructive',
      });
      return;
    }
    if (editingTemplate && !user) {
      toast({ title: 'Sesiunea a expirat', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate && user) {
        await setDoc(
          doc(firestore, 'users', user.uid, 'emailTemplateOverrides', editingTemplate.id),
          {
            baseTemplateId: editingTemplate.id,
            baseVersion: editingTemplate.version || 1,
            ...draft,
            signatureMode: 'agent',
            variables: editingTemplate.variables || ['recipient.name', 'property.title', 'property.address', 'documents.list', 'notary.summary', 'agent.name'],
            updatedAt: new Date().toISOString(),
            updatedByUid: user.uid,
          } satisfies Omit<SalesEmailTemplateOverride, 'id'>,
          { merge: false }
        );
        toast({
          title: 'Personalizarea a fost salvată',
          description: 'Template-ul păstrează același loc în bibliotecă și este vizibil numai pentru tine.',
        });
      } else {
        await apiRequest('/api/sales/templates', {
          method: 'POST',
          body: JSON.stringify({
            ...draft,
            signatureMode: 'agent',
            variables: ['recipient.name', 'property.title', 'property.address', 'documents.list', 'notary.summary', 'agent.name'],
          }),
        });
        toast({
          title: 'Template nou salvat',
          description: 'Activează-l din bibliotecă pentru a apărea în pagina de email.',
        });
      }
      setEditorOpen(false);
      setEditingTemplate(null);
    } catch (error) {
      toast({
        title: 'Template-ul nu a putut fi salvat',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };
  const duplicate = async (template: SalesEmailTemplate) => {
    try {
      await apiRequest('/api/sales/templates/' + template.id, { method: 'POST' });
      toast({ title: 'Template duplicat', description: 'Copia rămâne ascunsă până când o activezi explicit.' });
    } catch (error) {
      toast({
        title: 'Template-ul nu a putut fi duplicat',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const resetTemplateOverride = async (template: SalesEmailTemplate) => {
    if (!user) {
      toast({ title: 'Sesiunea a expirat', variant: 'destructive' });
      return;
    }
    if (!window.confirm('Revii la versiunea standard pentru „' + template.name + '”?')) return;

    setUpdatingTemplateIds((current) => new Set(current).add(template.id));
    try {
      await deleteDoc(doc(firestore, 'users', user.uid, 'emailTemplateOverrides', template.id));
      toast({
        title: 'Template readus la versiunea standard',
        description: 'Personalizarea ta a fost eliminată. Vizibilitatea în pagina de email nu s-a schimbat.',
      });
    } catch (error) {
      toast({
        title: 'Versiunea standard nu a putut fi restaurată',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setUpdatingTemplateIds((current) => {
        const next = new Set(current);
        next.delete(template.id);
        return next;
      });
    }
  };
  const setTemplateEnabledForComposer = async (templateId: string, enabled: boolean) => {
    if (!user) {
      toast({ title: 'Sesiunea a expirat', variant: 'destructive' });
      return;
    }
    setUpdatingTemplateIds((current) => new Set(current).add(templateId));
    try {
      await setDoc(
        doc(firestore, 'users', user.uid),
        {
          enabledSalesEmailTemplateIds: enabled ? arrayUnion(templateId) : arrayRemove(templateId),
          salesEmailTemplatePreferencesUpdatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      toast({
        title: enabled ? 'Template activat în pagina de email' : 'Template ascuns din pagina de email',
        description: enabled
          ? 'Va apărea în selectorul de template-uri al agentului curent.'
          : 'Rămâne în bibliotecă și poate fi reactivat oricând.',
      });
    } catch (error) {
      toast({
        title: 'Preferința nu a putut fi salvată',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setUpdatingTemplateIds((current) => {
        const next = new Set(current);
        next.delete(templateId);
        return next;
      });
    }
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  const ready = runnerStatus?.state === 'connected'
    || ['preparing', 'waiting_for_send', 'sent_ui_confirmed'].includes(runnerStatus?.state || '');

  return (
    <div className="gmail-workspace min-h-full bg-[var(--app-page-background)] pb-16 text-[var(--app-page-foreground)]">
      <section className="px-4 pt-5 md:px-8 md:pt-7">
        <div className="gmail-workspace__hero relative isolate mx-auto max-w-[1500px] overflow-hidden rounded-[32px] border px-5 py-6 md:px-8 md:py-8">
          <div className="gmail-workspace__accent-line absolute inset-x-0 top-0 h-1" />
          <div className="gmail-workspace__hero-pattern pointer-events-none absolute inset-0" />
          <div className="gmail-workspace__hero-glow pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full" />
          <div className="gmail-workspace__hero-glow gmail-workspace__hero-glow--secondary pointer-events-none absolute -bottom-32 left-[38%] h-72 w-72 rounded-full" />
          <div className="relative grid gap-7 xl:grid-cols-[minmax(0,1.08fr)_minmax(460px,.92fr)] xl:items-center">
            <div className="max-w-3xl">
              <div className="gmail-workspace__hero-eyebrow inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.2em]">
                <WandSparkles className="h-3.5 w-3.5" />
                Gmail workspace
              </div>
              <h1 className="gmail-workspace__hero-title mt-5 max-w-[760px] text-[clamp(2.35rem,3.7vw,3.85rem)] font-semibold leading-[.98] tracking-[-.055em]">
                Fiecare mesaj, pregătit
                <span className="gmail-workspace__hero-gradient block">pentru pasul următor.</span>
              </h1>
              <p className="gmail-workspace__hero-copy mt-5 max-w-2xl text-sm leading-7 md:text-base">
                Pregătești comunicarea în Imodeus, trimiți din Gmail, iar răspunsurile și documentele se așază în dosarul corect.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { label: activeTemplateCount + ' active în email', Icon: Files },
                  { label: 'Proprietar + cumpărător', Icon: UserRound },
                  { label: 'Fără acces OAuth la inbox', Icon: ShieldCheck },
                ].map(({ label, Icon }) => (
                  <span key={label} className="gmail-workspace__feature-pill inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="gmail-workspace__connection-card relative overflow-hidden rounded-[26px] border p-5 md:p-6">
              <div className="flex items-start gap-4">
                <div className="gmail-workspace__gmail-mark grid h-12 w-12 shrink-0 place-items-center rounded-2xl">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">Contul Gmail al agentului</p>
                    <span className="gmail-workspace__status-pill inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.12em]">
                      {ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
                      {ready ? 'Conectat' : 'Local'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    {runnerStatus
                      ? statusLabel[runnerStatus.state]
                      : isDesktop
                        ? 'Verific sesiunea Gmail'
                        : 'Necesită Imodeus Desktop'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--app-muted-foreground)]">
                    {runnerStatus?.message || 'Autentificarea rămâne doar pe acest calculator.'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => void connectGmail()}
                className="gmail-workspace__primary-action mt-4 h-11 w-full rounded-2xl"
              >
                {runnerStatus?.state === 'starting' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                )}
                {ready ? 'Deschide Gmail' : 'Conectează contul Gmail'}
              </Button>
              <div className="gmail-workspace__forwarding-wrap mt-4 border-t pt-4">
                <GmailForwardingSetup compact className="gmail-workspace__forwarding-card" />
              </div>
            </div>
          </div>

          <div className="gmail-workspace__journey relative mt-7 grid gap-1 border-t pt-5 sm:grid-cols-3">
            {[
              { number: '01', label: 'Pregătești', detail: 'Template + date', Icon: Files },
              { number: '02', label: 'Trimiți din Gmail', detail: 'Verifici și confirmi', Icon: Mail },
              { number: '03', label: 'Urmărești dosarul', detail: 'Răspunsuri + acte', Icon: Inbox },
            ].map(({ number, label, detail, Icon }) => (
              <div key={number} className="gmail-workspace__journey-step relative flex items-center gap-3 rounded-2xl px-3 py-2.5">
                <div className="gmail-workspace__journey-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-blue-600">{number}</p>
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="truncate text-[10px] text-[var(--app-muted-foreground)]">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] space-y-8 px-4 py-8 md:px-8">
        <section className="overflow-hidden rounded-[34px] border border-[var(--app-surface-border)] bg-[radial-gradient(circle_at_90%_0%,rgba(168,85,247,.09),transparent_32%),radial-gradient(circle_at_0%_30%,rgba(6,182,212,.08),transparent_28%),var(--app-surface)] shadow-[0_32px_95px_-70px_rgba(15,23,42,.95)]">
          <div className="border-b border-[var(--app-surface-border)] px-5 py-6 md:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-600">
                  <Sparkles className="h-4 w-4" />
                  Biblioteca agenției
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-.04em] md:text-4xl">
                  Template-uri pentru fiecare parte
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-muted-foreground)]">
                  Selectează destinatarul, găsește momentul tranzacției și personalizează mesajul într-un editor familiar.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative min-w-0 flex-1 sm:min-w-[280px]">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted-foreground)]" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="h-12 rounded-2xl border-[var(--app-surface-border)] bg-[var(--app-surface)] pl-10 shadow-sm"
                    placeholder="Caută după scop sau subiect…"
                  />
                </div>
                <Button
                  className="h-12 rounded-2xl bg-[linear-gradient(135deg,#059669,#10b981)] px-5 text-white shadow-[0_16px_34px_-18px_rgba(5,150,105,.9)] hover:brightness-105"
                  onClick={openNewTemplate}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Template nou
                </Button>
              </div>
            </div>
          </div>

          <Tabs
            value={activeAudience}
            onValueChange={(value) => setActiveAudience(value as TemplateAudience)}
            className="p-4 md:p-6"
          >
            <TabsList className="gmail-audience-tabs grid h-auto w-full grid-cols-2 gap-2 rounded-[22px] p-2">
              {(Object.keys(audienceMeta) as TemplateAudience[]).map((audience) => {
                const meta = audienceMeta[audience];
                const AudienceIcon = meta.icon;
                const isActive = activeAudience === audience;
                return (
                  <TabsTrigger
                    key={audience}
                    value={audience}
                    className={cn(
                      'gmail-audience-tab relative min-h-[86px] w-full justify-start overflow-hidden rounded-2xl border px-4 py-3 text-left shadow-none transition-all duration-300',
                      audience === 'owner' ? 'gmail-audience-tab--owner' : 'gmail-audience-tab--buyer'
                    )}
                  >
                    <span className="gmail-audience-tab__glow pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full" />
                    <span className="gmail-audience-tab__icon relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl">
                      <AudienceIcon className="h-5 w-5" />
                    </span>
                    <span className="relative ml-3 min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold">{meta.label}</span>
                        <span className="gmail-audience-tab__count rounded-full px-2 py-0.5 text-[10px] font-semibold">
                          {templateCounts[audience]}
                        </span>
                      </span>
                      <span className="mt-1 hidden truncate text-xs font-normal opacity-65 sm:block">
                        {meta.description}
                      </span>
                    </span>
                    {isActive ? (
                      <span className="gmail-audience-tab__active relative ml-3 hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.13em] md:inline-flex">
                        <CheckCircle2 className="h-3 w-3" />
                        Selectat
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(audienceMeta) as TemplateAudience[]).map((audience) => {
              const meta = audienceMeta[audience];
              const roleTemplates = templatesByAudience[audience];
              return (
                <TabsContent key={audience} value={audience} className="mt-6 focus-visible:ring-0">
                  <div className="mb-5 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', audience === 'owner' ? 'bg-cyan-500' : 'bg-fuchsia-500')} />
                      <p className="text-sm font-semibold">
                        {roleTemplates.length} template-uri · {activeTemplateCounts[audience]} active în email
                      </p>
                    </div>
                    <p className="text-xs text-[var(--app-muted-foreground)]">
                      Documente <span className="mx-1.5 opacity-45">→</span> Programare <span className="mx-1.5 opacity-45">→</span> Finalizare
                    </p>
                  </div>

                  {roleTemplates.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {roleTemplates.map((template) => {
                        const visual = templateVisual(template);
                        const Glyph = visual.Glyph;
                        const enabledInComposer = enabledTemplateIdSet.has(template.id);
                        const updatingPreference = updatingTemplateIds.has(template.id);
                        const personalized = personalizedTemplateIds.has(template.id);
                        return (
                          <article
                            key={template.id}
                            className={cn(
                              'gmail-template-card group relative flex min-h-[340px] flex-col overflow-hidden rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-5 shadow-[0_24px_75px_-58px_rgba(15,23,42,.95)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_34px_85px_-58px_rgba(15,23,42,.9)]',
                              enabledInComposer && 'gmail-template-card--enabled'
                            )}
                          >
                            <div className={cn('absolute inset-x-0 top-0 h-1', visual.bar)} />
                            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-white/0 to-emerald-400/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                            <div className="relative flex items-start justify-between gap-3">
                              <div className={cn('grid h-12 w-12 place-items-center rounded-2xl', visual.icon)}>
                                <Glyph className="h-5 w-5" />
                              </div>
                              <div className="flex gap-1">
                                {personalized ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                    title="Revino la versiunea standard"
                                    disabled={updatingPreference}
                                    onClick={() => void resetTemplateOverride(template)}
                                  >
                                    {updatingPreference ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                  </Button>
                                ) : null}
                                {!template.isSystem ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl text-[var(--app-muted-foreground)] hover:text-[var(--app-page-foreground)]"
                                    title="Duplică template-ul"
                                    onClick={() => void duplicate(template)}
                                  >
                                    <CopyPlus className="h-4 w-4" />
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-xl text-[var(--app-muted-foreground)] hover:text-[var(--app-page-foreground)]"
                                  title="Editează doar pentru mine"
                                  onClick={() => {
                                    setEditingTemplate(template);
                                    setEditorOpen(true);
                                  }}
                                >
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="relative mt-5 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn('rounded-full text-[10px]', visual.pill)}>
                                {visual.label}
                              </Badge>
                              <Badge variant="outline" className="rounded-full text-[10px]">
                                {template.isSystem
                                  ? 'Imodeus'
                                  : template.approvalStatus === 'approved'
                                    ? 'Aprobat'
                                    : 'Draft personal'}
                              </Badge>
                              {personalized ? (
                                <Badge className="rounded-full border border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
                                  <ShieldCheck className="mr-1 h-3 w-3" />
                                  Personalizat de tine
                                </Badge>
                              ) : null}
                            </div>

                            <h3 className="relative mt-4 text-lg font-semibold leading-6 tracking-[-.015em]">
                              {template.name.replace(meta.label + ' · ', '')}
                            </h3>
                            <p className="relative mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--app-muted-foreground)]">
                              {template.description}
                            </p>

                            <div className={cn(
                              'gmail-template-visibility relative mt-5 flex items-center justify-between gap-3 rounded-2xl border p-3',
                              enabledInComposer && 'gmail-template-visibility--enabled'
                            )}>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold">
                                  {enabledInComposer ? 'Vizibil în pagina de email' : 'Ascuns din pagina de email'}
                                </p>
                                <p className="mt-0.5 text-[10px] leading-4 text-[var(--app-muted-foreground)]">
                                  {enabledInComposer ? 'Apare în selectorul tău personal.' : 'Activează-l dacă vrei să îl folosești.'}
                                </p>
                              </div>
                              {updatingPreference ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-600" />
                              ) : (
                                <Switch
                                  checked={enabledInComposer}
                                  onCheckedChange={(checked) => void setTemplateEnabledForComposer(template.id, checked)}
                                  aria-label={enabledInComposer ? 'Ascunde template-ul din pagina de email' : 'Activează template-ul în pagina de email'}
                                />
                              )}
                            </div>

                            <div className="relative mt-auto pt-5">
                              <div className="rounded-2xl border border-[var(--app-surface-border)] bg-muted/35 p-3.5 transition-colors group-hover:bg-muted/50">
                                <p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--app-muted-foreground)]">
                                  Subiect Gmail
                                </p>
                                <p className="mt-1.5 line-clamp-1 text-sm font-medium">{template.subject}</p>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid min-h-[260px] place-items-center rounded-[28px] border border-dashed border-[var(--app-surface-border)] bg-[var(--app-surface)]/60 p-8 text-center">
                      <div>
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-[var(--app-muted-foreground)]">
                          <Search className="h-5 w-5" />
                        </div>
                        <h3 className="mt-4 font-semibold">Niciun template găsit</h3>
                        <p className="mt-1 text-sm text-[var(--app-muted-foreground)]">
                          Schimbă termenul de căutare sau creează un template nou pentru {meta.label.toLocaleLowerCase('ro')}.
                        </p>
                      </div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </section>

        <section className="gmail-workspace__guide relative overflow-hidden rounded-[30px] border p-5 md:p-7">
          <div className="gmail-workspace__guide-glow pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full" />
          <div className="relative">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="gmail-workspace__guide-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.18em]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Flux fără acces la inbox
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-[-.035em] md:text-3xl">
                  Clientul răspunde firesc. Imodeus ține evidența.
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-muted-foreground)]">
                  Fără cont nou, fără linkuri speciale și fără schimbarea obiceiurilor clientului.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="gmail-workspace__assurance-pill rounded-full px-3 py-1.5 text-[10px] font-semibold">Agentul apasă Trimite</span>
                <span className="gmail-workspace__assurance-pill rounded-full px-3 py-1.5 text-[10px] font-semibold">Audit în dosar</span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {[
                {
                  number: '01',
                  title: 'Compunere în Imodeus',
                  detail: 'Template-ul și datele tranzacției sunt pregătite înainte de deschiderea Gmail.',
                  Icon: Laptop2,
                },
                {
                  number: '02',
                  title: 'Răspuns normal pe email',
                  detail: 'Proprietarul sau cumpărătorul folosește simplu butonul Răspunde.',
                  Icon: Mail,
                },
                {
                  number: '03',
                  title: 'Documente în dosar',
                  detail: 'Forwardingul asociază răspunsurile și fișierele tranzacției corecte.',
                  Icon: Cloud,
                },
              ].map(({ number, title, detail, Icon }) => (
                <div key={title} className="gmail-workspace__guide-step rounded-[20px] border p-4">
                  <div className="flex items-center justify-between">
                    <div className="gmail-workspace__guide-icon grid h-10 w-10 place-items-center rounded-xl">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-bold tracking-[.18em] text-blue-600">{number}</span>
                  </div>
                  <p className="mt-4 text-sm font-semibold">{title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[var(--app-muted-foreground)]">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <SalesOperationsPanel />
      </div>

      <GmailTemplateEditorDialog
        open={editorOpen}
        template={editingTemplate}
        defaultRecipientRole={activeAudience}
        saving={saving}
        onOpenChange={(next) => {
          setEditorOpen(next);
          if (!next) setEditingTemplate(null);
        }}
        onSave={saveTemplate}
      />

      <style jsx global>{`
        .gmail-workspace .gmail-workspace__hero {
          color: var(--app-page-foreground) !important;
          border-color: color-mix(in srgb, var(--app-surface-border) 82%, #bfdbfe) !important;
          background:
            radial-gradient(circle at 100% 0%, rgba(96, 165, 250, .13), transparent 34%),
            radial-gradient(circle at 12% 115%, rgba(167, 139, 250, .08), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,.98), rgba(247,250,255,.98)) !important;
          box-shadow: 0 28px 70px -50px rgba(30, 64, 175, .34);
        }
        .gmail-workspace__accent-line {
          background: linear-gradient(90deg, #0ea5e9 0%, #2563eb 36%, #6366f1 68%, #a855f7 100%) !important;
          box-shadow: 0 4px 18px -7px rgba(79,70,229,.75);
        }
        .gmail-workspace__hero-pattern {
          opacity: .34;
          background-image: radial-gradient(rgba(59,130,246,.17) .75px, transparent .75px) !important;
          background-size: 18px 18px !important;
          mask-image: linear-gradient(115deg, transparent 8%, rgba(0,0,0,.68) 58%, transparent 94%);
        }
        .gmail-workspace__hero-glow,
        .gmail-workspace__guide-glow {
          background: rgba(96, 165, 250, .17) !important;
          filter: blur(38px);
        }
        .gmail-workspace__hero-glow--secondary {
          background: rgba(167,139,250,.12) !important;
          filter: blur(48px);
        }
        .gmail-workspace__hero-eyebrow,
        .gmail-workspace__guide-badge {
          color: #2563eb !important;
          border: 1px solid rgba(59, 130, 246, .14);
          background: rgba(239, 246, 255, .92) !important;
        }
        .gmail-workspace__hero-title {
          color: var(--app-page-foreground) !important;
          text-wrap: balance;
        }
        .gmail-workspace__hero-gradient {
          background: linear-gradient(90deg, #0f76bd 0%, #4f46e5 52%, #8b5cf6 100%) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
        }
        .gmail-workspace__hero-copy { color: var(--app-muted-foreground) !important; }
        .gmail-workspace__feature-pill {
          color: #415472 !important;
          border: 1px solid rgba(148, 163, 184, .19);
          background: rgba(255,255,255,.84) !important;
          box-shadow: 0 10px 24px -20px rgba(15,23,42,.5);
          transition: transform .2s ease, border-color .2s ease, box-shadow .2s ease;
        }
        .gmail-workspace__feature-pill:hover {
          transform: translateY(-1px);
          border-color: rgba(59,130,246,.24);
          box-shadow: 0 14px 28px -22px rgba(37,99,235,.45);
        }
        .gmail-workspace__feature-pill:nth-child(1) svg { color: #2563eb !important; }
        .gmail-workspace__feature-pill:nth-child(2) svg { color: #7c3aed !important; }
        .gmail-workspace__feature-pill:nth-child(3) svg { color: #059669 !important; }
        .gmail-workspace__connection-card {
          border-color: rgba(148, 163, 184, .19) !important;
          background:
            radial-gradient(circle at 100% 0%, rgba(219,234,254,.7), transparent 40%),
            rgba(255,255,255,.9) !important;
          box-shadow: 0 28px 65px -44px rgba(30,64,175,.48), inset 0 1px rgba(255,255,255,.98);
          backdrop-filter: blur(18px);
        }
        .gmail-workspace__connection-card::before {
          content: '';
          position: absolute;
          inset: 0 auto 0 0;
          width: 3px;
          background: linear-gradient(180deg, #ef4444, #f59e0b 32%, #22c55e 66%, #3b82f6) !important;
          opacity: .85;
        }
        .gmail-workspace__gmail-mark {
          color: #ef4444 !important;
          background: #fff !important;
          border: 1px solid rgba(239,68,68,.12);
          box-shadow: 0 12px 28px -20px rgba(239,68,68,.55);
        }
        .gmail-workspace__status-pill {
          color: #047857 !important;
          border: 1px solid rgba(16,185,129,.16);
          background: rgba(236,253,245,.9) !important;
        }
        .gmail-workspace__primary-action,
        .gmail-forwarding-compact__action,
        .sales-operations-panel__save {
          color: #fff !important;
          background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
          box-shadow: 0 16px 34px -20px rgba(37,99,235,.72);
        }
        .gmail-workspace__primary-action:hover,
        .gmail-forwarding-compact__action:hover,
        .sales-operations-panel__save:hover { filter: brightness(1.05); }
        .gmail-workspace__forwarding-wrap { border-color: rgba(148,163,184,.18) !important; }
        .gmail-workspace__forwarding-card {
          color: var(--app-page-foreground) !important;
          border: 0 !important;
          background: transparent !important;
          padding: 0 !important;
          backdrop-filter: none !important;
        }
        .gmail-workspace__forwarding-card .text-white,
        .gmail-workspace__forwarding-card [class*='text-white/'] {
          color: var(--app-muted-foreground) !important;
        }
        .gmail-workspace__forwarding-card p.font-semibold { color: var(--app-page-foreground) !important; }
        .gmail-workspace__forwarding-card > button,
        .gmail-workspace__forwarding-card .gmail-forwarding-compact__action {
          color: #fff !important;
          background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
        }
        .gmail-workspace__forwarding-card .gmail-forwarding-compact__refresh {
          color: #475569 !important;
          border: 1px solid rgba(148,163,184,.18);
          background: rgba(248,250,252,.88) !important;
        }
        .gmail-workspace__forwarding-card code { color: #415472 !important; }
        .gmail-workspace__forwarding-card > .mt-4 {
          border-color: rgba(148,163,184,.18) !important;
          background: rgba(248,250,252,.9) !important;
        }
        .gmail-workspace__journey { border-color: rgba(148,163,184,.18) !important; }
        .gmail-workspace__journey-step {
          z-index: 1;
          background: transparent !important;
          transition: transform .2s ease, background .2s ease;
        }
        .gmail-workspace__journey-step:hover {
          transform: translateY(-1px);
          background: rgba(239,246,255,.76) !important;
        }
        .gmail-workspace__journey-icon {
          color: #2563eb !important;
          background: linear-gradient(145deg, rgba(219,234,254,.92), rgba(238,242,255,.9)) !important;
          border: 1px solid rgba(59,130,246,.08);
          box-shadow: 0 10px 22px -18px rgba(37,99,235,.55);
        }

        .gmail-audience-tabs {
          border: 1px solid rgba(148,163,184,.18) !important;
          background: linear-gradient(145deg, rgba(241,245,249,.92), rgba(248,250,252,.96)) !important;
          box-shadow: inset 0 1px rgba(255,255,255,.9);
        }
        .gmail-audience-tab {
          border-color: transparent !important;
          background: rgba(255,255,255,.3) !important;
          color: var(--app-muted-foreground) !important;
          box-shadow: none !important;
        }
        .gmail-audience-tab:hover {
          color: var(--app-page-foreground) !important;
          background: rgba(255,255,255,.72) !important;
        }
        .gmail-audience-tab[data-state='active'] {
          color: var(--app-page-foreground) !important;
          box-shadow: 0 18px 36px -26px rgba(30,64,175,.46), inset 0 1px rgba(255,255,255,.96) !important;
        }
        .gmail-audience-tab--owner[data-state='active'] {
          border-color: rgba(37,99,235,.18) !important;
          background: linear-gradient(135deg, rgba(239,246,255,.98), rgba(238,242,255,.96)) !important;
        }
        .gmail-audience-tab--buyer[data-state='active'] {
          border-color: rgba(139,92,246,.18) !important;
          background: linear-gradient(135deg, rgba(245,243,255,.98), rgba(253,244,255,.94)) !important;
        }
        .gmail-audience-tab__glow {
          opacity: 0;
          filter: blur(26px);
          transition: opacity .3s ease;
        }
        .gmail-audience-tab--owner[data-state='active'] .gmail-audience-tab__glow {
          opacity: .34;
          background: #60a5fa !important;
        }
        .gmail-audience-tab--buyer[data-state='active'] .gmail-audience-tab__glow {
          opacity: .28;
          background: #c084fc !important;
        }
        .gmail-audience-tab__icon {
          color: #64748b !important;
          background: rgba(226,232,240,.72) !important;
          transition: all .25s ease;
        }
        .gmail-audience-tab--owner[data-state='active'] .gmail-audience-tab__icon {
          color: #fff !important;
          background: linear-gradient(135deg, #0284c7, #2563eb) !important;
          box-shadow: 0 12px 24px -14px rgba(37,99,235,.8);
        }
        .gmail-audience-tab--buyer[data-state='active'] .gmail-audience-tab__icon {
          color: #fff !important;
          background: linear-gradient(135deg, #7c3aed, #a855f7) !important;
          box-shadow: 0 12px 24px -14px rgba(124,58,237,.75);
        }
        .gmail-audience-tab__count {
          color: #64748b !important;
          background: rgba(255,255,255,.72) !important;
          border: 1px solid rgba(148,163,184,.14);
        }
        .gmail-audience-tab__active {
          color: #1d4ed8 !important;
          border: 1px solid rgba(59,130,246,.13);
          background: rgba(255,255,255,.72) !important;
        }
        .gmail-audience-tab--buyer .gmail-audience-tab__active {
          color: #7c3aed !important;
          border-color: rgba(139,92,246,.13);
        }
        .gmail-audience-tab[data-state='active']::after {
          content: '';
          position: absolute;
          left: 18px;
          right: 18px;
          bottom: 0;
          height: 3px;
          border-radius: 999px 999px 0 0;
        }
        .gmail-audience-tab--owner[data-state='active']::after {
          background: linear-gradient(90deg, #0ea5e9, #2563eb) !important;
        }
        .gmail-audience-tab--buyer[data-state='active']::after {
          background: linear-gradient(90deg, #7c3aed, #d946ef) !important;
        }

        .gmail-template-card--enabled {
          border-color: rgba(37,99,235,.24) !important;
          box-shadow: 0 28px 75px -54px rgba(37,99,235,.48), inset 0 0 0 1px rgba(59,130,246,.05) !important;
        }
        .gmail-template-visibility {
          border-color: rgba(148,163,184,.18) !important;
          background: rgba(248,250,252,.86) !important;
        }
        .gmail-template-visibility--enabled {
          border-color: rgba(59,130,246,.18) !important;
          background: linear-gradient(135deg, rgba(239,246,255,.96), rgba(238,242,255,.9)) !important;
        }

        .gmail-workspace__guide {
          border-color: color-mix(in srgb, var(--app-surface-border) 82%, #bfdbfe) !important;
          background:
            radial-gradient(circle at 100% 0%, rgba(147,197,253,.12), transparent 35%),
            linear-gradient(145deg, rgba(255,255,255,.98), rgba(248,250,252,.98)) !important;
          box-shadow: 0 24px 60px -50px rgba(37,55,88,.42);
        }
        .gmail-workspace__assurance-pill {
          color: #475569 !important;
          border: 1px solid rgba(148,163,184,.17);
          background: rgba(255,255,255,.82) !important;
        }
        .gmail-workspace__guide-step {
          border-color: rgba(148,163,184,.18) !important;
          background: rgba(255,255,255,.74) !important;
          transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .gmail-workspace__guide-step:hover {
          transform: translateY(-2px);
          border-color: rgba(59,130,246,.22) !important;
          box-shadow: 0 16px 34px -28px rgba(37,99,235,.4);
        }
        .gmail-workspace__guide-icon {
          color: #2563eb !important;
          background: rgba(219,234,254,.72) !important;
        }

        .sales-operations-panel {
          background: rgba(255,255,255,.94) !important;
          box-shadow: 0 24px 60px -50px rgba(37,55,88,.42);
        }
        .sales-operations-panel__shield {
          color: #2563eb !important;
          background: rgba(219,234,254,.72) !important;
        }
        .sales-operations-panel__capability,
        .sales-operations-panel__policies,
        .sales-operations-panel__field,
        .sales-operations-panel__toggle {
          background: rgba(248,250,252,.82) !important;
        }
        .sales-operations-panel__capability:hover { border-color: rgba(59,130,246,.22) !important; }
        .sales-operations-panel__summary { list-style: none; }
        .sales-operations-panel__summary::-webkit-details-marker { display: none; }
        .sales-operations-panel__chevron { transition: transform .2s ease; }
        .sales-operations-panel__policies[open] .sales-operations-panel__chevron { transform: rotate(180deg); }

        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__hero {
          background:
            radial-gradient(circle at 100% 0%, rgba(96,165,250,.13), transparent 34%),
            radial-gradient(circle at 12% 115%, rgba(167,139,250,.08), transparent 30%),
            linear-gradient(145deg, rgba(255,255,255,.98), rgba(247,250,255,.98)) !important;
          color: var(--app-page-foreground) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__hero-title,
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__connection-card,
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__forwarding-card {
          color: var(--app-page-foreground) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__hero-gradient {
          background: linear-gradient(90deg, #0f76bd, #4f46e5 52%, #8b5cf6) !important;
          -webkit-background-clip: text !important;
          background-clip: text !important;
          color: transparent !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__primary-action,
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-forwarding-compact__action,
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .sales-operations-panel__save {
          color: #fff !important;
          background: linear-gradient(135deg, #2563eb, #4f46e5) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-audience-tab--owner[data-state='active'] {
          background: linear-gradient(135deg, rgba(239,246,255,.98), rgba(238,242,255,.96)) !important;
          color: var(--app-page-foreground) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-audience-tab--buyer[data-state='active'] {
          background: linear-gradient(135deg, rgba(245,243,255,.98), rgba(253,244,255,.94)) !important;
          color: var(--app-page-foreground) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-audience-tab--owner[data-state='active'] .gmail-audience-tab__icon {
          color: #fff !important;
          background: linear-gradient(135deg, #0284c7, #2563eb) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-audience-tab--buyer[data-state='active'] .gmail-audience-tab__icon {
          color: #fff !important;
          background: linear-gradient(135deg, #7c3aed, #a855f7) !important;
        }
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .gmail-workspace__guide,
        [data-app-theme='agentfinder'] .agentfinder-form .gmail-workspace .sales-operations-panel {
          background: rgba(255,255,255,.95) !important;
        }

        @media (max-width: 767px) {
          .gmail-workspace__hero-title { font-size: 2.55rem; }
          .gmail-audience-tab { min-width: 0; }
        }
      `}</style>
    </div>
  );
}
