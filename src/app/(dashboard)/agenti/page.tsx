'use client';

import { useEffect, useMemo, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { Building2, Camera, Loader2, Mail, Pencil, Phone, ShieldCheck, UserRound, Users2 } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { useStorage, useUser } from '@/firebase';
import type { UserProfile } from '@/lib/types';
import { AgentManagementCard } from '@/components/settings/AgentManagementCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

function getInitials(name?: string) {
  if (!name) return 'AG';
  return name
    .split(' ')
    .filter(Boolean)
    .map((token) => token[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function AgentsPage() {
  const { user } = useUser();
  const { agency, userProfile } = useAgency();
  const storage = useStorage();
  const { toast } = useToast();
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAgent, setEditingAgent] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [deletingAgent, setDeletingAgent] = useState<UserProfile | null>(null);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);
  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!agency?.id || !user) {
      setAgents([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadAgents() {
      setIsLoading(true);
      try {
        const token = await user.getIdToken(true);
        const response = await fetch('/api/agency/agents', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.message || 'Nu am putut încărca lista agenților.');
        }

        if (!isMounted) return;

        const nextAgents = Array.isArray(payload?.agents) ? payload.agents as UserProfile[] : [];

        setAgents(nextAgents);
      } catch (error) {
        if (!isMounted) return;
        setAgents([]);
        toast({
          title: 'Încărcare eșuată',
          description: error instanceof Error ? error.message : 'Nu am putut încărca agenții.',
          variant: 'destructive',
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAgents();

    return () => {
      isMounted = false;
    };
  }, [agency?.id, toast, user]);

  const agentStats = useMemo(() => {
    const totalAgents = agents.length;
    const admins = agents.filter((agent) => agent.role === 'admin').length;
    const activeAgents = agents.filter((agent) => agent.role === 'agent').length;
    return { totalAgents, admins, activeAgents };
  }, [agents]);

  function handleAgentCreated(agent: UserProfile) {
    setAgents((current) => {
      const nextAgents = [...current.filter((existing) => existing.id !== agent.id), agent];
      return nextAgents.sort((left, right) => {
        if (left.role === 'admin' && right.role !== 'admin') return -1;
        if (left.role !== 'admin' && right.role === 'admin') return 1;
        return left.name.localeCompare(right.name, 'ro');
      });
    });
  }

  function openEditDialog(agent: UserProfile) {
    setEditingAgent(agent);
    setEditName(agent.name || '');
    setEditPhone(agent.phone || '');
    setEditPhotoUrl(agent.photoUrl || '');
  }

  function closeEditDialog() {
    if (isSavingAgent || isUploadingPhoto) return;
    setEditingAgent(null);
    setEditName('');
    setEditPhone('');
    setEditPhotoUrl('');
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !agency?.id || !editingAgent) return;

    setIsUploadingPhoto(true);
    try {
      const photoRef = ref(storage, `agencies/${agency.id}/agents/${editingAgent.id}/profile.jpg`);
      await uploadBytes(photoRef, file);
      const photoURL = await getDownloadURL(photoRef);
      setEditPhotoUrl(photoURL);
      toast({
        title: 'Poză încărcată',
        description: 'Poza a fost încărcată și va fi salvată după confirmarea editării.',
      });
    } catch (error) {
      toast({
        title: 'Încărcare eșuată',
        description: error instanceof Error ? error.message : 'Nu am putut încărca poza agentului.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = '';
    }
  }

  async function handleSaveAgent() {
    if (!user || !editingAgent) return;

    setIsSavingAgent(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/agency/agents/${editingAgent.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
          photoUrl: editPhotoUrl,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut actualiza agentul.');
      }

      const nextAgent = payload.agent as UserProfile;
      setAgents((current) =>
        current
          .map((agent) => (agent.id === nextAgent.id ? nextAgent : agent))
          .sort((left, right) => {
            if (left.role === 'admin' && right.role !== 'admin') return -1;
            if (left.role !== 'admin' && right.role === 'admin') return 1;
            return left.name.localeCompare(right.name, 'ro');
          })
      );

      toast({
        title: 'Agent actualizat',
        description: `${nextAgent.name} are acum datele noi salvate.`,
      });
      closeEditDialog();
    } catch (error) {
      toast({
        title: 'Salvare eșuată',
        description: error instanceof Error ? error.message : 'Nu am putut salva modificările.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingAgent(false);
    }
  }

  async function handleDeleteAgent() {
    if (!user || !deletingAgent) return;

    setIsDeletingAgent(true);
    try {
      const token = await user.getIdToken(true);
      const response = await fetch(`/api/agency/agents/${deletingAgent.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut sterge agentul.');
      }

      setAgents((current) => current.filter((agent) => agent.id !== deletingAgent.id));
      toast({
        title: 'Agent șters',
        description: `${deletingAgent.name} a fost eliminat din agenție.`,
      });
      setDeletingAgent(null);
      if (editingAgent?.id === deletingAgent.id) {
        closeEditDialog();
      }
    } catch (error) {
      toast({
        title: 'Ștergere eșuată',
        description: error instanceof Error ? error.message : 'Nu am putut șterge agentul.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingAgent(false);
    }
  }

  return (
    <div className="space-y-8 p-4 text-white">
      <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.22),_transparent_32%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(14,29,49,1)_55%,_rgba(10,18,33,1)_100%)] p-6 shadow-2xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-100/85">
              <Users2 className="h-3.5 w-3.5" />
              Agenti
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Echipa agenției</h1>
              <p className="mt-2 text-sm leading-7 text-white/72">
                Aici vezi toți agenții activi și poți crea rapid conturi noi pentru echipă, fără să mai intri în Setări.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Total</p>
              <p className="mt-2 text-2xl font-semibold">{isLoading ? '...' : agentStats.totalAgents}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Admini</p>
              <p className="mt-2 text-2xl font-semibold">{isLoading ? '...' : agentStats.admins}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-white/55">Agenți</p>
              <p className="mt-2 text-2xl font-semibold">{isLoading ? '...' : agentStats.activeAgents}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {isLoading ? (
          [...Array(3)].map((_, index) => (
            <Card key={index} className="rounded-[26px] border-none bg-[#152A47] text-white shadow-2xl">
              <CardHeader>
                <Skeleton className="h-14 w-14 rounded-2xl bg-white/15" />
                <Skeleton className="mt-4 h-6 w-40 bg-white/15" />
                <Skeleton className="h-4 w-24 bg-white/10" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-12 w-full bg-white/10" />
                <Skeleton className="h-12 w-full bg-white/10" />
              </CardContent>
            </Card>
          ))
        ) : agents.length ? (
          agents.map((agent) => (
            <Card
              key={agent.id}
              className="group rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,_rgba(21,42,71,1)_0%,_rgba(16,32,55,1)_100%)] text-white shadow-2xl transition-transform duration-200 hover:-translate-y-1"
            >
              <CardHeader className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <Avatar className="h-14 w-14 rounded-2xl border border-white/10">
                    <AvatarImage src={agent.photoUrl || undefined} alt={agent.name || 'Agent'} />
                    <AvatarFallback className="rounded-2xl bg-gradient-to-br from-emerald-300/25 via-cyan-300/20 to-white/10 text-lg font-semibold text-white">
                      {getInitials(agent.name)}
                    </AvatarFallback>
                  </Avatar>
                  <Badge variant={agent.role === 'admin' ? 'default' : 'secondary'} className={agent.role === 'admin' ? '' : 'border-none bg-white/15 text-white'}>
                    {agent.role === 'admin' ? 'Admin' : 'Agent'}
                  </Badge>
                </div>
                <div>
                  <CardTitle className="text-xl font-semibold text-white">{agent.name}</CardTitle>
                  <CardDescription className="mt-1 text-white/62">
                    {agent.role === 'admin' ? 'Administratorul agenției' : 'Membru al echipei comerciale'}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
                  <div className="flex items-center gap-3 text-sm text-white/80">
                    <Mail className="h-4 w-4 text-emerald-200" />
                    <span className="truncate">{agent.email}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
                  <div className="flex items-center gap-3 text-sm text-white/80">
                    <Phone className="h-4 w-4 text-emerald-200" />
                    <span>{agent.phone || 'Telefon necompletat'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/50">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Rol
                    </div>
                    <p className="mt-2 text-sm font-medium text-white">{agent.role === 'admin' ? 'Admin' : 'Agent'}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/6 p-3">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/50">
                      <Building2 className="h-3.5 w-3.5" />
                      Agenție
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-white">{agency?.name || 'Agenția curentă'}</p>
                  </div>
                </div>
                {agent.id === userProfile?.id ? (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3 text-sm text-emerald-50">
                    Acesta este contul tău curent.
                  </div>
                ) : null}
                {isAdmin && agent.role === 'agent' ? (
                  <div className="pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openEditDialog(agent)}
                      className="w-full border-white/15 bg-white/8 text-white hover:bg-white/14"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Editează agent
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="col-span-full rounded-[26px] border border-white/10 bg-[#152A47] text-white shadow-2xl">
            <CardHeader>
              <CardTitle>Niciun agent încă</CardTitle>
              <CardDescription className="text-white/65">
                Creează primul cont de agent din cardul de management de mai jos.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>

      {agency && isAdmin ? (
        <AgentManagementCard
          agency={agency}
          agents={agents}
          isLoading={isLoading}
          onAgentCreated={handleAgentCreated}
        />
      ) : null}

      <Dialog open={Boolean(editingAgent)} onOpenChange={(open) => (!open ? closeEditDialog() : undefined)}>
        <DialogContent className="border-white/10 bg-[#152A47] text-white sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Editează agent</DialogTitle>
            <DialogDescription className="text-white/65">
              Actualizează rapid poza de profil și datele principale ale agentului.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
              <Avatar className="h-24 w-24 border border-white/10">
                <AvatarImage src={editPhotoUrl || undefined} alt={editName || 'Agent'} />
                <AvatarFallback className="bg-white/10 text-2xl text-white">
                  {getInitials(editName || editingAgent?.name)}
                </AvatarFallback>
              </Avatar>
              <Label
                htmlFor="agent-photo-upload"
                className="inline-flex cursor-pointer items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
              >
                {isUploadingPhoto ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                Schimbă poza
              </Label>
              <input
                id="agent-photo-upload"
                type="file"
                accept="image/png, image/jpeg"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name" className="text-white/85">Nume</Label>
                <Input
                  id="agent-name"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  className="border-white/20 bg-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-phone" className="text-white/85">Telefon</Label>
                <Input
                  id="agent-phone"
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  className="border-white/20 bg-white/10 text-white"
                  placeholder="+40 723 000 111"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-email" className="text-white/85">Email</Label>
              <Input
                id="agent-email"
                value={editingAgent?.email || ''}
                disabled
                className="border-white/10 bg-white/5 text-white/70"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeEditDialog}
              disabled={isSavingAgent || isUploadingPhoto}
              className="border-white/15 bg-white/8 text-white hover:bg-white/14"
            >
              Anulează
            </Button>
            <Button
              type="button"
              onClick={handleSaveAgent}
              disabled={isSavingAgent || isUploadingPhoto || !editName.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSavingAgent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
              Salvează modificările
            </Button>
            {editingAgent?.role === 'agent' ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeletingAgent(editingAgent)}
                disabled={isSavingAgent || isUploadingPhoto}
                className="border-red-400/25 bg-red-500/10 text-red-100 hover:bg-red-500/20"
              >
                Șterge agentul
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deletingAgent)} onOpenChange={(open) => (!open ? setDeletingAgent(null) : undefined)}>
        <AlertDialogContent className="border-white/10 bg-[#152A47] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi acest agent?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Contul agentului va fi eliminat din agenție și nu va mai putea intra în platformă.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/15 bg-white/8 text-white hover:bg-white/14">Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingAgent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
