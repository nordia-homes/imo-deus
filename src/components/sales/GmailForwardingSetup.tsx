'use client';
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Copy, Loader2, MessageSquareReply, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Connection = { inboundAddress: string; status: 'awaiting_gmail_verification' | 'verification_received' | 'connected' | 'error'; verificationCode?: string | null; lastForwardedAt?: string | null; };
export function GmailForwardingSetup({ compact = false, className }: { compact?: boolean; className?: string }) {
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
    } finally { setLoading(false); }
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
    } finally { setCreating(false); }
  };
  if (loading) return <div className={cn('flex items-center gap-2 rounded-[20px] border border-white/10 bg-white/[.055] p-4 text-sm text-white/65', className)}><Loader2 className="h-4 w-4 animate-spin" /> Verific sincronizarea răspunsurilor…</div>;

  if (compact && !connection) return (
    <div className={cn('rounded-[20px] border border-white/10 bg-white/[.055] p-4 text-white backdrop-blur-xl', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="rounded-xl bg-emerald-400/12 p-2.5 text-emerald-300"><MessageSquareReply className="h-4 w-4" /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Sincronizează răspunsurile</p>
            <p className="mt-0.5 text-xs leading-5 text-white/58">Primești în dosar o copie prin Gmail Forwarding.</p>
          </div>
        </div>
        <Button onClick={create} disabled={creating} className="gmail-forwarding-compact__action h-10 shrink-0 rounded-xl px-4">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Generează adresa
        </Button>
      </div>
    </div>
  );

  if (compact && connection) return (
    <div className={cn('rounded-[20px] border border-white/10 bg-white/[.055] p-4 text-white backdrop-blur-xl', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('rounded-xl p-2.5', connection.status === 'connected' ? 'bg-emerald-400/12 text-emerald-300' : 'bg-amber-400/12 text-amber-300')}>
          {connection.status === 'connected' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{connection.status === 'connected' ? 'Răspunsuri sincronizate' : 'Confirmă forwardingul în Gmail'}</p>
          <p className="truncate text-xs text-white/48">{connection.inboundAddress}</p>
        </div>
        <Button variant="ghost" size="icon" className="gmail-forwarding-compact__refresh h-9 w-9 shrink-0 rounded-xl" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="gmail-forwarding-compact__refresh h-9 w-9 shrink-0 rounded-xl" onClick={() => { void navigator.clipboard.writeText(connection.inboundAddress); toast({ title: 'Adresa a fost copiată' }); }}><Copy className="h-4 w-4" /></Button>
      </div>
      {connection.verificationCode ? <div className="mt-3 rounded-xl bg-emerald-400/10 p-2.5 text-xs text-emerald-700">Cod Gmail detectat: <strong className="ml-1 tracking-[.2em]">{connection.verificationCode}</strong></div> : null}
    </div>
  );
  if (!connection) return (
    <div className={cn('rounded-[26px] border border-white/10 bg-white/[.055] p-5 text-white backdrop-blur-xl', className)}>
      <div className="flex items-start gap-3"><div className="rounded-2xl bg-emerald-400/12 p-3 text-emerald-300"><MessageSquareReply className="h-5 w-5" /></div><div><p className="font-semibold">Sincronizează răspunsurile</p><p className="mt-1 text-sm leading-6 text-white/58">Clienții răspund normal. Imodeus primește o copie prin Gmail Forwarding.</p></div></div>
      <Button onClick={create} disabled={creating} className="mt-5 w-full rounded-xl bg-white text-slate-950 hover:bg-white/90">{creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />} Generează adresa Imodeus</Button>
    </div>
  );
  return (
    <div className={cn('rounded-[26px] border border-white/10 bg-white/[.055] p-5 text-white backdrop-blur-xl', className)}>
      <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className={cn('rounded-2xl p-3', connection.status === 'connected' ? 'bg-emerald-400/12 text-emerald-300' : 'bg-amber-400/12 text-amber-300')}>{connection.status === 'connected' ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}</div><div><p className="font-semibold">{connection.status === 'connected' ? 'Răspunsuri sincronizate' : 'Confirmă forwardingul în Gmail'}</p><p className="text-xs text-white/48">Configurare individuală pentru agent</p></div></div><Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-3"><code className="min-w-0 flex-1 truncate text-xs text-white/75">{connection.inboundAddress}</code><Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-white" onClick={() => { void navigator.clipboard.writeText(connection.inboundAddress); toast({ title: 'Adresa a fost copiată' }); }}><Copy className="h-4 w-4" /></Button></div>
      {connection.verificationCode ? <div className="mt-3 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-100">Cod Gmail detectat: <strong className="ml-1 tracking-[.2em]">{connection.verificationCode}</strong></div> : null}
      {!compact && connection.status !== 'connected' ? <ol className="mt-4 space-y-2 text-sm leading-6 text-white/58"><li>1. Gmail → Settings → Forwarding and POP/IMAP.</li><li>2. Adaugă adresa de mai sus și confirmă codul afișat aici.</li><li>3. Creează filtrul IMD-V și activează forward.</li></ol> : null}
      {connection.status === 'connected' ? <p className="mt-3 text-xs text-white/45">Ultima sincronizare: {connection.lastForwardedAt ? new Date(connection.lastForwardedAt).toLocaleString('ro-RO') : 'conexiunea este pregătită'}</p> : null}
    </div>
  );
}
