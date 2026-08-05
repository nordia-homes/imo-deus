'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Archive,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FileCheck2,
  FilePlus2,
  Inbox,
  Loader2,
  Mail,
  MailCheck,
  MessageSquareReply,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import { useAgency } from '@/context/AgencyContext';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { DesktopGmailRunnerStatus, GmailRunnerAttachment } from '@/lib/desktop/gmail-runner';
import {
  DEFAULT_SALES_EMAIL_TEMPLATES,
  participantRoleLabel,
  renderSalesTemplate,
} from '@/lib/sales';
import type {
  SaleChecklistItem,
  SaleEmailMessage,
  SaleEmailQuestion,
  SaleParticipant,
  SaleParticipantRole,
  SaleTransaction,
  SalesEmailTemplate,
  SalesAuditEvent,
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GmailRichTextEditor } from '@/components/sales/GmailRichTextEditor';
import { isEmailAddress, parseEmailList, plainTextToEmailHtml } from '@/lib/email-compose';
import { SalesOperationsPanel } from '@/components/sales/SalesOperationsPanel';

type Connection = {
  inboundAddress: string;
  status: 'awaiting_gmail_verification' | 'verification_received' | 'connected' | 'error';
  verificationCode?: string | null;
  lastForwardedAt?: string | null;
};

type Props = {
  sale: SaleTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPanel?: 'context' | 'documents';
  onOpenSetup?: (sale: SaleTransaction) => void;
};

const panelClass = 'rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--app-surface)] shadow-[0_18px_60px_-44px_rgba(15,23,42,.7)]';
const inputClass = 'border-[var(--app-surface-border)] bg-muted/40 text-[var(--app-page-foreground)] placeholder:text-[var(--app-muted-foreground)]';

function newParticipant(role: SaleParticipantRole): SaleParticipant {
  return {
    id: `${role}-${crypto.randomUUID()}`,
    role,
    name: '',
    email: '',
    phone: '',
    preferredChannel: 'email',
  };
}

