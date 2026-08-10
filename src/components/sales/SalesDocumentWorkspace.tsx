'use client';

import { useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Download,
  FileArchive,
  FileCheck2,
  FileClock,
  FilePlus2,
  FolderOpen,
  History,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
} from 'lucide-react';

import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import {
  getSaleDocumentFileState,
  getSaleDocumentStages,
  getSaleDocumentSummary,
  hasActiveSaleDocumentFile,
  inferSaleDocumentScope,
  SALE_DOCUMENT_SCOPE_LABELS,
  SALE_DOCUMENT_STATUS_LABELS,
  saleDocumentMatchesStage,
} from '@/lib/sales-documents';
import { participantRoleLabel, SALE_STAGE_META } from '@/lib/sales';
import type {
  SaleChecklistItem,
  SaleChecklistStage,
  SaleDocumentScope,
  SaleParticipant,
  SaleTransaction,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type StatusFilter = 'all' | 'missing' | 'requested' | 'review' | 'verified' | 'archived';

type Props = {
  sale: SaleTransaction;
  checklist: SaleChecklistItem[];
  participants?: SaleParticipant[];
  onChecklistChange: (checklist: SaleChecklistItem[]) => void;
  selectedDocumentIds?: string[];
  onSelectedDocumentIdsChange?: (ids: string[]) => void;
  compact?: boolean;
};

const inputClass = 'border-white/90 bg-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.95),0_10px_26px_-22px_rgba(15,23,42,.55)] placeholder:text-slate-400 focus-visible:border-emerald-300 focus-visible:ring-2 focus-visible:ring-emerald-200';

function currentChecklistStage(sale: SaleTransaction): SaleChecklistStage | 'all' {
  return ['reservation', 'precontract', 'contract'].includes(sale.stage)
    ? sale.stage as SaleChecklistStage
    : 'all';
}

function statusTone(item: SaleChecklistItem) {
  if (item.status === 'verified') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (item.status === 'received_needs_review') return 'border-sky-200 bg-sky-50 text-sky-700';
  if (item.status === 'requested') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (item.status === 'not_required') return 'border-slate-200 bg-slate-50 text-slate-500';
  if (item.status === 'rejected' || item.status === 'expired') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function statusMatches(item: SaleChecklistItem, filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'archived') return getSaleDocumentFileState(item) === 'archived';
  if (filter === 'verified') return item.status === 'verified';
  if (filter === 'review') return item.status === 'received_needs_review';
  if (filter === 'requested') return item.status === 'requested';
  return item.required && !['verified', 'received_needs_review', 'requested', 'not_required'].includes(item.status);
}

function formatBytes(value?: number | null) {
  if (!value) return null;
  if (value < 1024 * 1024) return Math.max(1, Math.round(value / 1024)) + ' KB';
  return (value / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function SalesDocumentWorkspace({
  sale,
  checklist,
  participants = sale.participants || [],
  onChecklistChange,
  selectedDocumentIds,
  onSelectedDocumentIdsChange,
  compact = false,
}: Props) {
  const { user } = useAgency();
  const { toast } = useToast();
  const [stageFilter, setStageFilter] = useState<SaleChecklistStage | 'all'>(currentChecklistStage(sale));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<SaleDocumentScope | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newRole, setNewRole] = useState<'buyer' | 'owner'>('owner');
  const [newScope, setNewScope] = useState<SaleDocumentScope>('property');
  const [newStage, setNewStage] = useState<SaleChecklistStage>(currentChecklistStage(sale) === 'all' ? 'precontract' : currentChecklistStage(sale) as SaleChecklistStage);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [packaging, setPackaging] = useState(false);

  const summary = useMemo(() => getSaleDocumentSummary(checklist, stageFilter), [checklist, stageFilter]);
  const visible = useMemo(() => {
    const normalizedSearch = search.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    return checklist
      .filter((item) => saleDocumentMatchesStage(item, stageFilter))
      .filter((item) => scopeFilter === 'all' || inferSaleDocumentScope(item) === scopeFilter)
      .filter((item) => statusMatches(item, statusFilter))
      .filter((item) => !normalizedSearch || [item.label, item.fileName || '', item.classification || ''].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(normalizedSearch));
  }, [checklist, scopeFilter, search, stageFilter, statusFilter]);

  const request = async (url: string, init?: RequestInit) => {
    if (!user) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
    const token = await user.getIdToken();
    const headers = new Headers(init?.headers || {});
    headers.set('Authorization', 'Bearer ' + token);
    if (!(init?.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...init, headers });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(payload?.message || 'Operațiunea nu a putut fi finalizată.');
    return { response, payload };
  };

  const applyPayload = (payload: { checklist?: SaleChecklistItem[]; document?: SaleChecklistItem }) => {
    if (payload.checklist) {
      onChecklistChange(payload.checklist);
      return;
    }
    const updatedDocument = payload.document;
    if (updatedDocument) onChecklistChange(checklist.map((item) => item.id === updatedDocument.id ? updatedDocument : item));
  };

  const createRequirement = async () => {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      const { payload } = await request('/api/sales/' + sale.id + '/documents', {
        method: 'POST',
        body: JSON.stringify({
          label: newLabel.trim(),
          participantRole: newRole,
          scope: newScope,
          stages: [newStage],
          required: true,
        }),
      });
      applyPayload(payload);
      setNewLabel('');
      setShowCreate(false);
      toast({ title: 'Cerința documentară a fost adăugată' });
    } catch (error) {
      toast({ title: 'Cerința nu a putut fi adăugată', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const documentAction = async (
    item: SaleChecklistItem,
    action: 'analyze' | 'approve' | 'reject' | 'rotate_link' | 'mark_requested' | 'not_required' | 'require' | 'restore_version',
    versionId?: string
  ) => {
    setBusyId(item.id);
    try {
      const { payload } = await request('/api/sales/' + sale.id + '/documents/' + item.id, {
        method: 'POST',
        body: JSON.stringify({ action, versionId }),
      });
      applyPayload(payload);
      const labels: Record<string, string> = {
        approve: 'Document verificat',
        reject: 'Document respins',
        analyze: 'Analiza documentului s-a încheiat',
        rotate_link: 'Linkul documentului a fost reînnoit',
        mark_requested: 'Document marcat ca solicitat',
        not_required: 'Cerința a fost marcată ca nenecesară',
        require: 'Cerința a fost reactivată',
        restore_version: 'Versiunea selectată a fost restaurată',
      };
      toast({ title: labels[action] });
    } catch (error) {
      toast({ title: 'Documentul nu a putut fi actualizat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const uploadDocument = async (item: SaleChecklistItem, file: File) => {
    setBusyId(item.id);
    try {
      const form = new FormData();
      form.set('file', file);
      const { payload } = await request('/api/sales/' + sale.id + '/documents/' + item.id, { method: 'PUT', body: form });
      applyPayload(payload);
      toast({ title: item.storagePath ? 'O versiune nouă a fost încărcată' : 'Documentul a fost încărcat', description: 'Fișierul a intrat în lista „De verificat”.' });
    } catch (error) {
      toast({ title: 'Fișierul nu a putut fi încărcat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const archiveDocument = async (item: SaleChecklistItem) => {
    if (!window.confirm('Arhivezi fișierul „' + (item.fileName || item.label) + '”? Versiunile rămân în istoric.')) return;
    setBusyId(item.id);
    try {
      const { payload } = await request('/api/sales/' + sale.id + '/documents/' + item.id, { method: 'DELETE' });
      applyPayload(payload);
      toast({ title: 'Fișierul a fost arhivat', description: 'Poate fi restaurat din istoricul versiunilor.' });
    } catch (error) {
      toast({ title: 'Fișierul nu a putut fi arhivat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  const downloadPackage = async () => {
    setPackaging(true);
    try {
      const packageStage = stageFilter === 'all' ? currentChecklistStage(sale) : stageFilter;
      const suffix = packageStage === 'all' ? '' : '?stage=' + packageStage;
      const { response } = await request('/api/sales/' + sale.id + '/documents/package' + suffix);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'dosar-' + sale.trackingCode + '-' + (packageStage === 'all' ? 'complet' : packageStage) + '.zip';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Pachetul nu a putut fi generat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setPackaging(false);
    }
  };

  const toggleAttachment = (itemId: string, checked: boolean) => {
    if (!selectedDocumentIds || !onSelectedDocumentIdsChange) return;
    onSelectedDocumentIdsChange(checked
      ? [...new Set([...selectedDocumentIds, itemId])]
      : selectedDocumentIds.filter((id) => id !== itemId));
  };

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-[28px] border border-emerald-200/80 bg-[radial-gradient(circle_at_8%_0%,rgba(167,243,208,.55),transparent_34%),radial-gradient(circle_at_92%_0%,rgba(254,243,199,.62),transparent_28%),rgba(255,255,255,.94)] p-5 shadow-[0_24px_60px_-44px_rgba(5,150,105,.55)]">
        <div className={cn(compact ? 'flex items-center gap-2.5' : 'flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between')}>
          <div className={cn('flex items-center gap-3', compact && 'min-w-0 flex-1 gap-2')}>
            <span className={cn('grid shrink-0 place-items-center border border-emerald-200 bg-white text-emerald-600 shadow-sm', compact ? 'h-9 w-9 rounded-xl' : 'h-12 w-12 rounded-2xl')}><FolderOpen className={compact ? 'h-4 w-4' : 'h-5 w-5'} /></span>
            <div className="min-w-0">
              <p className={cn('whitespace-nowrap font-bold leading-tight text-slate-900', compact ? 'text-sm' : 'text-lg')}>Documentele dosarului</p>
              <p className={cn('whitespace-nowrap text-slate-500', compact ? 'mt-0.5 text-[10px] leading-4' : 'text-sm')}>O singură listă pentru wizard, dosar și email.</p>
            </div>
          </div>
          <div className={cn('items-center', compact ? 'flex shrink-0 flex-nowrap gap-1.5' : 'flex flex-wrap gap-2')}>
            <Button type="button" variant="outline" className={cn('whitespace-nowrap border-emerald-200 bg-white', compact ? 'h-9 rounded-xl px-2.5 text-[11px]' : 'rounded-2xl')} onClick={() => setShowCreate((value) => !value)}><Plus className={cn('text-emerald-600', compact ? 'mr-1 h-3.5 w-3.5' : 'mr-2 h-4 w-4')} />Cerință nouă</Button>
            <Button type="button" className={cn('whitespace-nowrap bg-[linear-gradient(135deg,#10b981,#0d9488)] text-white shadow-[0_14px_28px_-16px_rgba(13,148,136,.7)] hover:brightness-105', compact ? 'h-9 rounded-xl px-2.5 text-[11px]' : 'rounded-2xl')} onClick={downloadPackage} disabled={packaging}>{packaging ? <Loader2 className={cn('animate-spin', compact ? 'mr-1 h-3.5 w-3.5' : 'mr-2 h-4 w-4')} /> : <Download className={compact ? 'mr-1 h-3.5 w-3.5' : 'mr-2 h-4 w-4'} />}Pachet verificat</Button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Verificate', value: summary.verified, icon: <CheckCircle2 className="h-4 w-4" />, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
            { label: 'De verificat', value: summary.review, icon: <FileClock className="h-4 w-4" />, tone: 'text-sky-700 bg-sky-50 border-sky-200' },
            { label: 'Solicitate', value: summary.requested, icon: <Mail className="h-4 w-4" />, tone: 'text-violet-700 bg-violet-50 border-violet-200' },
            { label: 'Lipsesc', value: summary.missing, icon: <ShieldAlert className="h-4 w-4" />, tone: 'text-amber-700 bg-amber-50 border-amber-200' },
          ].map((metric) => (
            <div key={metric.label} className={cn('rounded-2xl border bg-white/80 p-3', metric.tone)}>
              <div className="flex items-center justify-between gap-1"><span className="whitespace-nowrap text-[9px] font-extrabold uppercase tracking-[.04em]">{metric.label}</span><span className="shrink-0">{metric.icon}</span></div>
              <p className="mt-2 text-2xl font-black text-slate-900">{metric.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3"><Progress value={summary.progress} className="h-2.5 flex-1 bg-slate-200" /><span className="text-xs font-bold text-slate-600">{summary.progress}% verificat</span></div>
      </section>

      {showCreate ? (
        <section className="rounded-[25px] border border-sky-200 bg-[linear-gradient(145deg,#f0f9ff,#ffffff_58%,#ecfdf5)] p-4 shadow-[0_20px_48px_-38px_rgba(14,165,233,.55)]">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_160px_170px_auto] lg:items-end">
            <div><Label className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-600">Document necesar</Label><Input value={newLabel} onChange={(event) => setNewLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void createRequirement(); }} className={cn(inputClass, 'mt-1 h-11 rounded-2xl')} placeholder="Ex: Certificat fiscal" /></div>
            <div><Label className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-600">Aparține</Label><Select value={newScope} onValueChange={(value: SaleDocumentScope) => setNewScope(value)}><SelectTrigger className={cn(inputClass, 'mt-1 h-11 rounded-2xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="property">Proprietate</SelectItem><SelectItem value="participant">Participant</SelectItem><SelectItem value="transaction">Tranzacție</SelectItem></SelectContent></Select></div>
            <div><Label className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-600">Parte</Label><Select value={newRole} onValueChange={(value: 'buyer' | 'owner') => setNewRole(value)}><SelectTrigger className={cn(inputClass, 'mt-1 h-11 rounded-2xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Proprietar</SelectItem><SelectItem value="buyer">Cumpărător</SelectItem></SelectContent></Select></div>
            <div><Label className="text-[10px] font-bold uppercase tracking-[.08em] text-slate-600">Etapă</Label><Select value={newStage} onValueChange={(value: SaleChecklistStage) => setNewStage(value)}><SelectTrigger className={cn(inputClass, 'mt-1 h-11 rounded-2xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="reservation">Rezervare</SelectItem><SelectItem value="precontract">Antecontract</SelectItem><SelectItem value="contract">Contract</SelectItem></SelectContent></Select></div>
            <Button type="button" className="h-11 rounded-2xl bg-sky-600 text-white hover:bg-sky-700" onClick={() => void createRequirement()} disabled={creating || !newLabel.trim()}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[25px] border border-slate-200/80 bg-white/80 p-3 shadow-[0_18px_42px_-38px_rgba(15,23,42,.45)]">
        <div className={cn('grid gap-2', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 md:grid-cols-[minmax(220px,1fr)_160px_160px_160px]')}>
          <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className={cn(inputClass, 'h-10 rounded-2xl pl-10')} placeholder="Caută document..." /></div>
          <Select value={stageFilter} onValueChange={(value: SaleChecklistStage | 'all') => setStageFilter(value)}><SelectTrigger className={cn(inputClass, 'h-10 rounded-2xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toate etapele</SelectItem><SelectItem value="reservation">Rezervare</SelectItem><SelectItem value="precontract">Antecontract</SelectItem><SelectItem value="contract">Contract</SelectItem></SelectContent></Select>
          <Select value={statusFilter} onValueChange={(value: StatusFilter) => setStatusFilter(value)}><SelectTrigger className={cn(inputClass, 'h-10 rounded-2xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toate stările</SelectItem><SelectItem value="missing">Lipsesc</SelectItem><SelectItem value="requested">Solicitate</SelectItem><SelectItem value="review">De verificat</SelectItem><SelectItem value="verified">Verificate</SelectItem><SelectItem value="archived">Arhivate</SelectItem></SelectContent></Select>
          {!compact ? <Select value={scopeFilter} onValueChange={(value: SaleDocumentScope | 'all') => setScopeFilter(value)}><SelectTrigger className={cn(inputClass, 'h-10 rounded-2xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Toate categoriile</SelectItem><SelectItem value="property">Proprietate</SelectItem><SelectItem value="participant">Participanți</SelectItem><SelectItem value="transaction">Tranzacție</SelectItem></SelectContent></Select> : null}
        </div>
      </section>

      <div className="space-y-3">
        {visible.map((item) => {
          const stages = getSaleDocumentStages(item);
          const scope = inferSaleDocumentScope(item);
          const hasFile = hasActiveSaleDocumentFile(item);
          const participant = item.participantId ? participants.find((entry) => entry.id === item.participantId) : null;
          const isBusy = busyId === item.id;
          const uploadId = 'sales-document-upload-' + item.id;
          return (
            <article key={item.id} className={cn('relative overflow-hidden rounded-[26px] p-px shadow-[0_20px_48px_-38px_rgba(15,118,110,.48)]', scope === 'property' ? 'bg-[linear-gradient(145deg,#a7f3d0,#ffffff_46%,#fde68a)]' : scope === 'participant' ? 'bg-[linear-gradient(145deg,#bae6fd,#ffffff_46%,#99f6e4)]' : 'bg-[linear-gradient(145deg,#ddd6fe,#ffffff_46%,#bae6fd)]')}>
              <div className="rounded-[25px] bg-white/95 p-4">
                <div className="flex items-start gap-3">
                  {selectedDocumentIds && onSelectedDocumentIdsChange ? <Checkbox checked={selectedDocumentIds.includes(item.id)} disabled={!hasFile} onCheckedChange={(checked) => toggleAttachment(item.id, checked === true)} className="mt-3" /> : null}
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-sm', scope === 'property' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : scope === 'participant' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-violet-200 bg-violet-50 text-violet-700')}>
                    {hasFile ? <FileCheck2 className="h-5 w-5" /> : <FilePlus2 className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900">{item.label}</h3>
                      <Badge variant="outline" className={cn('rounded-full text-[9px] font-extrabold uppercase tracking-[.08em]', statusTone(item))}>{SALE_DOCUMENT_STATUS_LABELS[item.status]}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500">
                      <span>{SALE_DOCUMENT_SCOPE_LABELS[scope]}</span>
                      <span>·</span>
                      <span>{participant?.name || participantRoleLabel(item.participantRole)}</span>
                      {stages.length ? <><span>·</span><span>{stages.map((stage) => SALE_STAGE_META[stage].shortLabel).join(', ')}</span></> : null}
                    </div>
                    {hasFile ? <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5"><div className="flex flex-wrap items-center gap-2 text-xs"><span className="max-w-full truncate font-semibold text-slate-700">{item.fileName}</span><span className="text-slate-400">v{item.version || 1}</span>{formatBytes(item.sizeBytes) ? <span className="text-slate-400">{formatBytes(item.sizeBytes)}</span> : null}</div><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500"><span>Încărcat {formatDate(item.uploadedAt || item.receivedAt)}</span>{typeof item.qualityScore === 'number' ? <span>Calitate {item.qualityScore}%</span> : null}{item.expiresAt ? <span className="text-violet-600">Expiră {formatDate(item.expiresAt)}</span> : null}</div></div> : <p className="mt-3 text-xs text-amber-700">Nu există încă un fișier asociat acestei cerințe.</p>}
                    {item.classification && item.classification !== item.label ? <p className="mt-2 text-[11px] text-sky-700">Sugestie identificată: <span className="font-semibold">{item.classification}</span>{typeof item.classificationConfidence === 'number' ? ' · ' + Math.round(item.classificationConfidence * 100) + '%' : ''}</p> : null}
                    {item.duplicateOfDocumentId ? <p className="mt-2 text-[11px] font-semibold text-amber-700">Posibil duplicat al unui document existent în dosar.</p> : null}
                    {item.extractedTextPreview ? <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-500">{item.extractedTextPreview}</p> : null}
                  </div>
                  {isBusy ? <Loader2 className="mt-3 h-4 w-4 shrink-0 animate-spin text-emerald-600" /> : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <input id={uploadId} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadDocument(item, file); event.currentTarget.value = ''; }} />
                  <Button asChild type="button" size="sm" variant="outline" className="rounded-xl border-emerald-200 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-50"><label htmlFor={uploadId} className="cursor-pointer"><Upload className="mr-1.5 h-3.5 w-3.5" />{hasFile ? 'Versiune nouă' : 'Încarcă'}</label></Button>
                  {hasFile && item.downloadUrl ? <Button asChild type="button" size="sm" variant="outline" className="rounded-xl"><a href={item.downloadUrl} target="_blank" rel="noreferrer"><FolderOpen className="mr-1.5 h-3.5 w-3.5" />Deschide</a></Button> : null}
                  {hasFile && item.status !== 'verified' ? <Button type="button" size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => void documentAction(item, 'approve')}><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Verifică</Button> : null}
                  {hasFile && item.status !== 'rejected' ? <Button type="button" size="sm" variant="ghost" className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void documentAction(item, 'reject')}>Respinge</Button> : null}
                  {!hasFile && item.status !== 'requested' && item.status !== 'not_required' ? <Button type="button" size="sm" variant="outline" className="rounded-xl border-violet-200 bg-violet-50/80 text-violet-800 hover:border-violet-300 hover:bg-violet-100 hover:text-violet-950 focus-visible:ring-violet-200" onClick={() => void documentAction(item, 'mark_requested')}><Mail className="mr-1.5 h-3.5 w-3.5" />Marchează solicitat</Button> : null}
                  {item.status !== 'not_required' ? <Button type="button" size="sm" variant="ghost" className="rounded-xl text-slate-500" onClick={() => void documentAction(item, 'not_required')}>Nu este necesar</Button> : <Button type="button" size="sm" variant="ghost" className="rounded-xl text-emerald-700 hover:bg-emerald-50" onClick={() => void documentAction(item, 'require')}>Reactivează cerința</Button>}
                  {hasFile ? <><Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={() => void documentAction(item, 'analyze')}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Analizează</Button><Button type="button" size="sm" variant="ghost" className="rounded-xl text-slate-500" onClick={() => void archiveDocument(item)}><Archive className="mr-1.5 h-3.5 w-3.5" />Arhivează</Button></> : null}
                </div>

                {item.versions?.length ? (
                  <details className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/65 p-3">
                    <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-slate-600"><History className="h-3.5 w-3.5" />Istoric versiuni · {item.versions.length}</summary>
                    <div className="mt-3 space-y-2">
                      {[...item.versions].sort((left, right) => right.version - left.version).map((version) => (
                        <div key={version.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-[11px]">
                          <FileArchive className="h-3.5 w-3.5 text-slate-400" />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-700">v{version.version} · {version.fileName}</span>
                          <span className="text-slate-400">{formatDate(version.uploadedAt)}</span>
                          {version.id === item.activeVersionId && getSaleDocumentFileState(item) === 'active' ? <Badge className="rounded-full bg-emerald-50 text-[9px] text-emerald-700 hover:bg-emerald-50">Activă</Badge> : <Button type="button" size="sm" variant="ghost" className="h-7 rounded-lg text-[10px]" onClick={() => void documentAction(item, 'restore_version', version.id)}>Restaurează</Button>}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            </article>
          );
        })}
        {!visible.length ? <div className="rounded-[26px] border border-dashed border-slate-200 bg-white/75 px-6 py-12 text-center"><FilePlus2 className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold text-slate-700">Nu există documente în acest filtru</p><p className="mt-1 text-sm text-slate-500">Schimbă etapa sau adaugă o cerință documentară.</p></div> : null}
      </div>
    </div>
  );
}