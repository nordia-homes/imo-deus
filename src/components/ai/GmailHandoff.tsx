'use client';
import { useEffect, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { Button } from '@/components/ui/button';
import type { DesktopGmailRunnerStatus, GmailRunnerSession } from '@/lib/desktop/gmail-runner';

export function GmailHandoff({ saleId, messageId }: { saleId: string; messageId: string }) {
  const { user } = useAgency(), [busy, setBusy] = useState(false), [status, setStatus] = useState('Email pregătit; trimitere neconfirmată.');
  const activeJob = useRef<string | null>(null);
  const endpoint = `/api/sales/${encodeURIComponent(saleId)}/messages/${encodeURIComponent(messageId)}`;
  useEffect(() => {
    const bridge = window.imodeusDesktop;
    if (!bridge?.onGmailRunnerStatusChanged || !user) return;
    return bridge.onGmailRunnerStatusChanged((next: DesktopGmailRunnerStatus) => {
      if (next.saleId !== saleId || next.messageRecordId !== messageId || !activeJob.current || next.jobId !== activeJob.current) return;
      setStatus(next.message);
      if (next.state === 'sent_ui_confirmed') {
        activeJob.current = null;
        void user.getIdToken().then(async token => {
          const response = await fetch(endpoint + '/send-evidence', { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ level: 'ui_observed', diagnostics: { jobId: next.jobId, completedFields: next.completedFields || [], missingFields: next.missingFields || [], attempt: next.attempt || 1, selectorProfile: next.selectorProfile || null } }) });
          if (!response.ok) throw new Error('Confirmarea Gmail nu a fost salvată în CRM.');
          setStatus('Trimiterea a fost observată în Gmail și consemnată în CRM.');
        }).catch(error => setStatus(error instanceof Error ? error.message : 'Evidența nu a fost salvată.'));
      }
    });
  }, [user, saleId, messageId, endpoint]);
  const open = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const response = await fetch(endpoint + '/gmail-session', { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const data = await response.json() as { session: GmailRunnerSession; composeUrl: string; note: string; message?: string };
      if (!response.ok) throw new Error(data.message || 'Emailul nu mai este accesibil.');
      const bridge = window.imodeusDesktop;
      if (bridge?.startGmailRunner && await bridge.isDesktop()) {
        activeJob.current = data.session.jobId;
        const result = await bridge.startGmailRunner({ session: data.session }); setStatus(result.message);
      } else {
        const url = new URL(data.composeUrl);
        if (url.origin !== 'https://mail.google.com') throw new Error('Link Gmail invalid.');
        window.open(url.toString(), '_blank', 'noopener,noreferrer');
        setStatus(data.note + ' Trimiterea rămâne neconfirmată.');
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Gmail nu a putut fi pregătit.'); }
    finally { setBusy(false); }
  };
  return <div className="mt-3 space-y-2"><Button variant="outline" size="sm" disabled={busy || !user} onClick={() => void open()}><Mail className="mr-2 h-4 w-4" />{busy ? 'Se pregătește…' : 'Deschide în Gmail'}</Button><p role="status" className="text-xs text-muted-foreground">{status}</p></div>;
}
