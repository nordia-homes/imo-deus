'use client';

import { MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Keyboard, Loader2, RefreshCw, Send } from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { facebookCloudFetch } from '@/lib/facebook-cloud-client';
import type { FacebookCloudConnection } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const REMOTE_WIDTH = 1280;
const REMOTE_HEIGHT = 800;

export default function FacebookConnectionConsolePage() {
  const params = useParams<{ connectionId: string }>();
  const connectionId = params?.connectionId ?? '';
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const imageRef = useRef<HTMLImageElement>(null);
  const [snapshotUrl, setSnapshotUrl] = useState('');
  const [connection, setConnection] = useState<FacebookCloudConnection | null>(null);
  const [remoteText, setRemoteText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const sendInput = useCallback(async (input: Record<string, unknown>) => {
    if (!user) return;
    setSending(true);
    try {
      const response = await facebookCloudFetch(
        user,
        `/api/marketing/facebook-cloud/connections/${connectionId}/input`,
        { method: 'POST', body: JSON.stringify(input) }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Comanda nu a putut fi trimisă.');
      setConnection((current) => current ? { ...current, ...body } : body);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Consolă indisponibilă', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setSending(false);
    }
  }, [connectionId, toast, user]);

  useEffect(() => {
    if (!user) return;
    let stopped = false;
    void (async () => {
      try {
        const listResponse = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections');
        const listBody = await listResponse.json().catch(() => ({}));
        if (!listResponse.ok) throw new Error(listBody.message || 'Contul nu a putut fi incarcat.');
        let selected = (listBody.connections || []).find((item: FacebookCloudConnection) => item.id === connectionId) || null;
        if (!selected) throw new Error('Contul Facebook nu a fost gasit.');
        if (!stopped) setConnection(selected);
        if (selected.runnerMode === 'local') {
          if (!window.imodeusDesktop) throw new Error('Conectarea acestui cont trebuie facuta din aplicatia Desktop.');
          await window.imodeusDesktop.openFacebookLocalConnection({ connectionId });
          const refreshed = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections');
          const refreshedBody = await refreshed.json().catch(() => ({}));
          selected = (refreshedBody.connections || []).find((item: FacebookCloudConnection) => item.id === connectionId) || selected;
          if (!stopped) setConnection(selected);
        } else {
          const response = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections/' + connectionId + '/session', { method: 'POST' });
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.message || 'Sesiunea nu a putut fi pornita.');
          if (!stopped) setConnection(body.connection);
        }
      } catch (error) {
        if (!stopped) toast({ variant: 'destructive', title: 'Runner indisponibil', description: error instanceof Error ? error.message : 'A aparut o eroare.' });
      } finally {
        if (!stopped) setLoading(false);
      }
    })();
    return () => { stopped = true; };
  }, [connectionId, toast, user]);
  useEffect(() => {
    if (!user || connection?.runnerMode === 'local') return;
    let stopped = false;
    let currentObjectUrl = '';
    async function refresh() {
      try {
        const response = await facebookCloudFetch(user!, `/api/marketing/facebook-cloud/connections/${connectionId}/snapshot`);
        if (!response.ok) return;
        const objectUrl = URL.createObjectURL(await response.blob());
        if (stopped) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
        currentObjectUrl = objectUrl;
        setSnapshotUrl(objectUrl);
      } catch {
        // The status poll will surface persistent errors.
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1200);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    };
  }, [connection?.runnerMode, connectionId, user]);

  useEffect(() => {
    if (!user || connection?.runnerMode === 'local') return;
    const timer = window.setInterval(async () => {
      const response = await facebookCloudFetch(user, `/api/marketing/facebook-cloud/connections/${connectionId}/session`);
      const body = await response.json().catch(() => ({}));
      if (response.ok) setConnection(body.connection);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [connection?.runnerMode, connectionId, user]);

  function clickBrowser(event: MouseEvent<HTMLImageElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    void sendInput({
      type: 'click',
      x: ((event.clientX - rect.left) / rect.width) * REMOTE_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * REMOTE_HEIGHT,
    });
  }

  async function sendText() {
    if (!remoteText) return;
    await sendInput({ type: 'text', text: remoteText });
    setRemoteText('');
  }

  const connected = connection?.status === 'connected';

  return (
    <div className="min-h-full space-y-4 bg-[#0F1E33] p-4 text-white lg:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" className="border-white/10 bg-white/5 text-white" onClick={() => router.push('/marketing/facebook-accounts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Conectare cont Facebook</h1>
            <p className="text-sm text-white/60">{connection?.label || connection?.displayName || connectionId}</p>
          </div>
        </div>
        {connected ? (
          <Button className="bg-emerald-400 text-slate-950 hover:bg-emerald-300" onClick={() => router.push('/marketing/facebook-accounts')}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Cont conectat
          </Button>
        ) : (
          <div className="flex items-center text-sm text-sky-100">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {connection?.runnerMode === 'local' ? 'Finalizeaza autentificarea in fereastra Facebook' : 'Autentifica-te in browserul de mai jos'}
          </div>
        )}
      </header>

      <Card className="overflow-hidden border-white/10 bg-[#152A47] text-white">
        <CardHeader className="border-b border-white/10">
          <CardTitle className="text-base">{connection?.runnerMode === 'local' ? 'Browser local pe laptop' : 'Browser securizat pe runnerul ImoDeus'}</CardTitle>
        </CardHeader>
          {connection?.runnerMode === 'local' ? (
            <div className="flex min-h-[20rem] flex-col items-center justify-center rounded-xl border border-white/10 bg-black/10 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-sky-300" />
              <h2 className="mt-5 text-lg font-semibold">Conectare prin IP-ul acestui laptop</h2>
              <p className="mt-2 max-w-xl text-sm text-white/60">
                Fereastra Facebook s-a deschis separat. Finalizeaza autentificarea acolo; profilul ramane salvat numai pe acest laptop.
              </p>
            </div>
          ) : (
            <>
        <CardContent className="space-y-4 p-4">
          <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
            {snapshotUrl ? (
              <img
                ref={imageRef}
                src={snapshotUrl}
                alt="Browser Facebook remote"
                className="block aspect-[8/5] w-full cursor-crosshair object-contain"
                draggable={false}
                onClick={clickBrowser}
              />
            ) : (
              <div className="flex aspect-[8/5] items-center justify-center text-white/60">
                {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : 'Se așteaptă captura browserului...'}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Keyboard className="h-4 w-4" />
              Tastatură remote
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="off"
                value={remoteText}
                onChange={(event) => setRemoteText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void sendText();
                  }
                }}
                placeholder="Scrie textul pentru câmpul selectat în browser"
                className="border-white/10 bg-white/5 text-white"
              />
              <Button disabled={!remoteText || sending} onClick={() => void sendText()}>
                <Send className="mr-2 h-4 w-4" />
                Trimite text
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Tab', 'Enter', 'Backspace', 'Escape'].map((key) => (
                <Button key={key} size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => void sendInput({ type: 'key', key })}>
                  {key}
                </Button>
              ))}
              <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => void sendInput({ type: 'wheel', deltaY: 600 })}>Derulează jos</Button>
              <Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white" onClick={() => void sendInput({ type: 'reload' })}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Reîncarcă
              </Button>
            </div>
          </div>
          <p className="text-xs text-white/45">
            Clickurile și textul sunt transmise prin conexiunea autentificată către browserul tău izolat. ImoDeus nu salvează parola introdusă.
          </p>
        </CardContent>
            </>
          )}
      </Card>
    </div>
  );
}
