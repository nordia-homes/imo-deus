'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { romimoFetch } from '@/lib/romimo/browser';
import type { RomimoManagedArticles, RomimoState } from '@/lib/romimo/types';

export default function RomimoManagedArticlesDialog({ connected }: { connected: boolean }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState<RomimoManagedArticles>({ items: [], nextCursor: null });
  const [message, setMessage] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  async function load(cursor?: string) {
    const result = await romimoFetch<RomimoManagedArticles>(user, `listings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);
    setPage(current => ({ items: cursor ? [...current.items, ...result.items] : result.items, nextCursor: result.nextCursor }));
  }
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Operațiunea nu a putut fi finalizată.'); }
    finally { setBusy(false); }
  }
  async function update(propertyId: string, action: 'verify' | 'unpublish') {
    setConfirmId(null);
    try {
      const result = await romimoFetch<{ state: RomimoState; message: string; remoteUrl: string | null }>(user, action, { propertyId });
      setPage(current => ({ ...current, items: current.items.map(item => item.propertyId === propertyId ? { ...item, ...result } : item) }));
      setMessage(result.message);
    } catch (error) {
      await load().catch(() => undefined);
      throw error;
    }
  }
  return <>
    <Button type="button" variant="outline" onClick={() => { setOpen(true); setConfirmId(null); void run(() => load()); }}>Anunțuri gestionate</Button>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Anunțuri Publi24 / Romimo</DialogTitle><DialogDescription>Verifică sau retrage anunțurile trimise din CRM, inclusiv dacă proprietatea a fost ștearsă. Fluxul de scoatere din portofoliu retrage automat anunțurile asociate. Folosește această listă pentru verificări și pentru anunțurile mai vechi rămase fără proprietate.</DialogDescription></DialogHeader>
        {!connected && <p className="text-sm">Reconectează contul pentru a verifica sau retrage anunțuri.</p>}
        {busy && <p role="status">Se procesează…</p>}
        {message && <p role="status" className="rounded-md border p-3 text-sm">{message}</p>}
        {!busy && !page.items.length && <p className="text-sm">Nu există anunțuri trimise în această pagină.</p>}
        {page.items.map(item => <div key={item.propertyId} className="space-y-2 rounded-lg border p-3">
          <p className="font-medium">{item.title}</p>
          <p className="text-sm">{({ published: 'Activ', unpublished: 'Nepublicat', pending: 'De verificat', error: 'Eroare' })[item.state]}</p>
          {item.message && <p className="text-sm text-muted-foreground">{item.message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy || !connected} onClick={() => void run(() => update(item.propertyId, 'verify'))}>Verifică pe portal</Button>
            <Button type="button" variant="outline" disabled={busy || !connected} onClick={() => setConfirmId(item.propertyId)}>Retrage</Button>
            {item.remoteUrl && <Button asChild variant="outline"><a href={item.remoteUrl} target="_blank" rel="noopener noreferrer">Deschide anunțul</a></Button>}
          </div>
          {confirmId === item.propertyId && <div className="space-y-2 rounded-md border border-destructive p-3"><p className="text-sm">Confirmi ștergerea acestui anunț de pe portal?</p><div className="flex gap-2"><Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => update(item.propertyId, 'unpublish'))}>Confirmă retragerea</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmId(null)}>Anulează</Button></div></div>}
        </div>)}
        {page.nextCursor && <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => load(page.nextCursor!))}>Încarcă mai multe</Button>}
        <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => load())}>Reîncarcă lista</Button>
      </DialogContent>
    </Dialog>
  </>;
}
