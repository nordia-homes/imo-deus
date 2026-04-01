"use client";

import { useMemo, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { useAgency } from '@/context/AgencyContext';
import { registerPushNotifications } from '@/lib/push-notifications';
import { useToast } from '@/hooks/use-toast';

export function PushNotificationsCard() {
  const { user } = useUser();
  const { userProfile } = useAgency();
  const firebaseApp = useFirebaseApp();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const status = useMemo(() => {
    if (typeof window === 'undefined') return 'unknown';
    if (Notification.permission === 'granted' || userProfile?.pushNotificationsEnabled) return 'enabled';
    if (Notification.permission === 'denied') return 'blocked';
    return 'disabled';
  }, [userProfile?.pushNotificationsEnabled]);

  const handleEnable = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      await registerPushNotifications({
        firebaseApp,
        firestore,
        userId: user.uid,
      });

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
    <Card className="shadow-2xl rounded-2xl bg-[#152A47] border-none text-white">
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
        <div className="flex items-center gap-3">
          <Badge className={status === 'enabled' ? 'bg-emerald-500/20 text-emerald-100' : status === 'blocked' ? 'bg-rose-500/20 text-rose-100' : 'bg-white/10 text-white/80'}>
            {status === 'enabled' ? 'Active' : status === 'blocked' ? 'Blocate în browser' : 'Inactive'}
          </Badge>
          {userProfile?.pushNotificationsUpdatedAt ? (
            <span className="text-xs text-white/45">Ultima actualizare: {new Date(userProfile.pushNotificationsUpdatedAt).toLocaleString('ro-RO')}</span>
          ) : null}
        </div>
        <p className="text-sm text-white/70">
          Dacă notificările sunt blocate, trebuie permise din setările browserului pentru acest site.
        </p>
        <Button type="button" onClick={handleEnable} disabled={isLoading || status === 'enabled'} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Activează notificările
        </Button>
      </CardContent>
    </Card>
  );
}