function makeQuestion(text = ''): SaleEmailQuestion {
  return {
    id: crypto.randomUUID(),
    text,
    required: true,
    status: 'pending',
  };
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ro-RO', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function ForwardingSetup() {
  const { user } = useAgency();
  const { toast } = useToast();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/email/forwarding', { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Conexiunea nu a putut fi citită.');
      setConnection(payload.connection || null);
    } catch (error) {
      toast({ title: 'Conexiunea nu a putut fi verificată', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    if (!user) return;
    setCreating(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/email/forwarding', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Adresa nu a putut fi creată.');
      setConnection(payload.connection);
    } catch (error) {
      toast({ title: 'Configurarea a eșuat', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex items-center gap-2 p-5 text-sm text-[var(--app-muted-foreground)]"><Loader2 className="h-4 w-4 animate-spin" /> Verific conexiunea pentru răspunsuri…</div>;

  if (!connection) {
    return (
      <div className={cn(panelClass, 'space-y-4 p-5')}>
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-500/12 p-3 text-emerald-600"><MessageSquareReply className="h-5 w-5" /></div>
          <div><p className="font-semibold">Detectează răspunsurile din Gmail</p><p className="mt-1 text-sm text-[var(--app-muted-foreground)]">Primești o adresă Imodeus unică pe care o adaugi o singură dată în Gmail Forwarding. Clienții răspund normal.</p></div>
        </div>
        <Button onClick={create} disabled={creating} className="w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Creează adresa de răspuns
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(panelClass, 'space-y-4 p-5')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn('rounded-2xl p-3', connection.status === 'connected' ? 'bg-emerald-500/12 text-emerald-600' : 'bg-amber-500/12 text-amber-600')}>
            {connection.status === 'connected' ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
          </div>
          <div><p className="font-semibold">{connection.status === 'connected' ? 'Răspunsuri conectate' : 'Așteaptă verificarea Gmail'}</p><p className="text-xs text-[var(--app-muted-foreground)]">Configurare individuală pentru contul agentului</p></div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--app-surface-border)] bg-muted/40 p-3">
        <code className="min-w-0 flex-1 truncate text-xs">{connection.inboundAddress}</code>
        <Button variant="ghost" size="icon" onClick={() => { void navigator.clipboard.writeText(connection.inboundAddress); toast({ title: 'Adresa a fost copiată' }); }}><Copy className="h-4 w-4" /></Button>
      </div>
      {connection.verificationCode ? (
        <div className="rounded-xl bg-emerald-500/10 p-3 text-sm"><span className="text-[var(--app-muted-foreground)]">Cod Gmail detectat:</span> <strong className="ml-1 tracking-[.2em]">{connection.verificationCode}</strong></div>
      ) : null}
      {connection.status !== 'connected' ? (
        <ol className="space-y-2 text-sm text-[var(--app-muted-foreground)]">
          <li>1. Gmail → Settings → Forwarding and POP/IMAP.</li>
          <li>2. Adaugă adresa de mai sus și confirmă codul afișat aici.</li>
          <li>3. Creează un filtru pentru <strong className="text-[var(--app-page-foreground)]">IMD-V</strong> și alege „Forward it to”.</li>
        </ol>
      ) : <p className="text-xs text-[var(--app-muted-foreground)]">Ultimul răspuns redirecționat: {formatDate(connection.lastForwardedAt)}</p>}
    </div>
  );
}

function statusCopy(status: DesktopGmailRunnerStatus | null) {
  if (!status) return null;
  const titles: Record<DesktopGmailRunnerStatus['state'], string> = {
    idle: 'Gmail este pregătit',
    starting: 'Pornesc Gmail…',
    needs_login: 'Autentifică-te în Gmail',
    connected: 'Contul Gmail este conectat',
    preparing: 'Completez mesajul…',
    waiting_for_send: 'Mesaj pregătit — verifică și apasă Trimite',
    sent_ui_confirmed: 'Trimitere confirmată în Gmail',
    stopped: 'Pregătirea a fost oprită',
    error: 'Gmail nu a putut fi pregătit',
  };
  return titles[status.state];
}

export function SalesEmailComposer({ sale, open, onOpenChange, initialPanel = 'context', onOpenSetup }: Props) {
  const firestore = useFirestore();
  const { agencyId, userProfile, user } = useAgency();
  const { toast } = useToast();
  const [recipientId, setRecipientId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [ccInput, setCcInput] = useState('');
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [questions, setQuestions] = useState<SaleEmailQuestion[]>([]);
  const [localFiles, setLocalFiles] = useState<GmailRunnerAttachment[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [participants, setParticipants] = useState<SaleParticipant[]>([]);
  const [checklist, setChecklist] = useState<SaleChecklistItem[]>([]);
  const [notary, setNotary] = useState<NonNullable<SaleTransaction['notary']>>({});
  const [nextAction, setNextAction] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runnerStatus, setRunnerStatus] = useState<DesktopGmailRunnerStatus | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [newDocument, setNewDocument] = useState('');
  const [newDocumentRole, setNewDocumentRole] = useState<'buyer' | 'owner'>('owner');
  const activeMessageRef = useRef<{ saleId: string; messageId: string } | null>(null);

  const apiRequest = useCallback(async (url: string, init?: RequestInit) => {
    if (!user) throw new Error('Sesiunea a expirat. Autentifică-te din nou.');
    const token = await user.getIdToken();
    const response = await fetch(url, {
      ...init,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    });
    const payload = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    if (!response.ok) throw new Error(payload?.message || 'Operațiunea nu a putut fi finalizată.');
    return { response, payload };
  }, [user]);

  const messagesQuery = useMemoFirebase(() => {
    if (!open || !agencyId || !sale) return null;
    return query(collection(firestore, 'agencies', agencyId, 'sales', sale.id, 'emailMessages'), orderBy('createdAt', 'desc'));
  }, [agencyId, firestore, open, sale?.id]);
  const { data: messages, isLoading: messagesLoading } = useCollection<SaleEmailMessage>(messagesQuery);
  const auditQuery = useMemoFirebase(() => {
    if (!open || !agencyId || !sale) return null;
    return query(collection(firestore, 'agencies', agencyId, 'sales', sale.id, 'audit'), orderBy('createdAt', 'desc'));
  }, [agencyId, firestore, open, sale?.id]);
  const { data: auditEvents } = useCollection<SalesAuditEvent>(auditQuery);

  const customTemplatesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'salesEmailTemplates');
  }, [agencyId, firestore]);
  const { data: customTemplates } = useCollection<SalesEmailTemplate>(customTemplatesQuery);

  const templateLibrary = useMemo(
    () => [...DEFAULT_SALES_EMAIL_TEMPLATES, ...(customTemplates || []).filter((item) =>
      item.approvalStatus === 'approved' || item.createdByUid === userProfile?.id || userProfile?.role === 'admin'
    )],
    [customTemplates, userProfile?.id, userProfile?.role]
  );
  const templates = useMemo(() => templateLibrary.filter((item) => item.isActive !== false), [templateLibrary]);
  const recipient = participants.find((item) => item.id === recipientId) || null;

  useEffect(() => {
    if (!open || !sale) return;
    const initialParticipants = sale.participants?.length ? sale.participants : [newParticipant('buyer'), newParticipant('owner')];
    setParticipants(initialParticipants);
    setChecklist(sale.checklist || []);
    setNotary(sale.notary || {});
    setNextAction(sale.nextAction || '');
    setNextActionAt(sale.nextActionAt?.slice(0, 16) || '');
    setCustomTemplateName('');
    setEditingTemplateId(null);
    setRecipientId(initialParticipants.find((item) => item.role === 'buyer')?.id || initialParticipants[0]?.id || '');
    setTemplateId('');
    setSubject('');
    setBody('');
    setBodyHtml('');
    setShowCc(false);
    setCcInput('');
    setCcRecipients([]);
    setQuestions([]);
    setLocalFiles([]);
    setSelectedDocumentIds([]);
    activeMessageRef.current = null;
  }, [open, sale?.id]);

  useEffect(() => {
    const desktop = window.imodeusDesktop;
    if (
      !open
      || !desktop
      || typeof desktop.getGmailRunnerStatus !== 'function'
      || typeof desktop.onGmailRunnerStatusChanged !== 'function'
      || typeof desktop.startGmailRunner !== 'function'
    ) {
      setIsDesktop(false);
      return;
    }
    void desktop.isDesktop().then(setIsDesktop).catch(() => setIsDesktop(false));
    void desktop.getGmailRunnerStatus().then(setRunnerStatus).catch(() => undefined);
    return desktop.onGmailRunnerStatusChanged((status) => {
      setRunnerStatus(status);
      const active = activeMessageRef.current;
      if (!active || !agencyId || status.messageRecordId !== active.messageId) return;
      if (status.state === 'sent_ui_confirmed') {
        const now = status.sentAt || new Date().toISOString();
        void apiRequest(`/api/sales/${active.saleId}/messages/${active.messageId}/send-evidence`, {
          method: 'PATCH',
          body: JSON.stringify({ level: 'ui_observed', diagnostics: { completedFields: status.completedFields || [], missingFields: status.missingFields || [], attempt: status.attempt || 1, selectorProfile: status.selectorProfile || null, canRetry: status.canRetry ?? false } }),
        });
        toast({ title: 'Trimitere confirmată', description: 'Mesajul a fost marcat în istoricul tranzacției.' });
      }
      if (status.state === 'error') {
        void updateDoc(doc(firestore, 'agencies', agencyId, 'sales', active.saleId, 'emailMessages', active.messageId), { status: 'failed', updatedAt: new Date().toISOString() });
      }
    });
  }, [agencyId, apiRequest, firestore, open, toast]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template || !sale || !recipient) return;
    const rendered = renderSalesTemplate(template, { ...sale, checklist }, recipient, { name: userProfile?.name || sale.agentName });
    setSubject(rendered.subject);
    setBody(rendered.body);
    setBodyHtml(rendered.bodyHtml || plainTextToEmailHtml(rendered.body));
    setCcRecipients(template.defaultCc || []);
    setShowCc(Boolean(template.defaultCc?.length));
    setQuestions((template.defaultQuestions || []).map(makeQuestion));
  };

  const updateParticipant = (id: string, patch: Partial<SaleParticipant>) => {
    setParticipants((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const saveDossier = async () => {
    if (!sale || !agencyId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await updateDoc(doc(firestore, 'agencies', agencyId, 'sales', sale.id), {
        participants,
        checklist,
        notary,
        nextAction: nextAction.trim() || null,
        nextActionAt: nextActionAt ? new Date(nextActionAt).toISOString() : null,
        receivedDocumentCount: checklist.filter((item) => ['received_needs_review', 'verified'].includes(item.status)).length,
        requiredDocumentCount: checklist.filter((item) => item.required).length,
        updatedAt: now,
      });
      toast({ title: 'Dosarul a fost salvat' });
    } catch (error) {
      toast({ title: 'Salvarea a eșuat', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const saveAsTemplate = async () => {
    if (!agencyId || !sale || !recipient || !customTemplateName.trim() || !subject.trim() || !body.trim()) {
      toast({ title: 'Template incomplet', description: 'Completează numele, destinatarul, subiectul și mesajul.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { payload } = await apiRequest(editingTemplateId ? `/api/sales/templates/${editingTemplateId}` : '/api/sales/templates', {
        method: editingTemplateId ? 'PATCH' : 'POST',
        body: JSON.stringify({
        name: customTemplateName.trim(),
        description: 'Template personalizat al agenției',
        recipientRole: recipient.role,
        stage: sale.stage,
        subject: subject.trim(),
        body: body.trim(),
        bodyHtml,
        defaultCc: ccRecipients,
        defaultQuestions: questions.map((item) => item.text.trim()).filter(Boolean),
        signatureMode: 'agent',
        }),
      });
      setTemplateId(payload.template.id);
      setCustomTemplateName('');
      setEditingTemplateId(null);
      toast({ title: editingTemplateId ? 'Versiunea template-ului a fost salvată ca draft' : 'Template salvat pentru agenție' });
    } catch (error) {
      toast({ title: 'Template-ul nu a putut fi salvat', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const beginTemplateEdit = (template: SalesEmailTemplate) => {
    applyTemplate(template.id);
    setCustomTemplateName(template.name);
    setEditingTemplateId(template.id);
  };

  const templateAction = async (template: SalesEmailTemplate, action: 'submit' | 'approve' | 'reject' | 'activate' | 'deactivate' | 'duplicate') => {
    if (template.isSystem) return;
    try {
      await apiRequest(`/api/sales/templates/${template.id}`, { method: action === 'duplicate' ? 'POST' : 'PATCH', body: JSON.stringify({ action }) });
      toast({ title: action === 'duplicate' ? 'Template duplicat' : 'Starea template-ului a fost actualizată' });
    } catch (error) {
      toast({ title: 'Template-ul nu a putut fi actualizat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const documentAction = async (item: SaleChecklistItem, action: 'analyze' | 'approve' | 'reject' | 'rotate_link' | 'delete') => {
    if (!sale) return;
    if (action === 'delete' && !window.confirm(`Ștergi definitiv fișierul „${item.fileName || item.label}”?`)) return;
    setSaving(true);
    try {
      const { payload } = await apiRequest(`/api/sales/${sale.id}/documents/${item.id}`, { method: action === 'delete' ? 'DELETE' : 'POST', body: action === 'delete' ? undefined : JSON.stringify({ action }) });
      setChecklist((current) => current.map((entry) => entry.id === item.id ? payload.document : entry));
      toast({ title: action === 'analyze' ? 'Analiza documentului s-a încheiat' : 'Documentul a fost actualizat' });
    } catch (error) {
      toast({ title: 'Documentul nu a putut fi procesat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reviewReply = async (message: SaleEmailMessage, status: 'confirmed' | 'corrected' | 'needs_clarification') => {
    if (!sale) return;
    try {
      await apiRequest(`/api/sales/${sale.id}/messages/${message.id}/review`, { method: 'PATCH', body: JSON.stringify({ status, questions: message.questions || [] }) });
      toast({ title: status === 'needs_clarification' ? 'Răspuns marcat pentru clarificare' : 'Răspuns validat' });
    } catch (error) {
      toast({ title: 'Validarea nu a putut fi salvată', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const confirmSent = async (message: SaleEmailMessage) => {
    if (!sale) return;
    try {
      await apiRequest(`/api/sales/${sale.id}/messages/${message.id}/send-evidence`, { method: 'PATCH', body: JSON.stringify({ level: 'agent_confirmed' }) });
      toast({ title: 'Trimiterea a fost confirmată manual' });
    } catch (error) {
      toast({ title: 'Confirmarea nu a putut fi salvată', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const exportDossier = async () => {
    if (!sale || !user) return;
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/sales/${sale.id}/export`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error((await response.json()).message || 'Exportul a eșuat.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `imodeus-${sale.trackingCode}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({ title: 'Exportul nu a putut fi creat', description: error instanceof Error ? error.message : undefined, variant: 'destructive' });
    }
  };

  const selectLocalFiles = async () => {
    if (typeof window.imodeusDesktop?.selectGmailRunnerFiles !== 'function') {
      toast({ title: 'Atașamente locale indisponibile', description: 'Deschide Imodeus Desktop pentru atașarea automată. În browser poți atașa manual după deschiderea Gmail.' });
      return;
    }
    const result = await window.imodeusDesktop.selectGmailRunnerFiles();
    if (!result.canceled) setLocalFiles((current) => [...current, ...result.files]);
  };

  const addDocument = () => {
    const label = newDocument.trim();
    if (!label) return;
    setChecklist((current) => [...current, { id: crypto.randomUUID(), label, participantRole: newDocumentRole, status: 'required', required: true }]);
    setNewDocument('');
  };

  const prepareInGmail = async () => {
    if (!sale) return;
    if (!sale || !agencyId || !recipient?.email.trim()) {
      toast({ title: 'Completează destinatarul', description: 'Numele și adresa de email sunt necesare înainte de deschiderea Gmail.', variant: 'destructive' });
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast({ title: 'Mesaj incomplet', description: 'Adaugă subiectul și conținutul mesajului.', variant: 'destructive' });
      return;
    }
    const pendingCc = parseEmailList(ccInput);
    const finalCc = [...new Set([...ccRecipients, ...pendingCc])];
    const invalidCc = finalCc.filter((email) => !isEmailAddress(email));
    if (invalidCc.length) {
      toast({ title: 'Adresă CC invalidă', description: invalidCc.join(', '), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const trackingSubject = subject.includes(sale.trackingCode) ? subject : `${subject} [${sale.trackingCode}]`;
      const questionText = questions.filter((item) => item.text.trim()).length
        ? `\n\nÎntrebări pentru confirmare:\n${questions.filter((item) => item.text.trim()).map((item, index) => `${index + 1}. ${item.text.trim()}`).join('\n')}`
        : '';
      const finalBody = `${body.trim()}${questionText}`;
      const finalBodyHtml = `${bodyHtml || plainTextToEmailHtml(body.trim())}${questionText ? plainTextToEmailHtml(questionText) : ''}`;
      const messageRef = doc(collection(firestore, 'agencies', agencyId, 'sales', sale.id, 'emailMessages'));
      const now = new Date().toISOString();
      const message: SaleEmailMessage = {
        id: messageRef.id,
        saleId: sale.id,
        agencyId,
        direction: 'outbound',
        status: 'prepared',
        trackingCode: sale.trackingCode,
        fromName: userProfile?.name || sale.agentName,
        fromEmail: userProfile?.email || null,
        to: [recipient.email.trim()],
        cc: finalCc,
        subject: trackingSubject,
        bodyText: finalBody,
        bodyHtml: finalBodyHtml,
        questions,
        attachmentNames: [...localFiles.map((item) => item.name), ...checklist.filter((item) => selectedDocumentIds.includes(item.id) && item.fileName).map((item) => item.fileName as string)],
        sendEvidence: { level: 'none', source: isDesktop ? 'gmail_runner' : 'web_fallback', observedAt: now, observedByUid: userProfile?.id || null, details: 'Mesaj pregătit; trimiterea nu este încă confirmată.' },
        createdByUid: userProfile?.id || null,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(messageRef, message);
      activeMessageRef.current = { saleId: sale.id, messageId: messageRef.id };
      const storedAttachments: GmailRunnerAttachment[] = checklist
        .filter((item) => selectedDocumentIds.includes(item.id) && item.downloadUrl)
        .map((item) => ({ name: item.fileName || item.label, url: item.downloadUrl }));

      if (isDesktop && typeof window.imodeusDesktop?.startGmailRunner === 'function') {
        const status = await window.imodeusDesktop.startGmailRunner({
          session: {
            jobId: crypto.randomUUID(),
            saleId: sale.id,
            messageRecordId: messageRef.id,
            trackingCode: sale.trackingCode,
            to: [recipient.email.trim()],
            cc: finalCc,
            subject: trackingSubject,
            bodyText: finalBody,
            bodyHtml: finalBodyHtml,
            attachments: [...storedAttachments, ...localFiles],
          },
        });
        setRunnerStatus(status);
      } else {
        const composeUrl = new URL('https://mail.google.com/mail/');
        composeUrl.searchParams.set('view', 'cm');
        composeUrl.searchParams.set('fs', '1');
        composeUrl.searchParams.set('to', recipient.email.trim());
        if (finalCc.length) composeUrl.searchParams.set('cc', finalCc.join(','));
        composeUrl.searchParams.set('su', trackingSubject);
        composeUrl.searchParams.set('body', finalBody);
        window.open(composeUrl.toString(), '_blank', 'noopener,noreferrer');
        await updateDoc(messageRef, { status: 'opened_in_gmail', sendEvidence: { level: 'none', source: 'web_fallback', observedAt: new Date().toISOString(), observedByUid: userProfile?.id || null, details: 'Fereastra Gmail a fost deschisă; trimiterea nu poate fi observată din browser.' }, updatedAt: new Date().toISOString() });
        toast({ title: 'Gmail a fost deschis', description: storedAttachments.length || localFiles.length ? 'În browser, atașează manual fișierele listate înainte de trimitere.' : 'Verifică mesajul și apasă Trimite în Gmail.' });
      }
    } catch (error) {
      toast({ title: 'Gmail nu a putut fi pregătit', description: error instanceof Error ? error.message : 'Încearcă din nou.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="sales-email-composer" className="flex h-[96dvh] w-[98vw] max-w-none flex-col gap-0 overflow-hidden rounded-[30px] border border-[var(--app-surface-border)] bg-[var(--app-page-background)] p-0 text-[var(--app-page-foreground)] shadow-[0_40px_140px_-35px_rgba(2,6,23,.72)] sm:max-w-none [&>button]:hidden">
        <DialogHeader className="relative shrink-0 border-b border-[var(--app-surface-border)] bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,.16),transparent_32%),var(--app-surface)] px-5 py-4 md:px-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_12px_28px_-12px_rgba(16,185,129,.8)]"><Mail className="h-5 w-5" /></div>
              <div className="min-w-0"><DialogTitle className="truncate text-lg">Email · {sale.propertyTitle}</DialogTitle><DialogDescription className="truncate text-[var(--app-muted-foreground)]">{sale.propertyAddress} · {sale.trackingCode}</DialogDescription></div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenSetup ? <Button variant="outline" size="sm" className="hidden rounded-xl border-emerald-500/25 bg-emerald-500/10 text-emerald-700 md:flex" onClick={() => onOpenSetup({ ...sale, participants, checklist, notary })}><Sparkles className="mr-1.5 h-3.5 w-3.5" /> Completează ghidat</Button> : null}
              <Badge variant="outline" className="hidden rounded-full border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-emerald-600 md:flex"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Agentul confirmă trimiterea</Badge>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => onOpenChange(false)}><X className="h-5 w-5" /></Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(390px,.65fr)]">
          <ScrollArea className="min-h-0 border-b border-[var(--app-surface-border)] lg:border-b-0 lg:border-r">
            <div className="space-y-5 p-4 md:p-7">
              {runnerStatus && !['idle', 'stopped'].includes(runnerStatus.state) ? (
                <div className={cn(panelClass, 'flex items-center gap-4 overflow-hidden p-4', runnerStatus.state === 'error' ? 'border-red-500/35 bg-red-500/8' : runnerStatus.state === 'sent_ui_confirmed' ? 'border-emerald-500/35 bg-emerald-500/8' : 'border-sky-500/35 bg-sky-500/8')}>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-muted">{['starting', 'preparing'].includes(runnerStatus.state) ? <Loader2 className="h-5 w-5 animate-spin text-sky-500" /> : runnerStatus.state === 'sent_ui_confirmed' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <MailCheck className="h-5 w-5 text-red-500" />}</div>
                  <div className="min-w-0 flex-1"><p className="font-semibold">{statusCopy(runnerStatus)}</p><p className="truncate text-sm text-[var(--app-muted-foreground)]">{runnerStatus.message}</p></div>
                  {isDesktop && runnerStatus.state === 'error' && runnerStatus.canRetry ? <Button variant="outline" size="sm" onClick={() => void window.imodeusDesktop?.retryGmailRunner().then(setRunnerStatus)}>Reîncearcă</Button> : null}
                  {isDesktop && !['sent_ui_confirmed', 'error'].includes(runnerStatus.state) ? <Button variant="ghost" size="sm" onClick={() => void window.imodeusDesktop?.stopGmailRunner()}>Oprește</Button> : null}
                </div>
              ) : null}

              <div className={cn(panelClass, 'overflow-hidden')}>
                <div className="grid border-b border-[var(--app-surface-border)] md:grid-cols-[150px_1fr]">
                  <div className="px-5 py-4 text-sm font-medium text-[var(--app-muted-foreground)]">Către</div>
                  <div className="p-3">
                    <div className="flex items-center gap-2">
                      <Select value={recipientId} onValueChange={(value) => { setRecipientId(value); setTemplateId(''); }}>
                        <SelectTrigger className={cn(inputClass, 'h-11 rounded-xl')}><SelectValue placeholder="Alege cumpărătorul, proprietarul sau notarul" /></SelectTrigger>
                        <SelectContent>{participants.map((item) => <SelectItem key={item.id} value={item.id}>{participantRoleLabel(item.role)} · {item.name || 'Nume necompletat'} {item.email ? `— ${item.email}` : ''}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button type="button" variant="ghost" size="sm" className="rounded-lg text-xs" onClick={() => setShowCc((value) => !value)}>Cc</Button>
                    </div>
                  </div>
                </div>
                {showCc ? (
                  <div className="grid border-b border-[var(--app-surface-border)] md:grid-cols-[150px_1fr]">
                    <div className="px-5 py-4 text-sm font-medium text-[var(--app-muted-foreground)]">Cc</div>
                    <div className="flex flex-wrap items-center gap-1.5 p-3">
                      {ccRecipients.map((email) => <span key={email} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs', isEmailAddress(email) ? 'bg-sky-500/10 text-sky-700' : 'bg-red-500/10 text-red-700')}>{email}<button type="button" onClick={() => setCcRecipients((current) => current.filter((item) => item !== email))}><X className="h-3 w-3" /></button></span>)}
                      <Input value={ccInput} onChange={(event) => setCcInput(event.target.value)} onBlur={() => { const values = parseEmailList(ccInput); if (values.length) { setCcRecipients((current) => [...new Set([...current, ...values])]); setCcInput(''); } }} onKeyDown={(event) => { if (['Enter', ',', ';'].includes(event.key)) { event.preventDefault(); const values = parseEmailList(ccInput); if (values.length) { setCcRecipients((current) => [...new Set([...current, ...values])]); setCcInput(''); } } }} className={cn(inputClass, 'h-9 min-w-[220px] flex-1 rounded-xl border-0 bg-transparent shadow-none focus-visible:ring-0')} placeholder="Adaugă una sau mai multe adrese CC" />
                    </div>
                  </div>
                ) : null}
                <div className="grid border-b border-[var(--app-surface-border)] md:grid-cols-[150px_1fr]">
                  <div className="px-5 py-4 text-sm font-medium text-[var(--app-muted-foreground)]">Template</div>
                  <div className="p-3">
                    <Select value={templateId} onValueChange={applyTemplate} disabled={!recipient}>
                      <SelectTrigger className={cn(inputClass, 'h-11 rounded-xl')}><SelectValue placeholder="Alege un mesaj prestabilit" /></SelectTrigger>
                      <SelectContent>{templates.filter((item) => !recipient || item.recipientRole === recipient.role).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid border-b border-[var(--app-surface-border)] md:grid-cols-[150px_1fr]">
                  <Label htmlFor="sales-email-subject" className="px-5 py-4 text-sm font-medium text-[var(--app-muted-foreground)]">Subiect</Label>
                  <div className="p-3"><Input id="sales-email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} className={cn(inputClass, 'h-11 rounded-xl border-0 bg-transparent shadow-none focus-visible:ring-0')} placeholder="Subiect clar și specific" /></div>
                </div>
                <div className="bg-[#f6f8fc] p-3 md:p-5">
                  <GmailRichTextEditor value={bodyHtml} onChange={(value) => { setBodyHtml(value.html); setBody(value.text); }} minHeight={330} variables={['{{recipient.name}}', '{{property.title}}', '{{property.address}}', '{{documents.list}}', '{{notary.summary}}', '{{agent.name}}']} />
                </div>
              </div>

              {questions.length ? (
                <div className={cn(panelClass, 'space-y-3 p-5')}>
                  <div className="flex items-center justify-between"><div><p className="font-semibold">Întrebări urmărite</p><p className="text-sm text-[var(--app-muted-foreground)]">Vor fi numerotate, iar răspunsurile primite vor fi asociate automat.</p></div><CircleHelp className="h-5 w-5 text-violet-500" /></div>
                  {questions.map((question, index) => <div key={question.id} className="flex items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-sm font-semibold text-violet-600">{index + 1}</span><Input value={question.text} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))} className={cn(inputClass, 'rounded-xl')} /><Button variant="ghost" size="icon" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}><Trash2 className="h-4 w-4" /></Button></div>)}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 rounded-[24px] border border-dashed border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4 sm:flex-row sm:items-center">
                <Button variant="outline" className="rounded-xl border-[var(--app-surface-border)]" onClick={selectLocalFiles}><Paperclip className="mr-2 h-4 w-4" /> Atașează fișiere</Button>
                <div className="min-w-0 flex-1 text-sm text-[var(--app-muted-foreground)]">{localFiles.length ? `${localFiles.length} fișier(e) local(e) selectat(e)` : isDesktop ? 'Fișierele vor fi atașate automat în Gmail.' : 'În browser, fișierele se atașează manual în Gmail.'}</div>
                {localFiles.length ? <Button variant="ghost" size="sm" onClick={() => setLocalFiles([])}>Elimină toate</Button> : null}
              </div>
            </div>
          </ScrollArea>

          <div className="flex min-h-0 flex-col bg-muted/30">
            <Tabs key={`${sale.id}-${initialPanel}`} defaultValue={initialPanel} className="flex min-h-0 flex-1 flex-col">
              <TabsList className="m-3 grid h-auto grid-cols-3 gap-1 rounded-2xl border border-[var(--app-surface-border)] bg-[var(--app-surface)] p-1 sm:grid-cols-6">
                <TabsTrigger value="context" className="rounded-xl px-2 py-2.5 text-xs"><UserRound className="mr-1 h-3.5 w-3.5" /> Date</TabsTrigger>
                <TabsTrigger value="templates" className="rounded-xl px-2 py-2.5 text-xs"><Sparkles className="mr-1 h-3.5 w-3.5" /> Template</TabsTrigger>
                <TabsTrigger value="documents" className="rounded-xl px-2 py-2.5 text-xs"><FileCheck2 className="mr-1 h-3.5 w-3.5" /> Acte</TabsTrigger>
                <TabsTrigger value="questions" className="rounded-xl px-2 py-2.5 text-xs"><CircleHelp className="mr-1 h-3.5 w-3.5" /> Întrebări</TabsTrigger>
                <TabsTrigger value="replies" className="rounded-xl px-2 py-2.5 text-xs"><Inbox className="mr-1 h-3.5 w-3.5" /> Răspunsuri</TabsTrigger>
                <TabsTrigger value="history" className="rounded-xl px-2 py-2.5 text-xs"><Archive className="mr-1 h-3.5 w-3.5" /> Istoric</TabsTrigger>
              </TabsList>
              <ScrollArea className="min-h-0 flex-1">
                <TabsContent value="context" className="m-0 space-y-4 p-4">
                  <div className="flex items-center justify-between"><div><p className="font-semibold">Participanții tranzacției</p><p className="text-sm text-[var(--app-muted-foreground)]">Datele se completează o singură dată.</p></div><Button variant="outline" size="sm" className="rounded-xl" onClick={() => setParticipants((current) => [...current, newParticipant('buyer')])}><Plus className="mr-1 h-4 w-4" /> Persoană</Button></div>
                  {participants.map((item) => (
                    <div key={item.id} className={cn(panelClass, 'space-y-3 p-4')}>
                      <div className="flex items-center gap-2"><Select value={item.role} onValueChange={(role: SaleParticipantRole) => updateParticipant(item.id, { role })}><SelectTrigger className={cn(inputClass, 'h-9 flex-1 rounded-xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="buyer">Cumpărător</SelectItem><SelectItem value="owner">Proprietar</SelectItem><SelectItem value="notary">Notar</SelectItem><SelectItem value="collaborator">Colaborator</SelectItem></SelectContent></Select><Button variant="ghost" size="icon" onClick={() => setParticipants((current) => current.filter((participant) => participant.id !== item.id))}><Trash2 className="h-4 w-4" /></Button></div>
                      <Input value={item.name} onChange={(event) => updateParticipant(item.id, { name: event.target.value })} className={cn(inputClass, 'rounded-xl')} placeholder="Nume complet" />
                      <Input type="email" value={item.email} onChange={(event) => updateParticipant(item.id, { email: event.target.value })} className={cn(inputClass, 'rounded-xl')} placeholder="email@gmail.com" />
                      <Input value={item.phone || ''} onChange={(event) => updateParticipant(item.id, { phone: event.target.value })} className={cn(inputClass, 'rounded-xl')} placeholder="Telefon" />
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-3"><p className="font-semibold">Programare notar</p><Input value={notary.name || ''} onChange={(event) => setNotary((current) => ({ ...current, name: event.target.value }))} className={cn(inputClass, 'rounded-xl')} placeholder="Nume birou/notar" /><Input value={notary.address || ''} onChange={(event) => setNotary((current) => ({ ...current, address: event.target.value }))} className={cn(inputClass, 'rounded-xl')} placeholder="Adresă" /><Input type="datetime-local" value={notary.appointmentAt?.slice(0, 16) || ''} onChange={(event) => setNotary((current) => ({ ...current, appointmentAt: event.target.value ? new Date(event.target.value).toISOString() : null }))} className={cn(inputClass, 'rounded-xl')} /></div>
                  <Separator />
                  <div className="space-y-3"><p className="font-semibold">Următoarea acțiune</p><Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} className={cn(inputClass, 'rounded-xl')} placeholder="Ex: Verifică extrasul CF" /><Input type="datetime-local" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} className={cn(inputClass, 'rounded-xl')} /><p className="text-xs text-[var(--app-muted-foreground)]">Este un reminder intern. Nu trimite automat email clientului.</p></div>
                </TabsContent>

                <TabsContent value="templates" className="m-0 space-y-4 p-4">
                  <div><p className="font-semibold">Biblioteca de mesaje</p><p className="text-sm text-[var(--app-muted-foreground)]">Template-urile păstrează tonul consecvent și reduc mesajele inutile.</p></div>
                  <div className="space-y-2">
                    {templateLibrary.filter((item) => !recipient || item.recipientRole === recipient.role).map((template) => (
                      <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} className={cn(panelClass, 'w-full p-4 text-left transition hover:border-emerald-500/35 hover:bg-emerald-500/5', templateId === template.id && 'border-emerald-500/45 bg-emerald-500/8')}>
                        <div className="flex items-center justify-between gap-2"><p className="font-medium">{template.name}</p><Badge variant="outline" className="rounded-full text-[10px]">{template.isSystem ? 'Imodeus' : template.isActive === false ? 'Dezactivat' : template.approvalStatus === 'approved' ? 'Aprobat' : template.approvalStatus === 'pending_approval' ? 'În aprobare' : 'Draft'}</Badge></div><p className="mt-1 text-xs leading-5 text-[var(--app-muted-foreground)]">{template.description}</p>
                        {!template.isSystem ? <div className="mt-3 flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}><Button size="sm" variant="ghost" onClick={() => beginTemplateEdit(template)}>Editează</Button><Button size="sm" variant="ghost" onClick={() => void templateAction(template, 'duplicate')}>Duplică</Button>{template.approvalStatus === 'draft' ? <Button size="sm" variant="ghost" onClick={() => void templateAction(template, 'submit')}>Trimite la aprobare</Button> : null}{userProfile?.role === 'admin' && template.approvalStatus === 'pending_approval' ? <><Button size="sm" variant="ghost" onClick={() => void templateAction(template, 'approve')}>Aprobă</Button><Button size="sm" variant="ghost" onClick={() => void templateAction(template, 'reject')}>Respinge</Button></> : null}{userProfile?.role === 'admin' ? <Button size="sm" variant="ghost" onClick={() => void templateAction(template, template.isActive === false ? 'activate' : 'deactivate')}>{template.isActive === false ? 'Reactivează' : 'Dezactivează'}</Button> : null}</div> : null}
                      </button>
                    ))}
                  </div>
                  <Separator />
                  <div className={cn(panelClass, 'space-y-3 p-4')}><div><p className="font-medium">{editingTemplateId ? 'Editează versiunea template-ului' : 'Salvează mesajul curent'}</p><p className="mt-1 text-xs text-[var(--app-muted-foreground)]">{editingTemplateId ? 'Orice editare revine în starea Draft și necesită din nou aprobare.' : 'Draftul rămâne privat autorului până la aprobare.'}</p></div><Input value={customTemplateName} onChange={(event) => setCustomTemplateName(event.target.value)} className={cn(inputClass, 'rounded-xl')} placeholder="Numele template-ului" /><div className="flex gap-2">{editingTemplateId ? <Button variant="ghost" className="rounded-xl" onClick={() => { setEditingTemplateId(null); setCustomTemplateName(''); }}>Renunță</Button> : null}<Button variant="outline" className="flex-1 rounded-xl" onClick={saveAsTemplate} disabled={saving}><Sparkles className="mr-2 h-4 w-4" /> {editingTemplateId ? 'Salvează versiunea' : 'Salvează ca template'}</Button></div></div>
                </TabsContent>

                <TabsContent value="documents" className="m-0 space-y-4 p-4">
                  <div><p className="font-semibold">Checklist documente</p><p className="text-sm text-[var(--app-muted-foreground)]">Selectează documentele existente pe care vrei să le atașezi.</p></div>
                  <div className="flex gap-2"><Input value={newDocument} onChange={(event) => setNewDocument(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') addDocument(); }} className={cn(inputClass, 'rounded-xl')} placeholder="Ex: Certificat fiscal" /><Select value={newDocumentRole} onValueChange={(value: 'buyer' | 'owner') => setNewDocumentRole(value)}><SelectTrigger className={cn(inputClass, 'w-32 rounded-xl')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Proprietar</SelectItem><SelectItem value="buyer">Cumpărător</SelectItem></SelectContent></Select><Button size="icon" className="shrink-0 rounded-xl" onClick={addDocument}><Plus className="h-4 w-4" /></Button></div>
                  {checklist.length ? checklist.map((item) => (
                    <div key={item.id} className={cn(panelClass, 'p-4')}>
                      <div className="flex items-start gap-3">
                        <Checkbox disabled={!item.downloadUrl} checked={selectedDocumentIds.includes(item.id)} onCheckedChange={(checked) => setSelectedDocumentIds((current) => checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="mt-1" />
                        <div className="min-w-0 flex-1"><p className="font-medium">{item.label}</p><p className="mt-1 truncate text-xs text-[var(--app-muted-foreground)]">{participantRoleLabel(item.participantRole)} · {item.fileName || 'Fișier neprimit'}</p></div>
                        <Select value={item.status} onValueChange={(status: SaleChecklistItem['status']) => setChecklist((current) => current.map((document) => document.id === item.id ? { ...document, status } : document))}><SelectTrigger className={cn(inputClass, 'h-8 w-32 rounded-xl text-xs')}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="required">Necesar</SelectItem><SelectItem value="requested">Solicitat</SelectItem><SelectItem value="received_needs_review">De verificat</SelectItem><SelectItem value="verified">Verificat</SelectItem><SelectItem value="rejected">Respins</SelectItem><SelectItem value="expired">Expirat</SelectItem></SelectContent></Select>
                      </div>
                      {item.fileName ? <div className="mt-3 space-y-2 border-t border-[var(--app-surface-border)] pt-3"><div className="flex flex-wrap gap-1.5"><Badge variant="outline" className="rounded-full text-[10px]">Scanare: {item.scanStatus || 'neefectuată'}</Badge><Badge variant="outline" className="rounded-full text-[10px]">OCR: {item.ocrStatus || 'neefectuat'}</Badge>{typeof item.qualityScore === 'number' ? <Badge variant="outline" className="rounded-full text-[10px]">Calitate {item.qualityScore}%</Badge> : null}{item.reviewStatus ? <Badge variant="outline" className="rounded-full text-[10px]">{item.reviewStatus}</Badge> : null}{item.duplicateOfDocumentId ? <Badge className="rounded-full bg-amber-500/15 text-amber-700">Posibil duplicat</Badge> : null}{item.expiresAt ? <Badge className="rounded-full bg-violet-500/15 text-violet-700">Expiră {new Date(item.expiresAt).toLocaleDateString('ro-RO')}</Badge> : null}</div>{item.extractedTextPreview ? <p className="line-clamp-3 text-xs text-[var(--app-muted-foreground)]">{item.extractedTextPreview}</p> : null}<div className="flex flex-wrap gap-1"><Button variant="ghost" size="sm" onClick={() => void documentAction(item, 'analyze')}>Analizează</Button><Button variant="ghost" size="sm" onClick={() => void documentAction(item, 'approve')}>Aprobă</Button><Button variant="ghost" size="sm" onClick={() => void documentAction(item, 'reject')}>Respinge</Button><Button variant="ghost" size="sm" onClick={() => void documentAction(item, 'rotate_link')}>Rotește linkul</Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => void documentAction(item, 'delete')}>Șterge fișierul</Button></div></div> : null}
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-[var(--app-surface-border)] p-8 text-center text-sm text-[var(--app-muted-foreground)]"><FilePlus2 className="mx-auto mb-2 h-6 w-6" />Adaugă documentele necesare pentru tranzacție.</div>}
                </TabsContent>

                <TabsContent value="questions" className="m-0 space-y-4 p-4">
                  <div className="flex items-center justify-between"><div><p className="font-semibold">Întrebări care cer răspuns</p><p className="text-sm text-[var(--app-muted-foreground)]">Imodeus le numerotează și caută răspunsurile în reply.</p></div><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setQuestions((current) => [...current, makeQuestion()])}><Plus className="mr-1 h-4 w-4" /> Adaugă</Button></div>
                  {questions.map((question, index) => <div key={question.id} className={cn(panelClass, 'space-y-2 p-4')}><div className="flex items-center gap-2"><Badge variant="outline" className="rounded-full">{index + 1}</Badge><Input value={question.text} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))} className={cn(inputClass, 'rounded-xl')} placeholder="Întrebarea…" /></div><div className="flex items-center justify-between pl-10 text-xs text-[var(--app-muted-foreground)]"><span>Răspuns: {question.answer || 'în așteptare'}</span><Button variant="ghost" size="sm" onClick={() => setQuestions((current) => current.filter((item) => item.id !== question.id))}>Șterge</Button></div></div>)}
                  {!questions.length ? <div className="rounded-2xl border border-dashed border-[var(--app-surface-border)] p-8 text-center text-sm text-[var(--app-muted-foreground)]">Nu există întrebări. Mesajul poate fi doar informativ.</div> : null}
                </TabsContent>

                <TabsContent value="replies" className="m-0 space-y-4 p-4"><ForwardingSetup /><SalesOperationsPanel /></TabsContent>

                <TabsContent value="history" className="m-0 space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Istoric conversație</p><p className="text-sm text-[var(--app-muted-foreground)]">Mesajele sunt grupate automat după codul {sale.trackingCode}.</p></div><Button variant="outline" size="sm" className="rounded-xl" onClick={() => void exportDossier()}><Download className="mr-1 h-4 w-4" /> Export</Button></div>
                  {messagesLoading ? <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin" /></div> : messages?.length ? messages.map((message) => (
                    <div key={message.id} className={cn(panelClass, 'p-4', message.direction === 'inbound' && 'border-emerald-500/25 bg-emerald-500/5')}>
                      <div className="flex items-center justify-between gap-2"><Badge variant="outline" className="rounded-full">{message.direction === 'inbound' ? 'Răspuns primit' : 'Trimis'}</Badge><span className="text-xs text-[var(--app-muted-foreground)]">{formatDate(message.receivedAt || message.sentAt || message.createdAt)}</span></div>
                      <p className="mt-3 truncate font-medium">{message.subject}</p><p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-[var(--app-muted-foreground)]">{message.bodyText}</p>
                      {message.attachmentNames?.length ? <p className="mt-3 text-xs"><Paperclip className="mr-1 inline h-3.5 w-3.5" />{message.attachmentNames.join(', ')}</p> : null}
                      {message.direction === 'inbound' && (!message.replyReview || message.replyReview.status === 'pending') ? <div className="mt-3 rounded-xl bg-amber-500/10 p-3"><p className="text-xs font-medium text-amber-700">Interpretare automată — necesită confirmarea agentului</p>{message.questions?.map((question) => <p key={question.id} className="mt-2 text-xs"><span className="font-medium">{question.text}</span><br />{question.answer || question.evidence || 'Răspuns neclar'}</p>)}<div className="mt-3 flex flex-wrap gap-1"><Button size="sm" onClick={() => void reviewReply(message, 'confirmed')}>Confirmă</Button><Button size="sm" variant="outline" onClick={() => void reviewReply(message, 'corrected')}>Confirmă după corectare</Button><Button size="sm" variant="ghost" onClick={() => void reviewReply(message, 'needs_clarification')}>Cere clarificare</Button></div></div> : null}
                      {message.direction === 'outbound' ? <div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-[var(--app-muted-foreground)]">Dovadă: {message.sendEvidence?.level === 'reply_confirmed' ? 'răspuns primit' : message.sendEvidence?.level === 'ui_observed' ? 'confirmare observată în Gmail' : message.sendEvidence?.level === 'agent_confirmed' ? 'confirmat de agent' : 'trimitere neconfirmată'}</span>{message.sendEvidence?.level === 'none' ? <Button size="sm" variant="outline" onClick={() => void confirmSent(message)}>Am trimis în Gmail</Button> : null}</div> : null}
                    </div>
                  )) : <div className="rounded-2xl border border-dashed border-[var(--app-surface-border)] p-8 text-center text-sm text-[var(--app-muted-foreground)]">Încă nu există mesaje în acest dosar.</div>}
                  {auditEvents?.length ? <><Separator /><div><p className="font-semibold">Audit operațional</p><p className="text-xs text-[var(--app-muted-foreground)]">Ultimele acțiuni sensibile din dosar.</p></div>{auditEvents.slice(0, 20).map((event) => <div key={event.id} className="flex gap-3 rounded-xl border border-[var(--app-surface-border)] p-3"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" /><div className="min-w-0"><p className="text-sm font-medium">{event.summary}</p><p className="text-xs text-[var(--app-muted-foreground)]">{formatDate(event.createdAt)} · {event.action}</p></div></div>)}</> : null}
                </TabsContent>
              </ScrollArea>
            </Tabs>

            <div className="shrink-0 border-t border-[var(--app-surface-border)] bg-[var(--app-surface)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="rounded-xl border-[var(--app-surface-border)]" onClick={saveDossier} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardCheck className="mr-2 h-4 w-4" />} Salvează dosarul</Button>
                <Button className="flex-1 rounded-xl bg-emerald-600 text-white shadow-[0_14px_28px_-14px_rgba(16,185,129,.8)] hover:bg-emerald-700" onClick={prepareInGmail} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isDesktop ? <MailCheck className="mr-2 h-4 w-4" /> : <ArrowUpRight className="mr-2 h-4 w-4" />} Pregătește în Gmail <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </div>
              <p className="mt-2 text-center text-[11px] text-[var(--app-muted-foreground)]">Imodeus nu trimite singur și nu folosește parola Gmail. Agentul verifică și apasă „Trimite”.</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
