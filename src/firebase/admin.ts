// PAS 0: Acest fișier inițializează Firebase Admin SDK.
// Admin SDK rulează cu privilegii de server și ignoră regulile de securitate,
// fiind metoda corectă și sigură pentru a rula operațiuni pe server,
// cum ar fi cele declanșate de un formular public.

import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// PAS 1: Verificăm dacă variabilele de mediu necesare sunt setate.
// Acestea sunt citite din fișierul .env.
// Dacă nu sunt setate, vom arunca o eroare clară pentru a vă ghida.
if (
  !process.env.FIREBASE_PROJECT_ID ||
  !process.env.FIREBASE_CLIENT_EMAIL ||
  !process.env.FIREBASE_PRIVATE_KEY
) {
  throw new Error(
    'Credentialele Firebase Admin SDK nu sunt setate. Vă rugăm să verificați fișierul .env și să vă asigurați că variabilele FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL și FIREBASE_PRIVATE_KEY sunt definite. Puteți obține aceste valori din setările proiectului Firebase, secțiunea "Service accounts".'
  );
}


let app: App;

// PAS 2: Inițializăm aplicația Firebase Admin, dar numai dacă nu a fost deja inițializată.
// Acest lucru previne erorile în mediul de dezvoltare Next.js (HMR - Hot Module Replacement).
if (!getApps().length) {
  app = initializeApp({
    // PAS 3: Folosim funcția cert() pentru a crea obiectul de credențiale
    // din variabilele de mediu pe care le-ați adăugat în .env.
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Cheia privată trebuie formatată corect, înlocuind caracterele '\n' cu newline-uri reale.
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
} else {
  // Dacă o aplicație există deja, o refolosim.
  app = getApps()[0];
}

// PAS 4: Exportăm instanța Firestore pentru Admin SDK.
// Aceasta va fi folosită în fluxurile de pe server pentru a interacționa cu baza de date.
export const adminDb = getFirestore(app);
