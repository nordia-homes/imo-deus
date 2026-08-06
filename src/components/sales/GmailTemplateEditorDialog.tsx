'use client';
import { useEffect, useMemo, useState } from 'react';
import { Mail, Save, ShieldCheck, Sparkles, X } from 'lucide-react';
import { GmailRichTextEditor } from '@/components/sales/GmailRichTextEditor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isEmailAddress, parseEmailList, plainTextToEmailHtml } from '@/lib/email-compose';
import type { SaleParticipantRole, SaleStage, SalesEmailTemplate } from '@/lib/types';
import { cn } from '@/lib/utils';

export type GmailTemplateDraft = { name: string; description: string; recipientRole: SaleParticipantRole; stage: SaleStage | 'any'; subject: string; body: string; bodyHtml: string; defaultCc: string[]; defaultQuestions: string[]; };
type Props = { open: boolean; template: SalesEmailTemplate | null; defaultRecipientRole?: SaleParticipantRole; saving?: boolean; onOpenChange: (open: boolean) => void; onSave: (draft: GmailTemplateDraft) => Promise<void> | void; };
const VARIABLES = ['{{recipient.name}}', '{{property.title}}', '{{property.address}}', '{{documents.list}}', '{{notary.summary}}', '{{agent.name}}'];
const roleName = (role: SaleParticipantRole) => role === 'buyer' ? 'Cumpărător' : role === 'owner' ? 'Proprietar' : role === 'notary' ? 'Notar' : 'Colaborator';

