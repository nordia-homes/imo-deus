'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/firebase';
import type { Property } from '@/lib/types';
import type { CollaborationListing } from '@/lib/collaboration/model';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ACTION_CARD_CLASSNAME } from '@/components/properties/detail/actions/cardStyles';

export function CollaborationPublishCard({ property }: { property: Property }) {
  const { user } = useUser();
  const [listing, setListing] = useState<CollaborationListing | null>(null);
  const [terms, setTerms] = useState('Comisionul și condițiile vizionării se stabilesc înainte de prezentarea cumpărătorului.');
  const [description, setDescription] = useState(property.description || '');
  const [imageUrls, setImageUrls] = useState<string[]>(property.images.map(image => image.url));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!user) return;
    let active = true;
    user.getIdToken().then(token => fetch(`/api/collaboration?view=my-listing&id=${encodeURIComponent(property.id)}`, { headers: { Authorization: `Bearer ${token}` } })).then(res => res.json()).then(data => { if (active && data.listing) { setListing(data.listing); setTerms(data.listing.terms); setDescription(data.listing.description); setImageUrls(data.listing.images.map((image: {url: string}) => image.url)); } }).catch(() => {});
    return () => { active = false; };
  }, [property.id, user]);
  async function mutate(action: 'publish' | 'close') {
    if (!user) return;
    setBusy(true); setNotice('');
    try {
      const token = await user.getIdToken();
      const response = await fetch('/api/collaboration', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'publish' ? { action, propertyId: property.id, terms, description, imageUrls } : { action, listingId: listing?.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Operația a eșuat.');
      setListing(action === 'publish' ? result.listing : listing ? { ...listing, status: 'closed' } : null);
      setNotice(action === 'publish' ? 'Proprietatea este vizibilă tuturor colaboratorilor activi.' : 'Proprietatea a fost retrasă din colaborare.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'A apărut o eroare.'); }
    finally { setBusy(false); }
  }
  return <Card className={ACTION_CARD_CLASSNAME}><CardHeader className="p-4 pb-2"><CardTitle className="text-xl text-white">Deschide pentru colaborare</CardTitle><p className="text-sm text-white/70">Proprietatea va apărea tuturor colaboratorilor activi. Datele proprietarului și notele CRM nu sunt incluse.</p></CardHeader><CardContent className="space-y-3 p-4 pt-2"><div className="text-sm text-white/80">Status: <strong>{listing?.status === 'active' ? 'Deschisă' : 'Închisă'}</strong></div><label className="block text-sm text-white/80">Descriere pentru colaboratori</label><Textarea value={description} onChange={event => setDescription(event.target.value)} className="min-h-24 bg-white text-slate-950" /><label className="block text-sm text-white/80">Condiții de colaborare</label><Textarea value={terms} onChange={event => setTerms(event.target.value)} className="min-h-20 bg-white text-slate-950" /><p className="text-sm text-white/80">Fotografii partajate</p><div className="grid grid-cols-3 gap-2">{property.images.slice(0, 20).map((image,index) => <label key={`${image.url}-${index}`} className="relative cursor-pointer overflow-hidden rounded-xl border border-white/20"><Image src={image.url} alt={image.alt || ''} width={160} height={80} unoptimized className="h-20 w-full object-cover" /><input type="checkbox" checked={imageUrls.includes(image.url)} onChange={e => setImageUrls(current => e.target.checked ? [...current, image.url] : current.filter(url => url !== image.url))} className="absolute left-2 top-2 h-4 w-4" /><span className="sr-only">Partajează fotografia {index + 1}</span></label>)}</div><div className="flex flex-wrap gap-2"><Button disabled={busy || property.status !== 'Activ'} onClick={() => void mutate('publish')}>{listing?.status === 'active' ? 'Salvează fișa' : 'Deschide pentru colaborare'}</Button>{listing?.status === 'active' && <Button variant="destructive" disabled={busy} onClick={() => void mutate('close')}>Retrage</Button>}{listing?.status === 'active' && <Button variant="outline" asChild><Link href={`/collaboration/properties/${listing.id}`}>Previzualizează</Link></Button>}</div>{notice && <p role="status" className="text-sm text-emerald-200">{notice}</p>}</CardContent></Card>;
}
