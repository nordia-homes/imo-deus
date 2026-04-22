'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Globe,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  ExternalLink,
  Link as LinkIcon,
  RefreshCw,
  ShieldCheck,
  Copy,
  Camera,
  Loader2,
} from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';
import { getCanonicalCustomDomain } from '@/lib/domain-routing';
import type { CustomDomainApiResult, CustomDomainInstructionRow } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const formSchema = z.object({
  customDomain: z.string().optional(),
});

function StatusBadge({ status }: { status?: 'pending' | 'connected' | 'error' }) {
  if (status === 'connected') {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/15">
        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
        Conectat
      </Badge>
    );
  }

  if (status === 'error') {
    return (
      <Badge variant="destructive">
        <AlertTriangle className="mr-1 h-3.5 w-3.5" />
        Necesita verificare
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-500/15 text-amber-200 hover:bg-amber-500/15">
      <Clock3 className="mr-1 h-3.5 w-3.5" />
      In asteptare
    </Badge>
  );
}

function DomainStateBadge({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  const normalized = value || 'Necunoscut';
  const isActive = normalized.endsWith('ACTIVE');
  const isIssue = normalized.endsWith('ERROR') || normalized.endsWith('CONFLICT') || normalized.endsWith('FAILED');

  return (
    <div className="agentfinder-custom-domain-state rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className={`mt-1 text-sm font-medium ${isActive ? 'text-emerald-200' : isIssue ? 'text-rose-200' : 'text-white/80'}`}>
        {normalized.replaceAll('_', ' ')}
      </p>
    </div>
  );
}

async function buildAuthHeaders(getToken: () => Promise<string>) {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function readApiPayload(response: Response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  throw new Error(
    stripped || 'Serverul a raspuns cu un format invalid in loc de JSON.'
  );
}

async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = value;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

function InstructionTable({ instructions }: { instructions: CustomDomainInstructionRow[] }) {
  if (!instructions.length) {
    return (
      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
        Firebase nu mai cere modificari DNS pentru acest domeniu. Verificarea si certificatul par sa fie in regula.
      </div>
    );
  }

  return (
    <div className="agentfinder-custom-domain-table overflow-hidden rounded-2xl border border-white/10">
      <div className="agentfinder-custom-domain-table-header grid grid-cols-[90px_90px_1fr_1.2fr_54px] bg-white/5 px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-white/45">
        <span>Actiune</span>
        <span>Tip</span>
        <span>Host</span>
        <span>Valoare</span>
        <span className="text-right">Copy</span>
      </div>
      <div className="agentfinder-custom-domain-table-body divide-y divide-white/10 bg-[#10261f]/75">
        {instructions.map((instruction, index) => (
          <div key={`${instruction.action}-${instruction.type}-${instruction.host}-${instruction.value}-${index}`} className="agentfinder-custom-domain-table-row grid grid-cols-[90px_90px_1fr_1.2fr_54px] items-start gap-3 px-4 py-4 text-sm text-white/85">
            <span className={instruction.action === 'REMOVE' ? 'text-rose-200' : 'text-emerald-200'}>
              {instruction.action}
            </span>
            <span>{instruction.type}</span>
            <span className="break-all">{instruction.host}</span>
            <span className="break-all text-white/75">{instruction.value}</span>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10"
                onClick={() => void copyToClipboard(instruction.value)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomDomainPage() {
  const { agency, user, userProfile, isAgencyLoading } = useAgency();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploadingShareImage, setIsUploadingShareImage] = useState(false);
  const [modalData, setModalData] = useState<CustomDomainApiResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customDomain: '',
    },
  });

  useEffect(() => {
    if (agency) {
      form.reset({
        customDomain: agency.customDomain || '',
      });
    }
  }, [agency, form]);

  const currentDomain = getCanonicalCustomDomain(agency?.customDomain);
  const previewUrl = agency?.id ? `/agencies/${agency.id}` : '';
  const mappedAliases = useMemo(
    () => agency?.customDomainAliases?.length ? agency.customDomainAliases : currentDomain ? [currentDomain, `www.${currentDomain}`] : [],
    [agency?.customDomainAliases, currentDomain]
  );
  const modalAliases = useMemo(
    () => Array.from(new Set((modalData?.aliases || []).filter((alias): alias is string => Boolean(alias)))),
    [modalData?.aliases]
  );

  async function getToken() {
    if (!user) {
      throw new Error('Trebuie sa fii autentificat pentru a configura domeniul custom.');
    }

    return user.getIdToken();
  }

  async function showDomainModal(result: CustomDomainApiResult, successMessage: string) {
    setModalData(result);
    setIsModalOpen(true);
    toast({
      title: 'Configuratie pregatita',
      description: successMessage,
    });
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const normalizedCustomDomain = getCanonicalCustomDomain(values.customDomain);

    if (!normalizedCustomDomain) {
      toast({
        variant: 'destructive',
        title: 'Domeniu lipsa',
        description: 'Introdu un domeniu valid inainte sa continui.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/custom-domain/setup', {
        method: 'POST',
        headers: await buildAuthHeaders(getToken),
        body: JSON.stringify({ domain: normalizedCustomDomain }),
      });

      const payload = await readApiPayload(response);
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut configura domeniul custom.');
      }

      form.setValue('customDomain', payload.primaryDomain, { shouldDirty: false });
      await showDomainModal(
        payload as CustomDomainApiResult,
        'Am pregatit instructiunile exacte de DNS din Firebase App Hosting. Le poti copia direct in registrar.'
      );
    } catch (error) {
      console.error('Failed to set up custom domain:', error);
      toast({
        variant: 'destructive',
        title: 'Configurare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut configura domeniul custom.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshStatus() {
    const normalizedCustomDomain = getCanonicalCustomDomain(form.getValues('customDomain') || currentDomain);
    if (!normalizedCustomDomain) {
      toast({
        variant: 'destructive',
        title: 'Domeniu lipsa',
        description: 'Salveaza mai intai un domeniu pentru a verifica statusul.',
      });
      return;
    }

    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/custom-domain/status?domain=${encodeURIComponent(normalizedCustomDomain)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${await getToken()}`,
        },
      });

      const payload = await readApiPayload(response);
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut verifica statusul domeniului.');
      }

      await showDomainModal(
        payload as CustomDomainApiResult,
        'Am actualizat statusul din Firebase App Hosting si am reimprospatat instructiunile DNS.'
      );
    } catch (error) {
      console.error('Failed to refresh custom domain status:', error);
      toast({
        variant: 'destructive',
        title: 'Verificare esuata',
        description: error instanceof Error ? error.message : 'Nu am putut verifica statusul domeniului.',
      });
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleShareImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !agency?.id || userProfile?.role !== 'admin') return;

    try {
      setIsUploadingShareImage(true);
      const shareImageRef = ref(storage, `agencies/${agency.id}/share/share-image-${Date.now()}`);
      await uploadBytes(shareImageRef, file);
      const downloadURL = await getDownloadURL(shareImageRef);
      await updateDoc(doc(firestore, 'agencies', agency.id), {
        shareImageUrl: downloadURL,
      });

      toast({
        title: 'Imagine actualizata',
        description: 'Imaginea reprezentativa pentru distribuirea website-ului public a fost salvata.',
      });
    } catch (error) {
      console.error('Failed to upload share image:', error);
      toast({
        variant: 'destructive',
        title: 'Upload esuat',
        description: 'Nu am putut salva imaginea reprezentativa.',
      });
    } finally {
      setIsUploadingShareImage(false);
      event.target.value = '';
    }
  }

  if (isAgencyLoading) {
    return (
      <div className="space-y-8 bg-[#0F1E33] p-4 text-white">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="agentfinder-custom-domain-page space-y-8 bg-[#0F1E33] p-4 text-white">
        <div className="agentfinder-custom-domain-hero space-y-2">
          <div className="agentfinder-custom-domain-eyebrow inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-1.5 text-sm font-medium text-emerald-200">
            <Globe className="mr-2 h-4 w-4" />
            Domeniu custom
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Website public pe domeniul agentiei</h1>
          <p className="max-w-3xl text-white/70">
            Introdu domeniul agentiei, iar platforma va pregati server-side instructiunile exacte din Firebase App Hosting pentru registrar.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="agentfinder-custom-domain-card rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
            <CardHeader>
              <CardTitle>Domeniul agentiei</CardTitle>
              <CardDescription className="text-white/70">
                Dupa salvare, deschidem automat instructiunile DNS reale generate de Firebase App Hosting, inclusiv valorile care trebuie adaugate in registrar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="customDomain"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-white/80">Domeniu custom</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="example.ro"
                            className="h-12 rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/45"
                          />
                        </FormControl>
                        <FormDescription className="text-white/65">
                          Poti introduce `example.ro` sau `www.example.ro`. Sistemul normalizeaza automat domeniul principal si pregateste si varianta `www`.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">Status curent</p>
                      <div className="mt-3">
                        <StatusBadge status={agency?.customDomainStatus} />
                      </div>
                    </div>
                    <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/55">Domeniu activ</p>
                      <p className="mt-3 break-all text-base font-semibold text-white">
                        {currentDomain || 'Nesetat'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="submit"
                      disabled={isSubmitting || userProfile?.role !== 'admin'}
                      className="rounded-full bg-emerald-400 px-7 text-black hover:bg-emerald-300"
                    >
                      {isSubmitting ? 'Pregatesc instructiunile...' : 'Salveaza si vezi instructiunile DNS'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isRefreshing || !form.getValues('customDomain') || userProfile?.role !== 'admin'}
                      onClick={() => void handleRefreshStatus()}
                      className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      Verifica din nou
                    </Button>
                    {previewUrl ? (
                      <Button asChild variant="outline" className="rounded-full border-white/10 bg-white/5 text-white hover:bg-white/10">
                        <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                          Vezi website-ul curent
                          <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    ) : null}
                  </div>

                  {userProfile?.role !== 'admin' ? (
                    <p className="text-sm text-white/65">Doar administratorii agentiei pot modifica domeniul custom.</p>
                  ) : null}
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="agentfinder-custom-domain-card rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
              <CardHeader>
                <CardTitle>Ce primeste agentia dupa salvare</CardTitle>
                <CardDescription className="text-white/70">
                  Nu afisam instructiuni generice. Modalul iti va arata exact ce cere Firebase App Hosting pentru domeniul introdus.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">1. Domeniul este legat la backend-ul public</p>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    Serverul aplicației initializeaza legatura cu backend-ul App Hosting si salveaza maparea corecta pentru agentie.
                  </p>
                </div>
                <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">2. Vezi exact ce trebuie sa pui in registrar</p>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    Afisam tipul inregistrarii, host-ul, valoarea si actiunea ceruta (`ADD` sau `REMOVE`) exact din raspunsul Firebase.
                  </p>
                </div>
                <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">3. Reverifici SSL si ownership dintr-un click</p>
                  <p className="mt-2 text-sm leading-7 text-white/70">
                    Butonul de reverificare citeste din nou statusul din App Hosting si actualizeaza pagina cu cele mai noi cerinte DNS.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="agentfinder-custom-domain-card rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
              <CardHeader>
                <CardTitle>Imagine reprezentativa la distribuire</CardTitle>
                <CardDescription className="text-white/70">
                  Aceasta imagine va fi folosita cand website-ul public al agentiei este distribuit pe social media sau in aplicatii de mesagerie.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="agentfinder-custom-domain-panel overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {agency?.shareImageUrl ? (
                    <img
                      src={agency.shareImageUrl}
                      alt="Imagine reprezentativa website public"
                      className="h-52 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-[linear-gradient(160deg,rgba(8,20,14,0.98),rgba(11,14,13,0.98)_55%,rgba(16,28,20,0.96))] text-center text-white/60">
                      Inca nu ai incarcat o imagine reprezentativa pentru distribuirea website-ului public.
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    disabled={isUploadingShareImage || userProfile?.role !== 'admin'}
                    className="rounded-full bg-emerald-400 px-6 text-black hover:bg-emerald-300"
                    onClick={() => document.getElementById('share-image-upload')?.click()}
                  >
                    {isUploadingShareImage ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Se incarca...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Incarca imaginea
                      </>
                    )}
                  </Button>
                  <input
                    id="share-image-upload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleShareImageUpload}
                  />
                  <p className="text-sm leading-7 text-white/65">
                    Pentru paginile de detaliu proprietate, imaginea reprezentativa va fi prima poza din galeria proprietatii.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="agentfinder-custom-domain-card rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
              <CardHeader>
                <CardTitle>Preview si fallback</CardTitle>
                <CardDescription className="text-white/70">
                  Pana cand domeniul custom este conectat complet, website-ul public al agentiei ramane disponibil pe ruta standard.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55">Fallback public</p>
                  <p className="mt-2 break-all text-sm font-medium text-emerald-200">
                    {previewUrl || 'Ruta publica indisponibila'}
                  </p>
                </div>
                <div className="agentfinder-custom-domain-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/55">Aliasuri pregatite</p>
                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    {mappedAliases.length ? mappedAliases.map((alias) => (
                      <p key={alias} className="flex items-center gap-2">
                        <LinkIcon className="h-4 w-4 text-emerald-300" />
                        {alias}
                      </p>
                    )) : (
                      <p className="text-white/55">Niciun alias salvat inca.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="agentfinder-custom-domain-dialog max-h-[90vh] max-w-5xl overflow-hidden rounded-[28px] border-white/10 bg-[#081811] p-0 text-white shadow-[0_40px_120px_rgba(0,0,0,0.55)]">
          <DialogHeader className="agentfinder-custom-domain-dialog-header border-b border-white/10 bg-[linear-gradient(160deg,rgba(31,82,63,0.92),rgba(8,24,17,0.96))] px-6 py-6 sm:px-8">
            <DialogTitle className="text-2xl font-semibold text-white">
              Instructiuni DNS generate de Firebase App Hosting
            </DialogTitle>
            <DialogDescription className="max-w-3xl text-sm leading-7 text-emerald-50/80">
              Valorile de mai jos vin din Firebase App Hosting pentru domeniul introdus si sunt cele pe care agentia trebuie sa le seteze in registrar.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-120px)] overflow-y-auto px-6 py-6 sm:px-8">
            {modalData ? (
              <div className="space-y-6">
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="agentfinder-custom-domain-dialog-panel rounded-[24px] border border-emerald-400/20 bg-[linear-gradient(160deg,rgba(18,49,39,0.96),rgba(8,16,13,0.98))] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className="bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/15">
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                        DNS exact din Firebase
                      </Badge>
                      <StatusBadge status={modalData.overallStatus} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">{modalData.primaryDomain}</h3>
                    <p className="mt-2 text-sm leading-7 text-white/70">
                      Daca registrarul foloseste coloanele `Type`, `Name/Host`, `Value/Target`, copiaza exact valorile din tabelul de mai jos.
                    </p>
                  </div>

                  <div className="grid gap-3">
                    <div className="agentfinder-custom-domain-dialog-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Aliasuri incluse</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {modalAliases.map((alias) => (
                          <Badge key={alias} className="bg-white/10 text-white hover:bg-white/10">{alias}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="agentfinder-custom-domain-dialog-panel rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/45">Verificare rapida</p>
                      <p className="mt-2 text-sm leading-7 text-white/70">
                        Dupa ce actualizezi registrarul, apasa `Verifica din nou` din pagina principala a domeniului. Statusurile se vor actualiza din backend.
                      </p>
                    </div>
                  </div>
                </div>

                {modalData.domains.map((domain) => (
                  <div key={domain.domainName} className="agentfinder-custom-domain-dialog-panel rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,rgba(9,22,17,0.98),rgba(8,14,12,0.98))] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">Domeniu</p>
                        <h4 className="mt-2 text-xl font-semibold text-white">{domain.domainName}</h4>
                        <p className="mt-2 break-all text-sm text-white/55">{domain.resourceName}</p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <DomainStateBadge label="Host" value={domain.hostState} />
                        <DomainStateBadge label="Ownership" value={domain.ownershipState} />
                        <DomainStateBadge label="Certificat" value={domain.certState} />
                      </div>
                    </div>

                    {domain.issues.length ? (
                      <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
                        <p className="font-semibold">Firebase a raportat probleme pentru acest domeniu:</p>
                        <ul className="mt-2 space-y-2 text-rose-100/85">
                          {domain.issues.map((issue) => (
                            <li key={issue}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-5 space-y-3">
                      <p className="text-sm font-medium text-white/80">Valorile care trebuie aplicate in registrar</p>
                      <InstructionTable instructions={domain.instructions} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
