'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { romimoFetch } from '@/lib/romimo/browser';
import RomimoManagedArticlesDialog from './RomimoManagedArticlesDialog';

type Status = { connected: boolean; email: string; role?: string };
export default function RomimoIntegrationCard({ listings, errors, lastSync }: { listings: number; errors: number; lastSync: string }) {
  const { user } = useUser();
  const { agencyId } = useAgency();
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const result = await romimoFetch<Status>(user, 'status');
    setStatus(result); setEmail(result.email);
  }, [user]);
  useEffect(() => {
    let active = true;
    if (user && agencyId) void romimoFetch<Status>(user, 'status').then(result => {
      if (active) { setStatus(result); setEmail(result.email); }
    }).catch(error => { if (active) setMessage(error instanceof Error ? error.message : 'Conexiunea nu a putut fi verificată.'); });
    return () => { active = false; };
  }, [user, agencyId]);
  async function run(action: 'connect' | 'disconnect' | 'refresh') {
    setBusy(true); setMessage('');
    try {
      if (action !== 'refresh') {
        await romimoFetch(user, action, action === 'connect' ? { apiKey, email } : {});
        setApiKey('');
      }
      await load();
      setMessage(action === 'disconnect' ? 'Cont deconectat. Anunțurile rămân pe portal.' : action === 'connect' ? 'Conexiune verificată. Poți pregăti publicarea din fișa proprietății.' : 'Stare actualizată.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Operațiunea a eșuat.'); }
    finally { setBusy(false); }
  }
  return <Card className="agentfinder-integration-card h-full rounded-[28px] border-emerald-200 bg-white text-slate-950">
    <CardHeader>
      <CardTitle>Publi24 / Romimo</CardTitle>
      <CardDescription>{status ? status.connected ? 'Conectat' : 'Neconectat' : 'Se verifică conexiunea…'}</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-slate-600">{listings} publicate · {errors} erori · Ultima sincronizare: {lastSync}</p>
      <p className="text-sm">Conectează contul oferit de Romimo pentru a publica proprietățile agenției.</p>
      {status?.role === 'admin' && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run('connect'); }}>
        <div><Label htmlFor="romimo-email">Email cont Romimo</Label><Input id="romimo-email" type="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></div>
        <div><Label htmlFor="romimo-key">Cheie API</Label><Input id="romimo-key" type="password" autoComplete="new-password" required value={apiKey} disabled={busy} onChange={event => setApiKey(event.target.value)} /></div>
        <Button type="submit" disabled={busy || !apiKey || !email}>{busy ? 'Se procesează…' : status.connected ? 'Actualizează conexiunea' : 'Conectează'}</Button>
      </form>}
      {status && status.role !== 'admin' && <p className="text-sm">Administratorul agenției poate configura conexiunea.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void run('refresh')}>Verifică starea</Button>
        <RomimoManagedArticlesDialog connected={!!status?.connected} />
        {status?.connected && status.role === 'admin' && <Button type="button" variant="outline" disabled={busy} onClick={() => void run('disconnect')}>Deconectează</Button>}
      </div>
      {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
    </CardContent>
  </Card>;
}
