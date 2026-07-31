'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Facebook,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { facebookCloudFetch } from '@/lib/facebook-cloud-client';
import type { FacebookCloudConnection } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Payload = {
  connections: FacebookCloudConnection[];
  defaultConnectionId: string | null;
};

function statusView(status: FacebookCloudConnection['status']) {
  if (status === 'connected') {
    return { label: 'Conectat', className: 'bg-emerald-500/15 text-emerald-200', icon: CheckCircle2 };
  }
  if (status === 'connecting') {
    return { label: 'Conectare în curs', className: 'bg-sky-500/15 text-sky-200', icon: Loader2 };
  }
  if (status === 'needs_reauthentication') {
    return { label: 'Necesită reconectare', className: 'bg-amber-500/15 text-amber-100', icon: AlertTriangle };
  }
  return { label: 'Indisponibil', className: 'bg-rose-500/15 text-rose-100', icon: WifiOff };
}

export default function FacebookAccountsPage() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [payload, setPayload] = useState<Payload>({ connections: [], defaultConnectionId: null });
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingConnection, setEditingConnection] = useState<FacebookCloudConnection | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Conturile Facebook nu au putut fi încărcate.');
      setPayload(body);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Conturi Facebook indisponibile',
        description: error instanceof Error ? error.message : 'A apărut o eroare.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addConnection() {
    if (!user || actionId) return;
    setActionId('new');
    try {
      const response = await facebookCloudFetch(user, '/api/marketing/facebook-cloud/connections', {
        method: 'POST',
        body: JSON.stringify({ label: newLabel }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Contul nu a putut fi creat.');
      setAddOpen(false);
      setNewLabel('');
      router.push(body.connectHref);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Conectare eșuată',
        description: error instanceof Error ? error.message : 'A apărut o eroare.',
      });
    } finally {
      setActionId(null);
    }
  }

  async function setDefault(connection: FacebookCloudConnection) {
    if (!user) return;
    setActionId(connection.id);
    try {
      const response = await facebookCloudFetch(user, `/api/marketing/facebook-cloud/connections/${connection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ setDefault: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Contul implicit nu a putut fi salvat.');
      setPayload((current) => ({ ...current, defaultConnectionId: connection.id }));
      toast({ title: 'Cont implicit salvat', description: connection.label || connection.displayName });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Salvare eșuată', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setActionId(null);
    }
  }

  async function renameConnection() {
    if (!user || !editingConnection || actionId) return;
    const label = editLabel.trim();
    if (!label) return;
    setActionId(editingConnection.id);
    try {
      const response = await facebookCloudFetch(user, `/api/marketing/facebook-cloud/connections/${editingConnection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Numele contului nu a putut fi salvat.');
      setPayload((current) => ({
        ...current,
        connections: current.connections.map((connection) => (
          connection.id === editingConnection.id ? { ...connection, label } : connection
        )),
      }));
      setEditingConnection(null);
      setEditLabel('');
      toast({ title: 'Nume actualizat', description: label });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Redenumire eșuată', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setActionId(null);
    }
  }

  async function removeConnection(connection: FacebookCloudConnection) {
    if (!user || !window.confirm(`Elimini contul „${connection.label || connection.displayName}” și sesiunea lui cloud?`)) return;
    setActionId(connection.id);
    try {
      const response = await facebookCloudFetch(user, `/api/marketing/facebook-cloud/connections/${connection.id}`, {
        method: 'DELETE',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Contul nu a putut fi eliminat.');
      setPayload((current) => ({
        connections: current.connections.filter((item) => item.id !== connection.id),
        defaultConnectionId: current.defaultConnectionId === connection.id ? null : current.defaultConnectionId,
      }));
      toast({ title: 'Cont eliminat', description: 'Profilul browserului a fost șters de pe runner.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Ștergere eșuată', description: error instanceof Error ? error.message : 'A apărut o eroare.' });
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="min-h-full space-y-6 bg-[#0F1E33] p-4 text-white lg:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-1.5 text-sm text-sky-100">
            <Facebook className="mr-2 h-4 w-4" />
            Marketing
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">Conturi Facebook</h1>
          <p className="mt-2 max-w-3xl text-white/65">
            Conectează conturile independente folosite pentru publicarea automată în grupuri. Fiecare cont are o sesiune și o coadă separată.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reîmprospătează
          </Button>
          <Button className="bg-sky-400 text-slate-950 hover:bg-sky-300" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adaugă un cont
          </Button>
        </div>
      </header>

      {loading ? (
        <Card className="border-white/10 bg-[#152A47] text-white">
          <CardContent className="flex items-center justify-center p-12 text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Se încarcă...
          </CardContent>
        </Card>
      ) : payload.connections.length === 0 ? (
        <Card className="border-dashed border-white/15 bg-[#152A47] text-white">
          <CardContent className="flex flex-col items-center p-12 text-center">
            <Facebook className="h-12 w-12 text-sky-200" />
            <h2 className="mt-4 text-xl font-semibold">Nu ai conturi conectate</h2>
            <p className="mt-2 max-w-lg text-white/60">Adaugă primul cont pentru a putea porni publicări automate direct din proprietăți.</p>
            <Button className="mt-6 bg-sky-400 text-slate-950 hover:bg-sky-300" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Adaugă primul cont
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {payload.connections.map((connection) => {
            const view = statusView(connection.status);
            const StatusIcon = view.icon;
            const isDefault = payload.defaultConnectionId === connection.id;
            return (
              <Card key={connection.id} className="border-white/10 bg-[#152A47] text-white shadow-xl">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{connection.label || connection.displayName}</CardTitle>
                      {connection.displayName ? (
                        <CardDescription className="mt-1 text-white/55">Cont Facebook: {connection.displayName}</CardDescription>
                      ) : null}
                    </div>
                    <Badge className={view.className}>
                      <StatusIcon className={`mr-1 h-3.5 w-3.5 ${connection.status === 'connecting' ? 'animate-spin' : ''}`} />
                      {view.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-white/8 bg-black/10 p-3 text-sm text-white/60">
                    Ultima verificare: {connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toLocaleString('ro-RO') : 'niciodată'}
                    {connection.lastError ? <p className="mt-2 text-rose-200">{connection.lastError}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => router.push(`/marketing/facebook-accounts/${connection.id}/connect`)}
                    >
                      {connection.status === 'connected' ? 'Deschide sesiunea' : 'Conectează'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={actionId === connection.id}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => {
                        setEditingConnection(connection);
                        setEditLabel(connection.label || connection.displayName || '');
                      }}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editează numele
                    </Button>
                    <Button
                      variant="outline"
                      disabled={isDefault || actionId === connection.id}
                      className="border-white/10 bg-white/5 text-white hover:bg-white/10"
                      onClick={() => void setDefault(connection)}
                    >
                      {actionId === connection.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                      {isDefault ? 'Cont implicit' : 'Setează implicit'}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={actionId === connection.id}
                      className="border-rose-300/20 bg-rose-500/10 text-rose-100 hover:bg-rose-500/15"
                      onClick={() => void removeConnection(connection)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Elimină
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adaugă un cont Facebook</DialogTitle>
            <DialogDescription>
              Eticheta este vizibilă numai în ImoDeus și te ajută să diferențiezi conturile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="facebook-account-label">Etichetă</Label>
            <Input
              id="facebook-account-label"
              value={newLabel}
              onChange={(event) => setNewLabel(event.target.value)}
              placeholder="Ex: Cont Cristian București"
              maxLength={80}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Anulează</Button>
            <Button disabled={actionId === 'new'} onClick={() => void addConnection()}>
              {actionId === 'new' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continuă la Facebook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingConnection)}
        onOpenChange={(open) => {
          if (!open && !actionId) {
            setEditingConnection(null);
            setEditLabel('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editează numele contului</DialogTitle>
            <DialogDescription>
              Numele este folosit numai pentru afișare în ImoDeus. Contul și sesiunea Facebook nu se modifică.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="facebook-account-edit-label">Nume afișat</Label>
            <Input
              id="facebook-account-edit-label"
              value={editLabel}
              onChange={(event) => setEditLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void renameConnection();
                }
              }}
              placeholder="Ex: Cont Oana București"
              maxLength={80}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={Boolean(actionId)}
              onClick={() => {
                setEditingConnection(null);
                setEditLabel('');
              }}
            >
              Anulează
            </Button>
            <Button disabled={!editLabel.trim() || Boolean(actionId)} onClick={() => void renameConnection()}>
              {actionId === editingConnection?.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvează numele
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
