'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { DesktopGmailRunnerStatus } from '@/lib/desktop/gmail-runner';
import { DEFAULT_SALES_EMAIL_TEMPLATES } from '@/lib/sales';
import type { SaleParticipantRole, SalesEmailTemplate } from '@/lib/types';
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
  const [isDesktop, setIsDesktop] = useState(false);
  const [runnerStatus, setRunnerStatus] = useState<DesktopGmailRunnerStatus | null>(null);

  const templatesQuery = useMemoFirebase(
    () => agencyId ? collection(firestore, 'agencies', agencyId, 'salesEmailTemplates') : null,
    [agencyId, firestore]
  );
  const { data: customTemplates } = useCollection<SalesEmailTemplate>(templatesQuery);
  const templates = useMemo(
    () => [
      ...DEFAULT_SALES_EMAIL_TEMPLATES,
      ...(customTemplates || []).filter(
        (item) => item.createdByUid === userProfile?.id || item.approvalStatus === 'approved' || userProfile?.role === 'admin'
      ),
    ],
    [customTemplates, userProfile?.id, userProfile?.role]
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
    setSaving(true);
    try {
      const editCustom = Boolean(editingTemplate && !editingTemplate.isSystem);
      await apiRequest(
        editCustom ? '/api/sales/templates/' + editingTemplate!.id : '/api/sales/templates',
        {
          method: editCustom ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...draft,
            name: editingTemplate?.isSystem ? draft.name + ' — personalizat' : draft.name,
            signatureMode: 'agent',
            variables: ['recipient.name', 'property.title', 'property.address', 'documents.list', 'notary.summary', 'agent.name'],
          }),
        }
      );
      toast({
        title: editCustom ? 'Template actualizat' : 'Template nou salvat',
        description: 'Este disponibil imediat în dosarele de vânzare.',
      });
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
    if (template.isSystem) {
      setEditingTemplate(template);
      setEditorOpen(true);
      return;
    }
    try {
      await apiRequest('/api/sales/templates/' + template.id, { method: 'POST' });
      toast({ title: 'Template duplicat' });
    } catch (error) {
      toast({
        title: 'Template-ul nu a putut fi duplicat',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
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
    <div className="min-h-full bg-[var(--app-page-background)] pb-16 text-[var(--app-page-foreground)]">
      <section className="relative isolate overflow-hidden rounded-b-[44px] bg-[radial-gradient(circle_at_7%_0%,rgba(59,130,246,.42),transparent_31%),radial-gradient(circle_at_82%_-5%,rgba(236,72,153,.32),transparent_28%),radial-gradient(circle_at_55%_105%,rgba(16,185,129,.24),transparent_34%),linear-gradient(135deg,#07121f_0%,#102c4b_48%,#173f37_100%)] px-5 py-8 text-white shadow-[0_44px_120px_-55px_rgba(2,6,23,.98)] md:px-9 md:py-11">
        <div className="pointer-events-none absolute -right-20 -top-28 h-96 w-96 rounded-full border border-white/5" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="relative mx-auto max-w-[1500px]">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(380px,.9fr)] xl:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.2em] text-blue-100 backdrop-blur-xl">
                <WandSparkles className="h-3.5 w-3.5" />
                Gmail workspace
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-[-.05em] md:text-6xl">
                Fiecare mesaj, pregătit pentru
                <span className="block bg-[linear-gradient(90deg,#8ab4f8,#c4b5fd,#f9a8d4,#86efac)] bg-clip-text text-transparent">
                  momentul potrivit.
                </span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/65 md:text-base">
                Două parcursuri clare — proprietar și cumpărător — cu template-uri pentru documente,
                programări și încheierea elegantă a tranzacției.
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                <Badge className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-white hover:bg-white/[.08]">
                  <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-300" />
                  Fără acces OAuth la inbox
                </Badge>
                <Badge className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-white hover:bg-white/[.08]">
                  <Laptop2 className="mr-1.5 h-3.5 w-3.5 text-blue-300" />
                  Sesiune Gmail locală
                </Badge>
                <Badge className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-white hover:bg-white/[.08]">
                  <Inbox className="mr-1.5 h-3.5 w-3.5 text-amber-300" />
                  Răspunsuri în dosar
                </Badge>
              </div>
              <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2.5">
                {[
                  { value: templateCounts.owner, label: 'pentru proprietar' },
                  { value: templateCounts.buyer, label: 'pentru cumpărător' },
                  { value: '3', label: 'momente-cheie' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[.055] px-4 py-3 backdrop-blur-xl">
                    <div className="text-2xl font-semibold tracking-tight">{item.value}</div>
                    <div className="mt-0.5 text-[11px] text-white/48">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/[.075] p-5 backdrop-blur-2xl">
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#ea4335] shadow-[0_18px_40px_-20px_rgba(255,255,255,.8)]">
                    <Mail className="h-5 w-5" />
                  </div>
                  {ready ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  ) : (
                    <CircleDashed className="h-5 w-5 text-white/45" />
                  )}
                </div>
                <p className="mt-4 font-semibold">
                  {runnerStatus
                    ? statusLabel[runnerStatus.state]
                    : isDesktop
                      ? 'Verific sesiunea Gmail'
                      : 'Necesită Imodeus Desktop'}
                </p>
                <p className="mt-1 min-h-10 text-sm leading-5 text-white/50">
                  {runnerStatus?.message || 'Autentificarea rămâne numai în profilul local al acestui calculator.'}
                </p>
                <Button
                  onClick={() => void connectGmail()}
                  className="mt-4 w-full rounded-xl bg-white text-slate-950 hover:bg-white/90"
                >
                  {runnerStatus?.state === 'starting' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  )}
                  {ready ? 'Deschide Gmail' : 'Conectează contul Gmail'}
                </Button>
              </div>
              <GmailForwardingSetup compact />
            </div>
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
            <TabsList className="grid h-auto w-full grid-cols-2 gap-3 rounded-[26px] bg-slate-950/[.035] p-2 dark:bg-white/[.035]">
              {(Object.keys(audienceMeta) as TemplateAudience[]).map((audience) => {
                const meta = audienceMeta[audience];
                const AudienceIcon = meta.icon;
                return (
                  <TabsTrigger
                    key={audience}
                    value={audience}
                    className={cn(
                      'group relative min-h-[92px] justify-start overflow-hidden rounded-[20px] border border-transparent bg-transparent px-4 py-4 text-left shadow-none transition-all duration-300 data-[state=active]:shadow-[0_18px_55px_-38px_rgba(15,23,42,.75)]',
                      'data-[state=inactive]:hover:bg-[var(--app-surface)]',
                      meta.active
                    )}
                  >
                    <span className={cn('absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl opacity-0 transition-opacity group-data-[state=active]:opacity-100', meta.glow)} />
                    <span className={cn('relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl', meta.iconStyle)}>
                      <AudienceIcon className="h-5 w-5" />
                    </span>
                    <span className="relative ml-3 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-base font-semibold">{meta.label}</span>
                        <Badge variant="outline" className="rounded-full bg-[var(--app-surface)]/70 text-[10px]">
                          {templateCounts[audience]}
                        </Badge>
                      </span>
                      <span className="mt-1 hidden text-xs font-normal opacity-65 sm:block">{meta.description}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {(Object.keys(audienceMeta) as TemplateAudience[]).map((audience) => {
              const meta = audienceMeta[audience];
              const AudienceIcon = meta.icon;
              const roleTemplates = templatesByAudience[audience];
              return (
                <TabsContent key={audience} value={audience} className="mt-6 focus-visible:ring-0">
                  <div className="relative mb-5 overflow-hidden rounded-[26px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] px-5 py-4">
                    <div className={cn('absolute inset-y-0 left-0 w-1 bg-gradient-to-b', meta.accent)} />
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('grid h-11 w-11 place-items-center rounded-2xl', meta.iconStyle)}>
                          <AudienceIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--app-muted-foreground)]">
                            {meta.eyebrow}
                          </p>
                          <p className="mt-1 font-semibold">{meta.label} · {roleTemplates.length} template-uri disponibile</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--app-muted-foreground)]">
                        <UserRound className="h-4 w-4" />
                        Mesaje clare, fără presiune inutilă
                      </div>
                    </div>
                  </div>

                  {roleTemplates.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {roleTemplates.map((template) => {
                        const visual = templateVisual(template);
                        const Glyph = visual.Glyph;
                        return (
                          <article
                            key={template.id}
                            className="group relative flex min-h-[300px] flex-col overflow-hidden rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-5 shadow-[0_24px_75px_-58px_rgba(15,23,42,.95)] transition duration-300 hover:-translate-y-1.5 hover:border-emerald-500/25 hover:shadow-[0_34px_85px_-58px_rgba(15,23,42,.9)]"
                          >
                            <div className={cn('absolute inset-x-0 top-0 h-1', visual.bar)} />
                            <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-white/0 to-emerald-400/5 blur-2xl transition-transform duration-500 group-hover:scale-125" />
                            <div className="relative flex items-start justify-between gap-3">
                              <div className={cn('grid h-12 w-12 place-items-center rounded-2xl', visual.icon)}>
                                <Glyph className="h-5 w-5" />
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-xl text-[var(--app-muted-foreground)] hover:text-[var(--app-page-foreground)]"
                                  title="Duplică template-ul"
                                  onClick={() => void duplicate(template)}
                                >
                                  <CopyPlus className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-xl text-[var(--app-muted-foreground)] hover:text-[var(--app-page-foreground)]"
                                  title="Editează template-ul"
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
                            </div>

                            <h3 className="relative mt-4 text-lg font-semibold leading-6 tracking-[-.015em]">
                              {template.name.replace(meta.label + ' · ', '')}
                            </h3>
                            <p className="relative mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--app-muted-foreground)]">
                              {template.description}
                            </p>

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

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="relative overflow-hidden rounded-[30px] border border-[var(--app-surface-border)] bg-[radial-gradient(circle_at_90%_0%,rgba(16,185,129,.12),transparent_36%),var(--app-surface)] p-6">
            <div className="pointer-events-none absolute -bottom-20 -right-12 h-56 w-56 rounded-full border border-emerald-500/10" />
            <div className="relative flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Cum funcționează fără OAuth</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-muted-foreground)]">
                  Imodeus pregătește mesajul într-o fereastră Gmail locală. Datele de autentificare rămân pe calculator,
                  iar agentul verifică mesajul și apasă personal Trimite.
                </p>
              </div>
            </div>
          </div>
          <SalesOperationsPanel />
        </section>
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
    </div>
  );
}
