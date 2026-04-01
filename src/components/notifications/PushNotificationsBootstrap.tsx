"use client";

import { useEffect } from 'react';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { useFirestore, useUser, useFirebaseApp } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export function PushNotificationsBootstrap() {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();

  useEffect(() => {
    if (!user || typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      return;
    }

    if (!VAPID_KEY) {
      console.warn('NEXT_PUBLIC_FIREBASE_VAPID_KEY is missing. Push notifications are disabled.');
      return;
    }

    let unsubscribe: (() => void) | undefined;

    const setupPushNotifications = async () => {
      try {
        const supported = await isSupported();
        if (!supported) {
          return;
        }

        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

        let permission = Notification.permission;
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
          return;
        }

        const messaging = getMessaging(firebaseApp);
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: registration,
        });

        if (!token) {
          return;
        }

        await setDoc(
          doc(firestore, 'users', user.uid),
          {
            pushTokens: arrayUnion(token),
            pushNotificationsEnabled: true,
            pushNotificationsUpdatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        unsubscribe = onMessage(messaging, (payload) => {
          toast({
            title: payload.notification?.title || 'Notificare nouă',
            description: payload.notification?.body || 'Ai o actualizare nouă.',
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
