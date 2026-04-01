importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBe2Kd5E2yz6SvRurD0zdeLcORGInCLFoY',
  authDomain: 'studio-652232171-42fb6.firebaseapp.com',
  projectId: 'studio-652232171-42fb6',
  storageBucket: 'studio-652232171-42fb6.firebasestorage.app',
  messagingSenderId: '552699648501',
  appId: '1:552699648501:web:971d6d94f88bd519f4a8bc',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || 'Notificare nouă';
  const notificationOptions = {
    body: payload.notification?.body || 'Ai o actualizare nouă.',
    icon: '/favicon.ico',
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetPath = event.notification?.data?.path || '/viewings';
  const targetUrl = new URL(targetPath, self.location.origin).toString();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    })
  );
});
