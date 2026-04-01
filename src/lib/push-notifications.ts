"use client";

import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export async function canUsePushNotifications() {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }

  return isSupported();
}

export async function registerPushNotifications({
  firebaseApp,
  firestore,
  userId,
}: {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  userId: string;
}) {
  if (!VAPID_KEY) {
    throw new Error('NEXT_PUBLIC_FIREBASE_VAPID_KEY lipsește.');
  }

  const supported = await canUsePushNotifications();
  if (!supported) {
    throw new Error('Browserul nu suportă push notifications.');
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission !== 'granted') {
    throw new Error('Permisiunea pentru notificări nu a fost acordată.');
  }

  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('Nu s-a putut obține tokenul push.');
  }

  await setDoc(
    doc(firestore, 'users', userId),
    {
      pushTokens: arrayUnion(token),
      pushNotificationsEnabled: true,
      pushNotificationsUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  return token;
}

export function attachForegroundPushListener(
  firebaseApp: FirebaseApp,
  onNotify: (payload: { title?: string; body?: string }) => void,
) {
  const messaging = getMessaging(firebaseApp);

  return onMessage(messaging, (payload) => {
    onNotify({
      title: payload.notification?.title,
      body: payload.notification?.body,
    });
  });
}
