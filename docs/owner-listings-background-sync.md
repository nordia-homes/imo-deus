# Owner Listings Background Sync

Aceasta implementare ruleaza scraping-ul in background astfel:

1. Firebase Scheduler declanseaza functia `ownerListingsBackgroundSync`
2. Functia apeleaza ruta interna:
   `/api/owner-listings/sync/background`
3. Aplicatia Next executa scraping-ul cu Playwright
4. Rezultatele si logurile se salveaza in Firestore

## Colectii Firestore

- `ownerListings`
- `ownerListingSyncJobs`

## Variabile necesare

### In App Hosting / Next runtime

- `OWNER_LISTINGS_CRON_SECRET`

### In Firebase Functions runtime

- `OWNER_LISTINGS_APP_BASE_URL`
  Exemplu:
  `https://studio-652232171-42fb6.web.app`
  sau URL-ul App Hosting real

- `OWNER_LISTINGS_FUNCTIONS_CRON_SECRET`
  Trebuie sa fie identic cu valoarea din App Hosting.

## Deploy

1. Genereaza secretul comun:
   `powershell -Command "[guid]::NewGuid().ToString('N')"`
2. Seteaza secretul pentru App Hosting:
   `firebase apphosting:secrets:set OWNER_LISTINGS_CRON_SECRET`
3. Acorda acces backend-ului App Hosting la secret:
   `firebase apphosting:secrets:grantaccess OWNER_LISTINGS_CRON_SECRET --backend studio --project studio-652232171-42fb6 --location us-central1`
4. Seteaza secretul pentru Functions:
   `firebase functions:secrets:set OWNER_LISTINGS_FUNCTIONS_CRON_SECRET`
5. Seteaza URL-ul aplicatiei pentru Functions:
   `firebase functions:secrets:set OWNER_LISTINGS_APP_BASE_URL`
6. Instaleaza dependintele pentru functions:
   `cd functions && npm install`
7. Build:
   `npm run build`
8. Deploy:
   `firebase deploy --only functions`

## Script helper

Poti rula direct:

`powershell -ExecutionPolicy Bypass -File .\scripts\deploy-owner-listings-background.ps1`

## Valori recomandate

- `OWNER_LISTINGS_APP_BASE_URL`
  `https://studio-652232171-42fb6.web.app`

- `OWNER_LISTINGS_CRON_SECRET`
  valoare random lunga, de exemplu:
  `7f4f6f5f0c724f8f8f4d7d7d51c1a8ab`

## Schedule

Schedulerul este setat la:

- `every 2 hours`
- timezone: `Europe/Bucharest`

## Scope curent

Momentan jobul ruleaza pentru agentiile cu:

- `agency.city == "Bucuresti-Ilfov"`

si foloseste linkurile dedicate pentru:

- `OLX`
- `Publi24 Bucuresti`
- `Publi24 Ilfov`
- `Imoradar24 Bucuresti + Ilfov`

## Reguli speciale

- `Imoradar24` accepta doar anunturi cu vechime maxima de `60 zile`
- jobul scrie un document de audit per rulare in `ownerListingSyncJobs`
