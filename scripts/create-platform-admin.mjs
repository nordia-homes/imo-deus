import fs from 'node:fs';
import path from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

function loadLocalEnv() {
  const cwd = process.cwd();
  const envFiles = ['.env.local', '.env'];

  envFiles.forEach((fileName) => {
    const fullPath = path.join(cwd, fileName);
    if (!fs.existsSync(fullPath)) return;
    dotenv.config({ path: fullPath, override: false });
  });
}

function getArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
}

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Lipsește variabila de mediu ${name}.`);
  }
  return value;
}

function initAdmin() {
  if (getApps().length) return getApps()[0];

  const projectId = getRequiredEnv('FIREBASE_PROJECT_ID');
  const clientEmail = getRequiredEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = getRequiredEnv('FIREBASE_PRIVATE_KEY').replace(/\\n/g, '\n');

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

async function main() {
  loadLocalEnv();

  const email = getArg('email');
  const password = getArg('password');
  const name = getArg('name') || 'Platform Admin';

  if (!email || !password) {
    throw new Error(
      'Folosește scriptul așa: npm run platform-admin:create -- --email=nou@domeniu.ro --password=Parola123! --name="Nume Admin"'
    );
  }

  const app = initAdmin();
  const auth = getAuth(app);
  const db = getFirestore(app);

  let existingUser = null;
  try {
    existingUser = await auth.getUserByEmail(email);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    if (code !== 'auth/user-not-found') {
      throw error;
    }
  }

  const userRecord = existingUser
    ? await auth.updateUser(existingUser.uid, {
        email,
        password,
        displayName: name,
      })
    : await auth.createUser({
        email,
        password,
        displayName: name,
      });

  const timestamp = new Date().toISOString();

  await db.collection('users').doc(userRecord.uid).set(
    {
      name,
      email,
      role: 'platform_admin',
      photoUrl: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    { merge: true }
  );

  console.log(`Platform admin pregătit cu succes.`);
  console.log(`UID: ${userRecord.uid}`);
  console.log(`Email: ${email}`);
  console.log(`Rol: platform_admin`);
}

main().catch((error) => {
  console.error('Nu am putut crea contul de platform admin.');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
