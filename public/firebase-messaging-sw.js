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

// Mesajele FCM care contin `notification` sunt afisate automat in fundal.
// Un handler cu showNotification aici ar dubla fiecare notificare.
firebase.messaging();
