"use client";

import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Laptop, Loader2, ShieldCheck, Smartphone } from 'lucide-react';
import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useDoc, useFirebaseApp, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  canUsePushNotifications,
  getCurrentNotificationRegistrationId,
  isElectronDesktop,
  registerPushNotifications,
  unregisterPushNotifications,
} from '@/lib/push-notifications';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_KEYS,
  NOTIFICATION_CATEGORY_LABELS,
  type MessagingRegistration,
  type NotificationCategory,
  type NotificationPreferences,
} from '@/lib/notifications/types';

export function PushNotificationsCard() {
  const { user } = useUser();
  const firebaseApp = useFirebaseApp();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [registrationId, setRegistrationId] = useState<string | null>(null);

  const preferencesRef = useMemoFirebase(
    () => user ? doc(firestore, 'users', user.uid, 'notificationPreferences', 'default') : null,
    [firestore, user],
  );
  const registrationRef = useMemoFirebase(
    () => user && registrationId ? doc(firestore, 'users', user.uid, 'messagingRegistrations', registrationId) : null,
    [firestore, registrationId, user],
  );
  const { data: storedPreferences } = useDoc<NotificationPreferences>(preferencesRef);
  const { data: registration } = useDoc<MessagingRegistration>(registrationRef);
  const preferences = useMemo<NotificationPreferences>(() => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(storedPreferences || {}),
    categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories, ...(storedPreferences?.categories || {}) },
  }), [storedPreferences]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user || typeof window === 'undefined') return;
      const desktop = isElectronDesktop();
      if (!active) return;
      setIsDesktop(desktop);
      setRegistrationId(getCurrentNotificationRegistrationId(user.uid));
      if (desktop) {
        setIsSupported(true);
        setPermission('granted');
        return;
      }
      if (!('Notification' in window)) {
        setIsSupported(false);
        setPermission('unsupported');
        return;
      }
      setPermission(Notification.permission);
      setIsSupported(await canUsePushNotifications());
    };
    void load();
    return () => { active = false; };
  }, [user]);

  const isRegistered = Boolean(registrationId && registration?.enabled);
  const status = isDesktop ? 'desktop' : isSupported === false || permission === 'unsupported'
    ? 'unsupported'
    : permission === 'denied'
      ? 'blocked'
      : isRegistered
        ? 'enabled'
        : 'disabled';

  const updatePreferences = async (update: Partial<NotificationPreferences>) => {
    if (!preferencesRef) return;
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(preferencesRef);
      const current = snapshot.exists() ? snapshot.data() as Partial<NotificationPreferences> : {};
      transaction.set(preferencesRef, {
        pushEnabled: update.pushEnabled ?? current.pushEnabled ?? DEFAULT_NOTIFICATION_PREFERENCES.pushEnabled,
        categories: {
          ...DEFAULT_NOTIFICATION_PREFERENCES.categories,
          ...(current.categories || {}),
          ...(update.categories || {}),
        },
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  };

  const handleEnable = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const id = await registerPushNotifications({ firebaseApp, user });
      setRegistrationId(id);
      setPermission(Notification.permission);
      await updatePreferences({ pushEnabled: true });
      toast({ title: 'Notificari activate', description: 'Acest dispozitiv poate primi notificari push.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Notificarile nu au putut fi activate', description: error instanceof Error ? error.message : 'Incearca din nou.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await unregisterPushNotifications({ firebaseApp, user });
      setRegistrationId(null);
      toast({ title: 'Dispozitiv dezactivat', description: 'Inboxul din aplicatie ramane activ.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Dezactivare esuata', description: error instanceof Error ? error.message : 'Incearca din nou.' });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCategory = async (category: NotificationCategory, enabled: boolean) => {
    await updatePreferences({ categories: { [category]: enabled } });
  };

  return (
    <Card className="agentfinder-settings-card rounded-2xl border-none bg-[#152A47] text-white shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          {status === 'enabled' || status === 'desktop' ? <Bell className="h-5 w-5 text-emerald-300" /> : <BellOff className="h-5 w-5 text-white/70" />}
          Notificari
        </CardTitle>
        <CardDescription className="text-white/70">Inboxul din aplicatie este permanent activ. Aici controlezi canalul push si categoriile lui.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className={status === 'enabled' || status === 'desktop' ? 'bg-emerald-500/20 text-emerald-100' : status === 'blocked' ? 'bg-rose-500/20 text-rose-100' : 'bg-white/10 text-white/80'}>
            {status === 'desktop' ? 'Native in aplicatia desktop' : status === 'enabled' ? 'Push activ pe acest dispozitiv' : status === 'blocked' ? 'Blocat in browser' : status === 'unsupported' ? 'Push nesuportat' : 'Push inactiv'}
          </Badge>
        </div>

        <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-white/55" /> Inbox in aplicatie</span>
            <span className="font-medium text-emerald-200">Activ</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2">{isDesktop ? <Laptop className="h-4 w-4 text-white/55" /> : <Smartphone className="h-4 w-4 text-white/55" />} Canal dispozitiv</span>
            <span className="font-medium text-white">{isDesktop ? 'Electron native' : isRegistered ? 'FCM web' : 'Neconectat'}</span>
          </div>
        </div>

        {!isDesktop && status !== 'unsupported' ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {!isRegistered ? (
              <Button type="button" onClick={handleEnable} disabled={isLoading || status === 'blocked'}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Activeaza pe acest dispozitiv
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={handleDisable} disabled={isLoading} className="border-white/20 bg-transparent text-white hover:bg-white/10">
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Dezactiveaza acest dispozitiv
              </Button>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3">
            <div><p className="text-sm font-semibold">Push pentru categorii</p><p className="text-xs text-white/55">Comutator general; inboxul ramane activ.</p></div>
            <Switch checked={preferences.pushEnabled} onCheckedChange={(checked) => void updatePreferences({ pushEnabled: checked })} />
          </div>
          {NOTIFICATION_CATEGORY_KEYS.map((category) => (
            <div key={category} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <span className="text-sm text-white/85">{NOTIFICATION_CATEGORY_LABELS[category]}</span>
              <Switch
                checked={preferences.categories[category] !== false}
                disabled={!preferences.pushEnabled}
                onCheckedChange={(checked) => void toggleCategory(category, checked)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