export function GmailTemplateEditorDialog({ open, template, defaultRecipientRole = 'buyer', saving = false, onOpenChange, onSave }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [recipientRole, setRecipientRole] = useState<SaleParticipantRole>('buyer');
  const [stage, setStage] = useState<SaleStage | 'any'>('any');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [defaultCc, setDefaultCc] = useState<string[]>([]);
  const [questions, setQuestions] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(template?.name || ''); setDescription(template?.description || ''); setRecipientRole(template?.recipientRole || defaultRecipientRole); setStage(template?.stage || 'any'); setSubject(template?.subject || ''); setBody(template?.body || ''); setBodyHtml(template?.bodyHtml || plainTextToEmailHtml(template?.body || '')); setDefaultCc(template?.defaultCc || []); setCcInput(''); setQuestions((template?.defaultQuestions || []).join('\n'));
  }, [defaultRecipientRole, open, template]);
  const invalidCc = useMemo(() => defaultCc.filter((email) => !isEmailAddress(email)), [defaultCc]);
  const addCc = () => { const values = parseEmailList(ccInput); if (!values.length) return; setDefaultCc((current) => [...new Set([...current, ...values])]); setCcInput(''); };
  const submit = async () => {
    const cc = [...new Set([...defaultCc, ...parseEmailList(ccInput)])];
    await onSave({ name: name.trim(), description: description.trim(), recipientRole, stage, subject: subject.trim(), body: body.trim(), bodyHtml, defaultCc: cc, defaultQuestions: questions.split('\n').map((item) => item.trim()).filter(Boolean) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[97dvh] w-[99vw] max-w-none flex-col gap-0 overflow-hidden rounded-[30px] border border-slate-200 bg-[#f6f8fc] p-0 text-slate-950 shadow-[0_42px_150px_-32px_rgba(15,23,42,.75)] sm:max-w-none [&>button]:hidden">
        <DialogHeader className="shrink-0 border-b border-slate-200 bg-[radial-gradient(circle_at_10%_0%,rgba(66,133,244,.16),transparent_28%),white] px-5 py-4 md:px-7">
          <div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[conic-gradient(from_210deg,#34a853,#4285f4,#ea4335,#fbbc04,#34a853)] text-white shadow-[0_12px_30px_-12px_rgba(66,133,244,.85)]"><Mail className="h-5 w-5" /></div><div className="min-w-0"><DialogTitle className="truncate text-lg">{template ? 'Editează template-ul' : 'Template Gmail nou'}</DialogTitle><DialogDescription className="truncate text-slate-500">{template ? 'Modificările sunt vizibile numai pentru tine.' : 'Mesajul va arăta în Gmail exact ca în previzualizare.'}</DialogDescription></div></div><div className="flex items-center gap-2">{template ? <Badge className="rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Personalizare privată</Badge> : null}<Button variant="ghost" size="icon" className="rounded-full" onClick={() => onOpenChange(false)}><X className="h-5 w-5" /></Button></div></div>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-b border-slate-200 bg-white p-5 xl:border-b-0 xl:border-r">
            <div className="rounded-[24px] bg-[linear-gradient(145deg,#122a48,#0f513f)] p-5 text-white shadow-[0_24px_55px_-35px_rgba(15,23,42,.85)]"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-emerald-200"><Sparkles className="h-4 w-4" /> Identitatea template-ului</div><p className="mt-3 text-sm leading-6 text-white/65">Alege un nume clar și contextul în care agentul îl va folosi.</p></div>
            <div className="mt-5 space-y-4">
              <div><Label>Nume template</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-slate-50" placeholder="Acte necesare cumpărător" /></div>
              <div><Label>Descriere scurtă</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 h-11 rounded-xl bg-slate-50" placeholder="Când se folosește mesajul" /></div>
              <div><Label>Destinatar principal</Label><Select value={recipientRole} onValueChange={(value: SaleParticipantRole) => setRecipientRole(value)}><SelectTrigger className="mt-1.5 h-11 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="buyer">Cumpărător</SelectItem><SelectItem value="owner">Proprietar</SelectItem><SelectItem value="notary">Notar</SelectItem><SelectItem value="collaborator">Colaborator</SelectItem></SelectContent></Select></div>
              <div><Label>Etapa tranzacției</Label><Select value={stage} onValueChange={(value: SaleStage | 'any') => setStage(value)}><SelectTrigger className="mt-1.5 h-11 rounded-xl bg-slate-50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">Orice etapă</SelectItem><SelectItem value="preparing">Pregătire</SelectItem><SelectItem value="documents">Documente</SelectItem><SelectItem value="notary_scheduling">Programare notar</SelectItem><SelectItem value="ready_to_sign">Gata de semnare</SelectItem><SelectItem value="completed">Finalizată</SelectItem></SelectContent></Select></div>
              <div><Label>Întrebări urmărite, una pe rând</Label><textarea value={questions} onChange={(e) => setQuestions(e.target.value)} className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/30" placeholder="Confirmați că ați primit lista?&#10;Puteți trimite documentele până vineri?" /></div>
            </div>
          </aside>
          <main className="min-h-0 overflow-y-auto p-4 md:p-7">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_28px_80px_-52px_rgba(15,23,42,.75)]">
              <div className="flex items-center justify-between bg-[#404040] px-4 py-3 text-sm font-medium text-white"><span>Mesaj nou</span><span className="text-xs font-normal text-white/55">Previzualizare Gmail</span></div>
              <div className="divide-y divide-slate-100 px-5">
                <div className="flex min-h-12 items-center gap-3 py-2 text-sm"><span className="w-14 shrink-0 text-slate-400">Către</span><span className="rounded-full bg-blue-50 px-3 py-1.5 font-medium text-blue-700">{roleName(recipientRole)}</span></div>
                <div className="flex min-h-12 items-start gap-3 py-2 text-sm"><span className="w-14 shrink-0 pt-2 text-slate-400">Cc</span><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{defaultCc.map((email) => <span key={email} className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1.5', isEmailAddress(email) ? 'bg-slate-100 text-slate-700' : 'bg-red-50 text-red-700')}>{email}<button type="button" onClick={() => setDefaultCc((current) => current.filter((item) => item !== email))}><X className="h-3 w-3" /></button></span>)}<input value={ccInput} onChange={(e) => setCcInput(e.target.value)} onBlur={addCc} onKeyDown={(e) => { if (['Enter', ',', ';'].includes(e.key)) { e.preventDefault(); addCc(); } }} className="h-9 min-w-[220px] flex-1 bg-transparent outline-none placeholder:text-slate-300" placeholder="Adaugă una sau mai multe adrese CC" /></div></div>
                <div className="flex min-h-12 items-center gap-3 py-2 text-sm"><span className="w-14 shrink-0 text-slate-400">Subiect</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-10 min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-slate-300" placeholder="Subiectul mesajului" /></div>
              </div>
              <div className="p-3"><GmailRichTextEditor value={bodyHtml} onChange={(value) => { setBodyHtml(value.html); setBody(value.text); }} minHeight={360} variables={VARIABLES} className="rounded-xl border-0 shadow-none" /></div>
            </div>
            {invalidCc.length ? <p className="mx-auto mt-3 max-w-5xl text-sm text-red-600">Verifică adresele CC: {invalidCc.join(', ')}</p> : null}
          </main>
        </div>
        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-white px-5 py-3 md:px-7"><p className="hidden text-sm text-slate-500 md:block">Modificările unui template existent se salvează numai în profilul tău.</p><div className="ml-auto flex gap-2"><Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>Renunță</Button><Button className="rounded-xl bg-blue-600 px-6 text-white hover:bg-blue-700" disabled={saving || !name.trim() || !subject.trim() || !body.trim() || invalidCc.length > 0} onClick={() => void submit()}><Save className="mr-2 h-4 w-4" />{saving ? 'Se salvează…' : template ? 'Salvează pentru mine' : 'Salvează template-ul'}</Button></div></footer>
      </DialogContent>
    </Dialog>
  );
}
