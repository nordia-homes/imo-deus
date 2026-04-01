"use client";

import { useEffect } from 'react';
import { useFirestore, useUser, useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { attachForegroundPushListener, canUsePushNotifications, registerPushNotifications } from '@/lib/push-notifications';

export function PushNotificationsBootstrap() {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupPushNotifications = async () => {
      try {
        const supported = await canUsePushNotifications();
        if (!supported) {
          return;
        }

        if (Notification.permission !== 'granted') {
          return;
        }

        await registerPushNotifications({
          firebaseApp,
          firestore,
          userId: user.uid,
        });

        unsubscribe = attachForegroundPushListener(firebaseApp, (payload) => {
          toast({
            title: payload.title || 'Notificare nouă',
            description: payload.body || 'Ai o actualizare nouă.',
          });
        });
      } catch (error) {
        console.error('Push notifications setup failed:', error);
      }
    };

    void setupPushNotifications();

    return () => {
      unsubscribe?.();
    };
  }, [firebaseApp, firestore, toast, user]);

  return null;
}
