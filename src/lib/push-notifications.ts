"use client";

import type { FirebaseApp } from 'firebase/app';
import type { User } from 'firebase/auth';
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const INSTALLATION_KEY = 'imodeus:notifications:installation-id';
const registrationKey = (uid: string) => `imodeus:notifications:registration:${uid}`;

export function isElectronDesktop() {
  return typeof window !== 'undefined' && Boolean(window.imodeusDesktop);
}

function getInstallationId() {
  const current = window.localStorage.getItem(INSTALLATION_KEY);
  if (current) return current;
  const next = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(INSTALLATION_KEY, next);
  return next;
}

export function getCurrentNotificationRegistrationId(uid: string) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(registrationKey(uid));
}

export async function canUsePushNotifications() {
  if (typeof window === 'undefined' || isElectronDesktop() || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return false;
  }
  return isSupported();
}

export async function registerPushNotifications({ firebaseApp, user }: { firebaseApp: FirebaseApp; user: User }) {
  if (!VAPID_KEY) throw new Error('NEXT_PUBLIC_FIREBASE_VAPID_KEY lipseste.');
  if (!await canUsePushNotifications()) throw new Error('Acest dispozitiv nu suporta notificari push web.');

  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permisiunea pentru notificari nu a fost acordata.');

  const messaging = getMessaging(firebaseApp);
  const target = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration });
  if (!target) throw new Error('Nu s-a putut obtine tokenul push.');

  const idToken = await user.getIdToken();
  const response = await fetch('/api/notifications/registrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      installationId: getInstallationId(), target, origin: window.location.origin,
      platform: 'web', deviceLabel: navigator.userAgent.slice(0, 160),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.registrationId !== 'string') {
    throw new Error(payload.message || 'Dispozitivul nu a putut fi inregistrat.');
  }
  window.localStorage.setItem(registrationKey(user.uid), payload.registrationId);
  return payload.registrationId as string;
}

export async function unregisterPushNotifications({ firebaseApp, user }: { firebaseApp: FirebaseApp; user: User }) {
  const id = getCurrentNotificationRegistrationId(user.uid);
  if (id) {
    const idToken = await user.getIdToken();
    const response = await fetch('/api/notifications/registrations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ registrationId: id }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || 'Dispozitivul nu a putut fi dezactivat.');
    }
    window.localStorage.removeItem(registrationKey(user.uid));
  }
  if (await isSupported()) await deleteToken(getMessaging(firebaseApp));
}

export function attachForegroundPushListener(
  firebaseApp: FirebaseApp,
  onNotify: (payload: { title?: string; body?: string; path?: string }) => void,
) {
  return onMessage(getMessaging(firebaseApp), (payload) => {
    onNotify({ title: payload.notification?.title, body: payload.notification?.body, path: payload.data?.path });
  });
}
