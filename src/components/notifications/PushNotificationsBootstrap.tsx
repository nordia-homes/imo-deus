"use client";

import { useEffect } from 'react';
import { collection, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { attachForegroundPushListener, canUsePushNotifications, isElectronDesktop, registerPushNotifications } from '@/lib/push-notifications';
import { DEFAULT_NOTIFICATION_PREFERENCES, type AppNotification, type NotificationPreferences } from '@/lib/notifications/types';

export function PushNotificationsBootstrap() {
  const { user } = useUser();
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!user || typeof window === 'undefined') return;
    let unsubscribe: (() => void) | undefined;
    let unsubscribePreferences: (() => void) | undefined;
    let unsubscribeNavigation: (() => void) | undefined;

    const setup = async () => {
      try {
        if (isElectronDesktop() && window.imodeusDesktop) {
          let initialSnapshot = true;
          let preferences: NotificationPreferences = DEFAULT_NOTIFICATION_PREFERENCES;
          let preferencesLoaded = false;
          unsubscribePreferences = onSnapshot(
            doc(firestore, 'users', user.uid, 'notificationPreferences', 'default'),
            (snapshot) => {
              const stored = snapshot.data() as Partial<NotificationPreferences> | undefined;
              preferences = {
                pushEnabled: stored?.pushEnabled ?? true,
                categories: { ...DEFAULT_NOTIFICATION_PREFERENCES.categories, ...(stored?.categories || {}) },
              };
              preferencesLoaded = true;
            },
          );
          const notificationsQuery = query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('createdAt', 'desc'),
            limit(20),
          );
          unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
            if (initialSnapshot) {
              initialSnapshot = false;
              return;
            }
            for (const change of snapshot.docChanges()) {
              if (change.type !== 'added') continue;
              const notification = change.doc.data() as AppNotification;
              if (!preferencesLoaded || preferences.pushEnabled === false || preferences.categories[notification.category] === false) continue;
              void window.imodeusDesktop?.showDesktopNotification({
                title: notification.title,
                body: notification.body,
                actionUrl: notification.actionUrl,
              });
            }
          });
          unsubscribeNavigation = window.imodeusDesktop.onDesktopNotificationNavigate((path) => router.push(path));
          const pendingPath = await window.imodeusDesktop.consumePendingNotificationNavigation();
          if (pendingPath) router.push(pendingPath);
          return;
        }

        if (!await canUsePushNotifications() || Notification.permission !== 'granted') return;
        await registerPushNotifications({ firebaseApp, user });
        unsubscribe = attachForegroundPushListener(firebaseApp, (payload) => {
          toast({
            title: payload.title || 'Notificare noua',
            description: payload.body || 'Ai o actualizare noua.',
          });
        });
      } catch (error) {
        console.error('Notification bootstrap failed:', error);
      }
    };

    void setup();
    return () => {
      unsubscribe?.();
      unsubscribePreferences?.();
      unsubscribeNavigation?.();
    };
  }, [firebaseApp, firestore, router, toast, user]);

  return null;
}
