// --- Ghid pentru Firebase Admin SDK ---
//
// Acest fișier inițializează Firebase Admin SDK, esențial pentru operațiunile
// server-side care necesită privilegii de administrator (ex: formularul public).
// Admin SDK ignoră regulile de securitate, fiind metoda corectă și sigură
// pentru astfel de sarcini.

import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

// PAS 1: Verificăm dacă aplicația a fost deja inițializată.
// Acest lucru previne erorile în mediul de dezvoltare Next.js (HMR).
if (!getApps().length) {

  // PAS 2: Verificăm dacă variabila de mediu cu credențialele există.
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      'Credentialele Firebase Admin SDK nu sunt setate în .env. Vă rugăm să verificați variabila FIREBASE_SERVICE_ACCOUNT_JSON.'
    );
  }

  try {
    // PAS 3: Parsăm JSON-ul din variabila de mediu.
    const serviceAccount: ServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    // PAS 4: Inițializăm aplicația folosind credențialele parsate.
    app = initializeApp({
      credential: cert(serviceAccount),
    });

  } catch (e: any) {
    // Dacă parsarea eșuează, afișăm o eroare clară.
    console.error("Eroare la parsarea FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    throw new Error(
      'Credentialele Firebase Admin SDK din .env par a fi malformate. Asigurați-vă că ați copiat corect întregul conținut al fișierului JSON.'
    );
  }

} else {
  // Dacă o aplicație există deja, o refolosim.
  app = getApps()[0];
}

// PAS 5: Exportăm instanța Firestore pentru Admin SDK.
// Aceasta va fi folosită în fluxurile de pe server.
export const adminDb = getFirestore(app);
