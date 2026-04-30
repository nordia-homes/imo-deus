# OLX Phone Scheduler

Fluxul OLX este acum separat in doua etape:

1. Sync-ul principal OLX salveaza doar detaliile anuntului in `ownerListings`.
2. Telefonul se preia asincron din `ownerListingOlxPhoneQueue`, cate un singur job per rulare.

## Endpoint

- `POST /api/owner-listings/olx-phone-drain`
- Header obligatoriu: `x-owner-listings-cron-secret`

Fiecare apel proceseaza maximum `1` anunt OLX din coada.

## Cloud Scheduler

Schedulerul trebuie configurat sa ruleze la fiecare `5` minute si sa loveasca endpointul de mai sus.

Scriptul inclus:

```powershell
.\scripts\configure-olx-phone-scheduler.ps1 `
  -ProjectId "studio-652232171-42fb6" `
  -Location "us-central1" `
  -AppBaseUrl "https://studio-652232171-42fb6.web.app" `
  -CronSecret "<OWNER_LISTINGS_CRON_SECRET>"
```

## Secret

Scriptul reutilizeaza secretul deja folosit de background sync:

- `OWNER_LISTINGS_CRON_SECRET`

Acest secret trebuie sa existe in mediul unde ruleaza aplicatia.

## Observatii

- Queue collection: `ownerListingOlxPhoneQueue`
- Fiecare rulare proceseaza un singur telefon
- Daca telefonul nu este disponibil, jobul intra in `retry`
- Campurile bune deja existente in `ownerListings` nu mai sunt suprascrise cu valori goale
