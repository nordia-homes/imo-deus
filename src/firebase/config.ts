export const firebaseConfig = {
  "projectId": "studio-652232171-42fb6",
  "appId": "1:552699648501:web:971d6d94f88bd519f4a8bc",
  "apiKey": "AIzaSyBe2Kd5E2yz6SvRurD0zdeLcORGInCLFoY",
  "authDomain": "studio-652232171-42fb6.firebaseapp.com",
  "storageBucket": "studio-652232171-42fb6.firebasestorage.app",
  "measurementId": "",
  "messagingSenderId": "552699648501"
};

export const demoFirebaseConfig = {
  projectId: process.env.NEXT_PUBLIC_DEMO_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_DEMO_FIREBASE_APP_ID || "",
  apiKey: process.env.NEXT_PUBLIC_DEMO_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_DEMO_FIREBASE_AUTH_DOMAIN || "",
  storageBucket: process.env.NEXT_PUBLIC_DEMO_FIREBASE_STORAGE_BUCKET || "",
  measurementId: process.env.NEXT_PUBLIC_DEMO_FIREBASE_MEASUREMENT_ID || "",
  messagingSenderId: process.env.NEXT_PUBLIC_DEMO_FIREBASE_MESSAGING_SENDER_ID || "",
};

export function hasDemoFirebaseConfig() {
  return Boolean(
    demoFirebaseConfig.projectId &&
      demoFirebaseConfig.appId &&
      demoFirebaseConfig.apiKey &&
      demoFirebaseConfig.authDomain &&
      demoFirebaseConfig.storageBucket &&
      demoFirebaseConfig.messagingSenderId
  );
}
