// --- Ghid pentru Firebase Admin SDK ---
//
// Acest fișier inițializează Firebase Admin SDK, esențial pentru operațiunile
// server-side care necesită privilegii de administrator (ex: formularul public).
// Admin SDK ignoră regulile de securitate, fiind metoda corectă și sigură
// pentru astfel de sarcini.

import { initializeApp, cert, getApps, App, ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
let app: App;

// PAS 1: Verificăm dacă aplicația a fost deja inițializată.
// Acest lucru previne erorile în mediul de dezvoltare Next.js (HMR).
if (!getApps().length) {

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Cheia privată din .env are nevoie de formatare specială (înlocuirea `\n` literal cu newline).
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // PAS 2: Validăm proactiv fiecare variabilă de mediu.
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Variabilele de mediu Firebase (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) nu sunt setate corect în environment variables ale aplicației.'
    );
  }
  
  // Validare suplimentară pentru formatul cheii private.
  if (!privateKey.startsWith('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
     throw new Error(
      'Cheia privată FIREBASE_PRIVATE_KEY din environment variables pare a fi invalidă. Asigurați-vă că ați copiat întreaga cheie, inclusiv "-----BEGIN PRIVATE KEY-----" și "-----END PRIVATE KEY-----", exact cum apare în Service Account.'
    );
  }

  // PAS 3: Construim obiectul de credențiale.
  const serviceAccount: ServiceAccount = {
    projectId,
    clientEmail,
    privateKey,
  };

  try {
    // PAS 4: Inițializăm aplicația folosind credențialele.
    app = initializeApp({
      credential: cert(serviceAccount),
    });
  } catch (e: any) {
    console.error("Eroare la inițializarea Firebase Admin SDK:", e.message);
    // Această eroare apare de obicei dacă valorile, deși prezente, sunt incorecte (ex: projectId greșit).
    throw new Error(
      'A apărut o eroare la inițializarea Firebase Admin. Verificați corectitudinea credențialelor din environment variables.'
    );
  }

} else {
  // Dacă o aplicație există deja, o refolosim.
  app = getApps()[0];
}

// PAS 5: Exportăm instanța Firestore pentru Admin SDK.
// Aceasta va fi folosită în fluxurile de pe server.
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminMessaging = getMessaging(app);
