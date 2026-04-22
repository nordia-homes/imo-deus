"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import { canUsePushNotifications, registerPushNotifications } from '@/lib/push-notifications';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationsCard() {
  const { user } = useUser();
  const { userProfile } = useAgency();
  const firebaseApp = useFirebaseApp();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');

  useEffect(() => {
    let isMounted = true;

    const loadDiagnostics = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        if (isMounted) {
          setPermission('unsupported');
          setIsSupported(false);
        }
        return;
      }

      if (isMounted) {
        setPermission(Notification.permission);
      }

      const supported = await canUsePushNotifications();
      if (isMounted) {
        setIsSupported(supported);
      }
    };

    void loadDiagnostics();

    return () => {
      isMounted = false;
    };
  }, []);

  const tokenCount = userProfile?.pushTokens?.filter(Boolean).length || 0;

  const status = useMemo(() => {
    if (isSupported === false || permission === 'unsupported') return 'unsupported';
    if (permission === 'denied') return 'blocked';
    if (permission === 'granted' && tokenCount > 0) return 'enabled';
    return 'disabled';
  }, [isSupported, permission, tokenCount]);

  const handleEnable = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await registerPushNotifications({
        firebaseApp,
        firestore,
        userId: user.uid,
      });

      setPermission(typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported');

      toast({
        title: 'Notificări activate',
        description: 'Push notifications sunt active pentru contul tău.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut activa notificările',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="agentfinder-settings-card shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          {status === 'enabled' ? <Bell className="h-5 w-5 text-emerald-300" /> : <BellOff className="h-5 w-5 text-white/70" />}
          Notificări push
        </CardTitle>
        <CardDescription className="text-white/70">
          Controlează notificările pentru vizionări și alte evenimente importante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={status === 'enabled' ? 'bg-emerald-500/20 text-emerald-100' : status === 'blocked' ? 'bg-rose-500/20 text-rose-100' : status === 'unsupported' ? 'bg-amber-500/20 text-amber-100' : 'bg-white/10 text-white/80'}>
            {status === 'enabled' ? 'Active' : status === 'blocked' ? 'Blocate în browser' : status === 'unsupported' ? 'Nesuportate' : 'Inactive'}
          </Badge>
          {userProfile?.pushNotificationsUpdatedAt ? (
            <span className="text-xs text-white/45">Ultima actualizare: {new Date(userProfile.pushNotificationsUpdatedAt).toLocaleString('ro-RO')}</span>
          ) : null}
        </div>
        <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-white/55" /> Permisiune browser</span>
            <span className="font-medium text-white">
              {permission === 'granted' ? 'Permisă' : permission === 'denied' ? 'Blocată' : permission === 'default' ? 'Neconfirmată' : 'Nesuportată'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4 text-white/55" /> Token-uri active</span>
            <span className="font-medium text-white">{tokenCount}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2"><Bell className="h-4 w-4 text-white/55" /> Suport push</span>
            <span className="font-medium text-white">{isSupported === null ? 'Verificare...' : isSupported ? 'Da' : 'Nu'}</span>
          </div>
        </div>
        <p className="text-sm text-white/70">
          Dacă notificările sunt blocate, trebuie permise din setările browserului pentru acest site. Pe iPhone, testul trebuie făcut din aplicația instalată pe Home Screen.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={handleEnable} disabled={isLoading || status === 'enabled'} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activează notificările
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
