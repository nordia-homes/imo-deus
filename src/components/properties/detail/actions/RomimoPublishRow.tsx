'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ExternalLink, Loader2, RefreshCcw, Settings2 } from 'lucide-react';
import { useUser } from '@/firebase';
import type { Property } from '@/lib/types';
import type { RomimoPreview, RomimoSettings } from '@/lib/romimo/types';
import { romimoFetch } from '@/lib/romimo/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function RomimoPublishRow({ property }: { property: Property }) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RomimoPreview | null>(null);
  const [draft, setDraft] = useState<RomimoSettings | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = property.promotions?.publi24?.status || 'unpublished';
  const remoteUrl = property.portalProfiles?.publi24?.remoteUrl;
  // Only render links to the two official portals, even if a client edited the profile.
  const safeUrl = remoteUrl && /^https:\/\/(www\.)?(romimo|publi24)\.ro\//i.test(remoteUrl) ? remoteUrl : null;
  async function load(settings?: RomimoSettings) {
    const result = await romimoFetch<RomimoPreview>(user, 'preview', { propertyId: property.id, ...(settings ? { settings } : {}) });
    setPreview(result); setDraft(result.settings); setHash(result.previewHash);
  }
  async function run(work: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await work(); }
    catch (error) { setHash(null); setMessage(error instanceof Error ? error.message : 'Operațiunea a eșuat.'); }
    finally { setBusy(false); }
  }
  function edit(update: Partial<RomimoSettings>) {
    if (draft) setDraft({ ...draft, ...update });
    setHash(null); setMessage('');
  }
  async function action(name: 'publish' | 'verify' | 'unpublish') {
    setHash(null); setConfirmDelete(false);
    let resultMessage: string;
    try {
      const result = await romimoFetch<{ message: string }>(user, name, {
        propertyId: property.id, ...(name === 'publish' ? { settings: draft, previewHash: hash } : {}),
      });
      resultMessage = result.message;
    } catch (error) {
      // The server may have committed the intent even if its response was lost.
      // Refresh authoritative flags so Verify/Withdraw become available.
      await load(draft || undefined).catch(() => undefined);
      setHash(null);
      throw error;
    }
    try { await load(draft || undefined); }
    catch { resultMessage += ' Reîncarcă panoul pentru starea actualizată.'; }
    setHash(null); setMessage(resultMessage);
  }
  return <>
    <div className="grid grid-cols-[minmax(80px,1fr)_70px_76px] items-center gap-2 rounded-xl border border-white/10 p-3 text-sm">
      <span className="font-medium text-white">Publi24<span className="block text-[10px] text-white/60">și Romimo</span></span>
      <span className="text-center text-[11px] text-white/75" title={property.portalProfiles?.publi24?.message}>{({ unpublished: 'Nepublicat', published: 'Activ', pending: 'De verificat', error: 'Eroare' })[status]}</span>
      <div className="flex justify-end gap-1">
        {safeUrl && <Button asChild size="icon" variant="ghost" className="h-8 w-8"><a href={safeUrl} target="_blank" rel="noopener noreferrer" aria-label="Deschide anunțul Romimo"><ExternalLink className="h-4 w-4" /></a></Button>}
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Publicare și administrare Romimo" onClick={() => {
          setOpen(true); setPreview(null); setDraft(null); setHash(null); setConfirmDelete(false); void run(() => load());
        }}><Settings2 className="h-4 w-4" /></Button>
      </div>
    </div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Publicare Publi24 / Romimo</DialogTitle><DialogDescription>Verifică datele anunțului înainte de trimitere. Promovarea plătită nu este activată.</DialogDescription></DialogHeader>
        {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Se procesează…</p>}
        {message && <p role="status" className="rounded-lg border p-3 text-sm">{message}</p>}
        {preview && draft && <>
          {property.status && property.status !== 'Activ' && preview.hasSubmission && <p className="text-sm">Proprietatea nu mai este activă în CRM. Verifică anunțul pe portal și retrage-l dacă oferta nu mai este disponibilă.</p>}
          {!message && preview.lastMessage && <p role="status" className="rounded-lg border p-3 text-sm">{preview.lastMessage}</p>}
          {!preview.connected && <p className="text-sm">Conectează mai întâi contul din <Link href="/portal-sync" className="underline">Integrări</Link>.</p>}
          <div className="rounded-lg border p-3 text-sm"><strong>{preview.summary.title}</strong><p>{preview.summary.price} {draft.currency} · {preview.summary.photos.length} fotografii</p><p className="mt-2 whitespace-pre-wrap">{preview.summary.description}</p></div>
          {!!preview.summary.photos.length && <div className="flex flex-wrap gap-2">{preview.summary.photos.filter(url => /^https?:\/\//i.test(url)).map((url, index) => <Image key={`${index}-${url}`} src={url} alt={`Fotografia ${index + 1} a anunțului`} width={80} height={60} unoptimized className="h-16 w-20 rounded-md object-cover" />)}</div>}
          <fieldset disabled={busy} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">Categorie<select className="mt-1 block w-full rounded-md border bg-background p-2" value={draft.category} onChange={e => edit({ category: Number(e.target.value) })}><option value={0}>Selectează categoria</option>{preview.catalog.categories.map(c => <option key={c.id} value={c.id}>{c.dealType} — {c.description}</option>)}</select></label>
            <label className="text-sm">Monedă<select className="mt-1 block w-full rounded-md border bg-background p-2" value={draft.currency} onChange={e => edit({ currency: e.target.value })}>{preview.catalog.currencies.map(c => <option key={c}>{c}</option>)}</select></label>
            {([
              ['county', 'Județ'], ['city', 'Localitate / sector București'], ['area', 'Zonă (opțional)'],
              ['contactName', 'Nume agent de contact'], ['contactEmail', 'Email agent de contact'], ['contactPhone', 'Telefon agent de contact'],
              ['validFrom', 'Valabil de la'], ['validTo', 'Valabil până la'],
            ] as const).map(([key, label]) => <label key={key} className="text-sm">{label}<Input type={key.startsWith('valid') ? 'date' : key === 'contactEmail' ? 'email' : 'text'} value={draft[key]} onChange={e => edit({ [key]: e.target.value })} /></label>)}
            {preview.catalog.properties.filter(f => f.categoryIds.includes(draft.category)).map(field => <label key={field.key} className="text-sm">{field.description}{field.isRequired ? ' *' : ''}
              {field.valueType === 'Boolean' ? <select className="mt-1 block w-full rounded-md border bg-background p-2" value={draft.fields[field.key] || ''} onChange={e => edit({ fields: { ...draft.fields, [field.key]: e.target.value } })}><option value="">Nespecificat</option><option value="true">Da</option><option value="false">Nu</option></select>
                : field.predefinedValues?.length && !field.multipleValuesAllowed ? <select className="mt-1 block w-full rounded-md border bg-background p-2" value={draft.fields[field.key] || ''} onChange={e => edit({ fields: { ...draft.fields, [field.key]: e.target.value } })}><option value="">Selectează</option>{field.predefinedValues.map(v => <option key={v}>{v}</option>)}</select>
                : <><Input value={draft.fields[field.key] || ''} onChange={e => edit({ fields: { ...draft.fields, [field.key]: e.target.value } })} />{field.multipleValuesAllowed && field.predefinedValues?.length ? <span className="mt-1 block text-xs text-muted-foreground">Valori separate prin „{field.multipleValuesSeparator}”: {field.predefinedValues.join(', ')}</span> : null}</>}
            </label>)}
          </fieldset>
          {!!preview.issues.length && <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">{preview.issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul>}
          {!!preview.warnings.length && <ul className="list-disc space-y-1 pl-5 text-sm">{preview.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
          {preview.hasSubmission && !preview.canUpdate && <p className="text-sm">Actualizarea anunțurilor trimise va fi activată după validarea integrării cu contul de test. Poți verifica sau retrage anunțul existent.</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => load(draft))}>Validează previzualizarea</Button>
            <Button type="button" disabled={busy || !hash || !preview.connected || preview.submissionState === 'pending' || (preview.hasSubmission && !preview.canUpdate)} onClick={() => void run(() => action('publish'))}>{preview.hasSubmission ? 'Actualizează anunțul' : 'Publică anunțul'}</Button>
            <Button type="button" variant="outline" disabled={busy || !preview.connected || !preview.hasSubmission} onClick={() => void run(() => action('verify'))}><RefreshCcw className="mr-2 h-4 w-4" />Verifică pe portal</Button>
            <Button type="button" variant="outline" disabled={busy || !preview.connected || !preview.hasSubmission} onClick={() => setConfirmDelete(true)}>Retrage anunțul</Button>
          </div>
          {confirmDelete && <div className="space-y-2 rounded-lg border border-destructive p-3"><p className="text-sm">Anunțul va fi șters de pe portal. Proprietatea rămâne în CRM.</p><div className="flex gap-2"><Button type="button" variant="destructive" disabled={busy} onClick={() => void run(() => action('unpublish'))}>Confirmă retragerea</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmDelete(false)}>Anulează</Button></div></div>}
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
