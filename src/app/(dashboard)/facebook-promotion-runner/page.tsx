'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Facebook,
  Image as ImageIcon,
  Laptop,
  Loader2,
  LogIn,
  RefreshCcw,
  Rocket,
  SkipForward,
  TerminalSquare,
} from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { DesktopFacebookRunnerStatus } from '@/lib/desktop/facebook-promotion';
import type { FacebookPromotionSession } from '@/lib/types';

const SESSION_STORAGE_KEY = 'imodeus:facebookPromotionSession';

export default function FacebookPromotionRunnerPage() {
  const router = useRouter();
  const firestore = useFirestore();
  const { agencyId } = useAgency();
  const { toast } = useToast();
  const [session, setSession] = useState<FacebookPromotionSession | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [desktopStatus, setDesktopStatus] = useState<DesktopFacebookRunnerStatus | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      setIsHydrated(true);
      return;
    }

    try {
      setSession(JSON.parse(raw) as FacebookPromotionSession);
    } catch (error) {
      console.error('Invalid facebook promotion session:', error);
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.imodeusDesktop) return;

    window.imodeusDesktop.isDesktop().then(setIsDesktop).catch(() => setIsDesktop(false));
    window.imodeusDesktop.getFacebookRunnerStatus().then(setDesktopStatus).catch(() => null);

    const unsubscribe = window.imodeusDesktop.onFacebookRunnerStatusChanged((status) => {
      setDesktopStatus(status);
    });

    return unsubscribe;
  }, []);

  const currentGroup = session?.groups[session.currentGroupIndex] || null;
  const progressValue = useMemo(() => {
    if (!session || session.groups.length === 0) return 0;
    const processedCount = session.groups.filter((group) => group.status === 'posted' || group.status === 'skipped').length;
    return Math.round((processedCount / session.groups.length) * 100);
  }, [session]);

  const persistSession = (nextSession: FacebookPromotionSession) => {
    setSession(nextSession);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
    }
  };

  const downloadSessionFile = () => {
    if (typeof window === 'undefined' || !session) return;

    const blob = new Blob([`${JSON.stringify(session, null, 2)}\n`], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `facebook-promotion-session-${session.jobId || session.propertyId}.json`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  const copyHelperCommand = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard || !session) return;

    const command = `npm run facebook:helper -- --session C:\\path\\to\\facebook-promotion-session-${session.jobId || session.propertyId}.json`;
    await navigator.clipboard.writeText(command);
    toast({
      title: 'Comanda helper a fost copiată',
      description: 'Descarcă mai întâi sesiunea JSON, apoi înlocuiește calea din comandă.',
    });
  };

  const startDesktopRunner = async () => {
    if (!window.imodeusDesktop || !session) return;

    try {
      setIsUpdating(true);
      const status = await window.imodeusDesktop.startFacebookRunner({ session });
      setDesktopStatus(status);
      toast({
        title: 'Runner desktop pornit',
        description: 'Aplicația desktop încearcă acum să pregătească grupul curent.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut porni runner-ul desktop',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const retryDesktopCurrentGroup = async () => {
    if (!window.imodeusDesktop) return;

    try {
      setIsUpdating(true);
      const result = await window.imodeusDesktop.retryFacebookRunnerCurrentGroup();
      setDesktopStatus(result.status);
      toast({
        title: 'Runner desktop reluat',
        description: 'Am reluat pregătirea grupului curent după autentificare.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut relua grupul curent',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const resetDesktopRunnerProfile = async () => {
    if (!window.imodeusDesktop) return;

    try {
      setIsUpdating(true);
      const status = await window.imodeusDesktop.resetFacebookRunnerProfile();
      setDesktopStatus(status);
      toast({
        title: 'Profil runner resetat',
        description: 'Profilul local Playwright/Facebook a fost șters. Poți porni din nou runner-ul desktop.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut reseta profilul runner-ului',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const saveDesktopSessionFile = async () => {
    if (!window.imodeusDesktop || !session) return;

    try {
      const result = await window.imodeusDesktop.saveFacebookRunnerSessionFile({ session });
      if (!result.canceled) {
        toast({
          title: 'Sesiunea a fost salvată',
          description: result.filePath || 'Fișierul JSON este pregătit pentru desktop helper.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut salva sesiunea',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    }
  };

  useEffect(() => {
    if (!session?.propertyDescription || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      return;
    }

    navigator.clipboard.writeText(session.propertyDescription).catch((error) => {
      console.warn('Could not copy property description to clipboard:', error);
    });
  }, [session?.currentGroupIndex, session?.propertyDescription]);

  const updateJob = async (nextSession: FacebookPromotionSession, jobStatus?: FacebookPromotionSession['groups'][number]['status']) => {
    if (!agencyId || !nextSession.jobId) {
      persistSession(nextSession);
      return;
    }

    const finalStatus = nextSession.groups.every((group) => group.status === 'posted' || group.status === 'skipped')
      ? 'completed'
      : nextSession.groups.some((group) => group.status === 'opened')
        ? 'in_progress'
        : 'pending';

    await updateDoc(doc(firestore, 'agencies', agencyId, 'facebookPromotionJobs', nextSession.jobId), {
      groups: nextSession.groups,
      status: finalStatus,
      lastUpdatedAt: new Date().toISOString(),
      lastAction: jobStatus || null,
    });
    persistSession(nextSession);
  };

  const openCurrentGroup = async () => {
    if (!session || !currentGroup) return;

    const openedWindow = window.open(currentGroup.url, '_blank', 'noopener,noreferrer');
    const nextGroups = session.groups.map((group, index) =>
      index === session.currentGroupIndex ? { ...group, status: 'opened' as const } : group
    );
    const nextSession = { ...session, groups: nextGroups };

    try {
      setIsUpdating(true);
      await updateJob(nextSession, 'opened');
      toast({
        title: openedWindow ? 'Grupul a fost deschis' : 'Browserul a blocat tab-ul',
        description: openedWindow
          ? 'Descrierea a fost copiată automat. Poți lipi textul în Facebook.'
          : 'Permite pop-up-urile pentru acest site și încearcă din nou.',
      });
    } catch (error) {
      console.error('Failed to update promotion runner state:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const openAllImages = () => {
    if (!session?.propertyImages?.length) {
      toast({
        variant: 'destructive',
        title: 'Nu există poze',
        description: 'Această proprietate nu are poze disponibile pentru promovare.',
      });
      return;
    }

    let openedCount = 0;
    session.propertyImages.forEach((image) => {
      const openedWindow = window.open(image.url, '_blank', 'noopener,noreferrer');
      if (openedWindow) {
        openedCount += 1;
      }
    });

    toast({
      title: openedCount > 0 ? 'Pozele au fost deschise' : 'Browserul a blocat pozele',
      description:
        openedCount > 0
          ? `${openedCount} poze au fost deschise în tab-uri noi pentru upload manual.`
          : 'Permite pop-up-urile pentru a deschide pozele automat.',
    });
  };

  const advanceGroup = async (nextStatus: 'posted' | 'skipped') => {
    if (!session || !currentGroup) return;

    const nextGroups = session.groups.map((group, index) =>
      index === session.currentGroupIndex ? { ...group, status: nextStatus } : group
    );

    const nextPendingIndex = nextGroups.findIndex((group, index) => index > session.currentGroupIndex && group.status === 'pending');
    const currentGroupIndex =
      nextPendingIndex >= 0
        ? nextPendingIndex
        : Math.min(session.currentGroupIndex + 1, nextGroups.length - 1);

    const nextSession = {
      ...session,
      groups: nextGroups,
      currentGroupIndex,
    };

    try {
      setIsUpdating(true);
      await updateJob(nextSession, nextStatus);

      if (nextStatus === 'posted') {
        toast({
          title: 'Grup marcat ca publicat',
          description: nextPendingIndex >= 0 ? 'Runner-ul a trecut la următorul grup.' : 'Toate grupurile au fost parcurse.',
        });
      } else {
        toast({
          title: 'Grup sărit',
          description: nextPendingIndex >= 0 ? 'Runner-ul a trecut la următorul grup disponibil.' : 'Nu mai există alte grupuri în sesiune.',
        });
      }
    } catch (error) {
      console.error('Failed to advance promotion runner:', error);
      toast({
        variant: 'destructive',
        title: 'Nu am putut actualiza sesiunea',
        description: 'Încearcă din nou.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const advanceDesktopGroup = async (nextStatus: 'posted' | 'skipped') => {
    if (!window.imodeusDesktop) return;

    try {
      setIsUpdating(true);
      const result =
        nextStatus === 'posted'
          ? await window.imodeusDesktop.markFacebookRunnerPosted()
          : await window.imodeusDesktop.skipFacebookRunnerGroup();

      setDesktopStatus(result.status);
      await advanceGroup(nextStatus);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut continua runner-ul desktop',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const clearSession = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setSession(null);
  };

  if (!isHydrated) {
    return (
      <div className="space-y-6 p-4 text-white">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span>Se încarcă sesiunea de promovare...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6 p-4 text-white">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
          <CardHeader>
            <CardTitle>Nu există o sesiune de promovare activă</CardTitle>
            <CardDescription className="text-white/70">
              Pornește promovarea din pagina de detalii a unei proprietăți.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="rounded-full" onClick={() => router.push('/properties')}>
              Înapoi la proprietăți
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 text-white">
      <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                <Facebook className="h-3.5 w-3.5" />
                Runner asistat
              </div>
              <CardTitle className="text-2xl text-white">{session.propertyTitle}</CardTitle>
              <CardDescription className="max-w-3xl text-white/70">
                Runner-ul păstrează sesiunea și te duce grup cu grup. Descrierea este copiată automat la fiecare pas, iar tu te oprești înainte de butonul `Publică`.
              </CardDescription>
            </div>
            <div />
          </div>

          {currentGroup ? (
            <div className="grid gap-3 lg:grid-cols-4">
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => router.push(`/properties/${session.propertyId}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Înapoi la proprietate
              </Button>
              {isDesktop ? (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={saveDesktopSessionFile}>
                  <Copy className="mr-2 h-4 w-4" />
                  Exportă sesiunea
                </Button>
              ) : (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={downloadSessionFile}>
                  <Copy className="mr-2 h-4 w-4" />
                  Descarcă sesiunea JSON
                </Button>
              )}
              {isDesktop ? (
                <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={startDesktopRunner} disabled={isUpdating}>
                  <Laptop className="mr-2 h-4 w-4" />
                  Publică în primul grup
                </Button>
              ) : (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={copyHelperCommand}>
                  <TerminalSquare className="mr-2 h-4 w-4" />
                  Copiază comanda helper
                </Button>
              )}
              <Button variant="ghost" className="rounded-full border border-white/10 bg-white/[0.04] text-white/75 hover:bg-white/[0.08] hover:text-white" onClick={clearSession}>
                Închide sesiunea
              </Button>
            </div>
          ) : null}

          {currentGroup ? (
            <div className="grid gap-3 lg:grid-cols-4">
              {isDesktop ? (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={retryDesktopCurrentGroup} disabled={isUpdating}>
                  <LogIn className="mr-2 h-4 w-4" />
                  Reia grupul curent
                </Button>
              ) : (
                <Button className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={openCurrentGroup} disabled={isUpdating}>
                  {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
                  Deschide grupul curent
                </Button>
              )}
              {isDesktop ? (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={resetDesktopRunnerProfile} disabled={isUpdating}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Resetează profilul runner
                </Button>
              ) : (
                <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={openAllImages}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Deschide toate pozele
                </Button>
              )}
              <Button className="rounded-full bg-emerald-500 text-white hover:bg-emerald-500/90" onClick={() => (isDesktop ? advanceDesktopGroup('posted') : advanceGroup('posted'))} disabled={isUpdating}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Publică în următorul grup
              </Button>
              <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]" onClick={() => (isDesktop ? advanceDesktopGroup('skipped') : advanceGroup('skipped'))} disabled={isUpdating}>
                <SkipForward className="mr-2 h-4 w-4" />
                Sari peste acest grup
              </Button>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-white/70">
              <span>Progres sesiune</span>
              <span>{progressValue}%</span>
            </div>
            <Progress value={progressValue} className="h-2 bg-white/10" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
          <CardHeader>
            <CardTitle className="text-white">
              {currentGroup ? currentGroup.name : 'Toate grupurile au fost parcurse'}
            </CardTitle>
            <CardDescription className="text-white/70">
              {currentGroup
                ? 'Deschide grupul curent, lipește descrierea și încarcă pozele. Runner-ul îți păstrează ordinea și progresul.'
                : 'Nu mai există grupuri în așteptare pentru această sesiune.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentGroup ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{currentGroup.name}</p>
                      <p className="mt-1 text-xs text-white/55">{currentGroup.url}</p>
                    </div>
                    <Badge className="bg-white/10 text-white/80">{currentGroup.status}</Badge>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-300/16 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                  <p className="font-semibold">Ce face runner-ul acum</p>
                  <p className="mt-2 leading-7 text-emerald-50/90">
                    {isDesktop
                      ? 'Runner-ul desktop încearcă să deschidă grupul curent, să completeze descrierea și să atașeze pozele, apoi se oprește înainte de `Publică`.'
                      : 'Runner-ul web copiază descrierea, deschide grupul și pozele, iar tu te oprești înainte de `Publică`.'}
                  </p>
                </div>

                {isDesktop && desktopStatus ? (
                  <div className="rounded-2xl border border-white/10 bg-[#10233b] p-4 text-sm text-white/80">
                    <p className="font-semibold text-white">Status desktop runner</p>
                    <p className="mt-2">{desktopStatus.message || 'Așteaptă comenzi.'}</p>
                    <p className="mt-2 text-xs text-white/55">
                      Stare: {desktopStatus.state} • Grup curent: {desktopStatus.currentGroupName || 'n/a'}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-white/10 bg-[#10233b] p-4">
                  <p className="font-semibold text-white">Stare grupuri</p>
                  <div className="mt-4 space-y-2">
                    {session.groups.map((group, index) => (
                      <div key={`${group.url}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-[#0e2138] px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{group.name}</p>
                          <p className="truncate text-xs text-white/55">{group.url}</p>
                        </div>
                        <Badge className={group.status === 'posted' ? 'bg-emerald-500/20 text-emerald-100' : group.status === 'opened' ? 'bg-blue-500/20 text-blue-100' : group.status === 'skipped' ? 'bg-amber-500/20 text-amber-100' : 'bg-white/10 text-white/80'}>
                          {group.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-emerald-300/16 bg-emerald-400/10 p-5 text-sm text-emerald-50">
                Toate grupurile din sesiune au fost parcurse. Poți reveni la proprietate sau porni o nouă sesiune.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {!isDesktop ? (
          <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
            <CardHeader>
              <CardTitle className="text-white">Helper local Playwright</CardTitle>
              <CardDescription className="text-white/70">
                Pentru completare mai avansată în Facebook, descarcă sesiunea și rulează helperul local. Acesta încearcă să completeze textul și pozele, apoi se oprește înainte de `Publică`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#10233b] p-4 font-mono text-xs leading-6 text-white/80">
                npm run facebook:helper -- --session C:\path\to\facebook-promotion-session.json
              </div>
              <p className="text-sm text-white/65">
                La prima rulare trebuie să fii logat în Facebook în fereastra deschisă de helper. După aceea, runner-ul local continuă grup cu grup și îți cere confirmare după fiecare publicare.
              </p>
            </CardContent>
          </Card>
          ) : (
          <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
            <CardHeader>
              <CardTitle className="text-white">Desktop automation activ</CardTitle>
              <CardDescription className="text-white/70">
                Rulezi în aplicația desktop, deci Playwright poate fi pornit direct din acest ecran, fără helper separat sau terminal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#10233b] p-4 text-sm leading-7 text-white/80">
                1. Apasă `Pornește runner desktop`.
                <br />
                2. Aplicația desktop pregătește grupul curent.
                <br />
                3. Publici manual în Facebook.
                <br />
                4. Revii aici și apeși `Am publicat în grup`.
              </div>
            </CardContent>
          </Card>
          )}

          <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
            <CardHeader>
              <CardTitle className="text-white">Descriere pregătită</CardTitle>
              <CardDescription className="text-white/70">
                Textul este copiat automat când treci la un nou grup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-[#10233b] p-4 text-sm leading-7 text-white/85 whitespace-pre-wrap">
                {session.propertyDescription || 'Proprietatea nu are descriere adăugată.'}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-white/10 bg-[#152A47] text-white">
            <CardHeader>
              <CardTitle className="text-white">Poze proprietate</CardTitle>
              <CardDescription className="text-white/70">
                Runner-ul le poate deschide în tab-uri noi pentru upload manual în Facebook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {session.propertyImages.slice(0, 6).map((image, index) => (
                  <button
                    key={`${image.url}-${index}`}
                    type="button"
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-[#10233b] text-left"
                    onClick={() => window.open(image.url, '_blank', 'noopener,noreferrer')}
                  >
                    <div className="relative aspect-[4/3]">
                      <Image src={image.url} alt={image.alt || session.propertyTitle} fill className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" sizes="240px" />
                    </div>
                  </button>
                ))}
              </div>
              {session.propertyImages.length > 6 ? (
                <p className="text-xs text-white/55">Sunt afișate primele 6 poze. Butonul `Deschide toate pozele` le deschide pe toate.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
