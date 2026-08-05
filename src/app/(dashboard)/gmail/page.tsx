'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { ArrowUpRight, CheckCircle2, CircleDashed, Cloud, CopyPlus, Edit3, Inbox, Laptop2, Loader2, Mail, Plus, Search, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { GmailForwardingSetup } from '@/components/sales/GmailForwardingSetup';
import { GmailTemplateEditorDialog, type GmailTemplateDraft } from '@/components/sales/GmailTemplateEditorDialog';
import { SalesOperationsPanel } from '@/components/sales/SalesOperationsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { DesktopGmailRunnerStatus } from '@/lib/desktop/gmail-runner';
import { DEFAULT_SALES_EMAIL_TEMPLATES, participantRoleLabel } from '@/lib/sales';
import type { SalesEmailTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusLabel: Record<DesktopGmailRunnerStatus['state'], string> = {
  idle: 'Pregătit pentru conectare', starting: 'Deschid sesiunea Gmail…', needs_login: 'Autentifică-te în fereastra Gmail', connected: 'Cont Gmail conectat', preparing: 'Pregătesc mesajul', waiting_for_send: 'Mesaj Gmail pregătit', sent_ui_confirmed: 'Trimitere confirmată', stopped: 'Sesiune închisă', error: 'Conexiunea necesită atenție',
};

export default function GmailPage() {
  const firestore = useFirestore();
  const { agencyId, user, userProfile } = useAgency();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalesEmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [runnerStatus, setRunnerStatus] = useState<DesktopGmailRunnerStatus | null>(null);
  const templatesQuery = useMemoFirebase(() => agencyId ? collection(firestore, 'agencies', agencyId, 'salesEmailTemplates') : null, [agencyId, firestore]);
  const { data: customTemplates } = useCollection<SalesEmailTemplate>(templatesQuery);
  const templates = useMemo(() => [...DEFAULT_SALES_EMAIL_TEMPLATES, ...(customTemplates || []).filter((item) => item.createdByUid === userProfile?.id || item.approvalStatus === 'approved' || userProfile?.role === 'admin')], [customTemplates, userProfile?.id, userProfile?.role]);
  const visibleTemplates = useMemo(() => {
    const value = search.trim().toLocaleLowerCase('ro');
    return templates.filter((template) => !value || [template.name, template.description, template.subject, participantRoleLabel(template.recipientRole)].join(' ').toLocaleLowerCase('ro').includes(value));
  }, [search, templates]);

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
    const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || 'Operațiunea nu a putut fi finalizată.');
    return payload;
  }, [user]);

  const connectGmail = async () => {
    if (!isDesktop || typeof window.imodeusDesktop?.connectGmailRunner !== 'function') {
      toast({ title: 'Deschide Imodeus Desktop', description: 'Conectarea fără OAuth folosește profilul Gmail local din aplicația desktop.' }); return;
    }
    try { setRunnerStatus(await window.imodeusDesktop.connectGmailRunner()); }
    catch (error) { toast({ title: 'Gmail nu a putut fi deschis', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' }); }
  };

  const saveTemplate = async (draft: GmailTemplateDraft) => {
    if (!draft.name || !draft.subject || !draft.body) { toast({ title: 'Template incomplet', description: 'Completează numele, subiectul și mesajul.', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const editCustom = Boolean(editingTemplate && !editingTemplate.isSystem);
      await apiRequest(editCustom ? `/api/sales/templates/${editingTemplate!.id}` : '/api/sales/templates', { method: editCustom ? 'PATCH' : 'POST', body: JSON.stringify({ ...draft, name: editingTemplate?.isSystem ? `${draft.name} — personalizat` : draft.name, signatureMode: 'agent', variables: ['recipient.name', 'property.title', 'property.address', 'documents.list', 'notary.summary', 'agent.name'] }) });
      toast({ title: editCustom ? 'Template actualizat' : 'Template nou salvat', description: 'Este disponibil imediat în dosarele de vânzare.' });
      setEditorOpen(false); setEditingTemplate(null);
    } catch (error) { toast({ title: 'Template-ul nu a putut fi salvat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  const duplicate = async (template: SalesEmailTemplate) => {
    if (template.isSystem) { setEditingTemplate(template); setEditorOpen(true); return; }
    try { await apiRequest(`/api/sales/templates/${template.id}`, { method: 'POST' }); toast({ title: 'Template duplicat' }); }
    catch (error) { toast({ title: 'Template-ul nu a putut fi duplicat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' }); }
  };

  const ready = runnerStatus?.state === 'connected' || ['preparing', 'waiting_for_send', 'sent_ui_confirmed'].includes(runnerStatus?.state || '');
  return (
    <div className="min-h-full bg-[var(--app-page-background)] pb-16 text-[var(--app-page-foreground)]">
      <section className="relative overflow-hidden rounded-b-[38px] bg-[radial-gradient(circle_at_8%_5%,rgba(66,133,244,.35),transparent_30%),radial-gradient(circle_at_82%_5%,rgba(234,67,53,.28),transparent_25%),linear-gradient(140deg,#081827_0%,#102b48_52%,#143e35_100%)] px-5 py-8 text-white shadow-[0_38px_110px_-52px_rgba(2,6,23,.95)] md:px-9 md:py-10">
        <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full border border-white/5" />
        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.2em] text-blue-100"><WandSparkles className="h-3.5 w-3.5" /> Gmail workspace</div>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-.045em] md:text-6xl">Comunicarea unei vânzări, <span className="bg-[linear-gradient(90deg,#8ab4f8,#81c995,#fdd663)] bg-clip-text text-transparent">fără haos.</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/62 md:text-base">Conectezi Gmail local, pregătești template-uri memorabile și urmărești răspunsurile fără ca agentul sau clientul să învețe un instrument nou.</p>
            <div className="mt-6 flex flex-wrap gap-2"><Badge className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-white hover:bg-white/[.08]"><ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-300" /> Fără acces OAuth la inbox</Badge><Badge className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-white hover:bg-white/[.08]"><Laptop2 className="mr-1.5 h-3.5 w-3.5 text-blue-300" /> Sesiune locală</Badge><Badge className="rounded-full border border-white/10 bg-white/[.08] px-3 py-1.5 text-white hover:bg-white/[.08]"><Inbox className="mr-1.5 h-3.5 w-3.5 text-amber-300" /> Răspunsuri în dosar</Badge></div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[26px] border border-white/10 bg-white/[.07] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-[#ea4335] shadow-lg"><Mail className="h-5 w-5" /></div>{ready ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <CircleDashed className="h-5 w-5 text-white/45" />}</div>
              <p className="mt-4 font-semibold">{runnerStatus ? statusLabel[runnerStatus.state] : isDesktop ? 'Verific sesiunea Gmail' : 'Necesită Imodeus Desktop'}</p>
              <p className="mt-1 min-h-10 text-sm leading-5 text-white/50">{runnerStatus?.message || 'Autentificarea rămâne numai în profilul local al acestui calculator.'}</p>
              <Button onClick={() => void connectGmail()} className="mt-4 w-full rounded-xl bg-white text-slate-950 hover:bg-white/90">{runnerStatus?.state === 'starting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}{ready ? 'Deschide Gmail' : 'Conectează contul Gmail'}</Button>
            </div>
            <GmailForwardingSetup compact />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] space-y-8 px-4 py-8 md:px-8">
        <section>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-emerald-600"><Sparkles className="h-4 w-4" /> Biblioteca agenției</div><h2 className="mt-2 text-3xl font-semibold tracking-[-.035em]">Template-uri care sună uman</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-muted-foreground)]">Fiecare agent își poate crea mesajele; cele aprobate rămân disponibile echipei.</p></div><div className="flex gap-2"><div className="relative min-w-[250px] flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted-foreground)]" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 rounded-xl pl-10" placeholder="Caută template…" /></div><Button className="h-11 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { setEditingTemplate(null); setEditorOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Template nou</Button></div></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((template, index) => (
              <article key={template.id} className="group relative overflow-hidden rounded-[28px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-5 shadow-[0_24px_75px_-55px_rgba(15,23,42,.95)] transition duration-300 hover:-translate-y-1 hover:border-emerald-500/30">
                <div className={cn('absolute inset-x-0 top-0 h-1', index % 3 === 0 ? 'bg-[linear-gradient(90deg,#4285f4,#34a853)]' : index % 3 === 1 ? 'bg-[linear-gradient(90deg,#ea4335,#fbbc04)]' : 'bg-[linear-gradient(90deg,#a855f7,#4285f4)]')} />
                <div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600"><Mail className="h-5 w-5" /></div><div className="flex gap-1"><Button variant="ghost" size="icon" className="rounded-xl" title="Duplică" onClick={() => void duplicate(template)}><CopyPlus className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="rounded-xl" title="Editează" onClick={() => { setEditingTemplate(template); setEditorOpen(true); }}><Edit3 className="h-4 w-4" /></Button></div></div>
                <div className="mt-5 flex items-center gap-2"><Badge variant="outline" className="rounded-full">{participantRoleLabel(template.recipientRole)}</Badge><Badge variant="outline" className="rounded-full text-[10px]">{template.isSystem ? 'Imodeus' : template.approvalStatus === 'approved' ? 'Aprobat' : 'Draft personal'}</Badge></div>
                <h3 className="mt-4 text-lg font-semibold">{template.name}</h3><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--app-muted-foreground)]">{template.description}</p>
                <div className="mt-5 rounded-2xl bg-muted/45 p-3"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--app-muted-foreground)]">Subiect</p><p className="mt-1 line-clamp-1 text-sm font-medium">{template.subject}</p></div>
              </article>
            ))}
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_420px]"><div className="rounded-[30px] border border-[var(--app-surface-border)] bg-[radial-gradient(circle_at_90%_0%,rgba(16,185,129,.12),transparent_36%),var(--app-surface)] p-6"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/12 text-emerald-600"><Cloud className="h-5 w-5" /></div><div><h3 className="text-lg font-semibold">Cum funcționează fără OAuth</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--app-muted-foreground)]">Imodeus pregătește mesajul într-o fereastră Gmail locală. Datele de autentificare rămân pe calculator, iar agentul verifică mesajul și apasă personal Trimite.</p></div></div></div><SalesOperationsPanel /></section>
      </div>
      <GmailTemplateEditorDialog open={editorOpen} template={editingTemplate} saving={saving} onOpenChange={(next) => { setEditorOpen(next); if (!next) setEditingTemplate(null); }} onSave={saveTemplate} />
    </div>
  );
}
