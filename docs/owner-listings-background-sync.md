# Owner Listings Crawl Cycle

Fluxul automat pentru `owner listings` ruleaza acum ca un `crawl cycle controller`, separat de sync-ul manual din UI.

## Ce face

1. Schedulerul loveste periodic ruta:
   `/api/owner-listings/sync/background`
2. Aplicatia verifica starea ciclului din Firestore pentru fiecare agentie eligibila.
3. Daca nu exista ciclu activ si cooldown-ul a expirat, porneste un ciclu nou.
4. Ciclul proceseaza sursele strict in ordinea:
   - `OLX`
   - `Publi24`
   - `Imoradar24`
5. Workerul proceseaza batch-uri mici de pagini din sursa curenta.
6. Cand toate sursele sunt terminate, ciclul intra in `cooldown` pentru `2 ore`.
7. Dupa expirarea cooldown-ului, urmatorul tick porneste un ciclu nou.

## Colectii Firestore

- `ownerListings`
- `ownerListingSyncCycles`
- `ownerListingSyncCycleJobs`
- `ownerListingSyncRuns`
- `ownerListingOlxPhoneQueue`

## Diferenta fata de sync-ul manual

- `POST /api/owner-listings/sync`
  Ruleaza sync manual imediat pentru agentia curenta, ca pana acum.

- `POST /api/owner-listings/sync/background`
  Ruleaza doar `un tick` al controllerului automat.

## Recomandare Scheduler

Nu seta schedulerul la `2 ore`.

Seteaza-l la `5 minute`, iar aplicatia decide singura:
- daca exista deja ciclu activ
- daca ciclul este in cooldown
- daca trebuie pornit un ciclu nou

Astfel obtii:
- fara suprapuneri intre cicluri
- reluare corecta dupa erori
- repornire la `2 ore dupa terminarea completa`, nu la o ora fixa arbitrara

## Parametri impliciti

- `hardPageLimit`: `250`
- `maxAgeDays`: `60`
- `maxPagesPerTick`: `12`
- `maxRuntimeMs`: `420000` (`7 minute`)
- `cooldown`: `2 ore`

## Payload optional pentru ruta de background

```json
{
  "agencyId": "optional",
  "hardPageLimit": 250,
  "maxAgeDays": 60,
  "maxListingsPerSource": null,
  "maxPagesPerTick": 12,
  "maxRuntimeMs": 420000
}
```

## Secret necesar

- `OWNER_LISTINGS_CRON_SECRET`

Header-ul folosit de scheduler:

- `x-owner-listings-cron-secret`

## Observatii

- telefonul `OLX` ramane separat, prin coada `ownerListingOlxPhoneQueue`
- ciclul principal nu asteapta enrichments lente ca sa se considere terminat
- `Imoradar24` ignora acum anunturile care au ca sursa reala `OLX` sau `Publi24`
