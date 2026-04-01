"use client";

import { useMemo, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAgency } from '@/context/AgencyContext';
import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { registerPushNotifications } from '@/lib/push-notifications';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationsBanner() {
  const { user } = useUser();
  const { userProfile } = useAgency();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  const [isEnabling, setIsEnabling] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const tokenCount = userProfile?.pushTokens?.filter(Boolean).length || 0;

  const shouldShow = useMemo(() => {
    if (!user || !userProfile || isDismissed) return false;
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return tokenCount === 0 || (!userProfile.pushNotificationsEnabled && Notification.permission !== 'granted');
  }, [isDismissed, tokenCount, user, userProfile]);

  if (!shouldShow) {
    return null;
  }

  const handleEnable = async () => {
    if (!user) return;

    setIsEnabling(true);
    try {
      await registerPushNotifications({
        firebaseApp,
        firestore,
        userId: user.uid,
      });

      toast({
        title: 'Notificări activate',
        description: 'Vei primi notificări push pentru vizionări.',
      });
      setIsDismissed(true);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Nu am putut activa notificările',
        description: error instanceof Error ? error.message : 'Încearcă din nou.',
      });
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div className="mx-auto mb-4 w-full max-w-[1400px] px-2 pt-2 sm:px-4">
      <div className="rounded-2xl border border-emerald-400/20 bg-gradient-to-r from-emerald-500/12 via-emerald-400/8 to-transparent p-4 text-white shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-emerald-500/18 p-2 text-emerald-200">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Activează notificările push</p>
              <p className="text-sm text-white/70">Primești automat notificări când se adaugă o vizionare nouă.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsDismissed(true)} className="text-white/70 hover:bg-white/10 hover:text-white">
              Mai târziu
            </Button>
            <Button type="button" onClick={handleEnable} disabled={isEnabling} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {isEnabling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Activează notificările
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
