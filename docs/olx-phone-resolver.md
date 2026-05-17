# OLX Phone Resolver Intern

Butonul `Apel AI` foloseste infrastructura interna:

`POST /api/owner-listings/olx-phone`

Fluxul este:

1. Verifica `ownerListings.ownerPhone`.
2. Incearca browserul intern Playwright cu sesiune de agent salvata in Firestore.
3. Incearca scraperul intern OLX (`fetch` + browser + DOM + endpoint-uri OLX cunoscute).
4. Daca telefonul nu este disponibil imediat, pune anuntul in `ownerListingOlxPhoneQueue` pentru retry.
5. Cand un retry gaseste telefonul, il salveaza in `ownerListings.ownerPhone`.

Nu exista dependinta de servicii externe pentru preluarea telefonului.

## Endpoint Apel AI

```json
{
  "url": "https://www.olx.ro/d/oferta/...",
  "listingId": "owner-listing-id",
  "title": "Titlu anunt"
}
```

## Response

```json
{
  "phone": "07xxxxxxxx",
  "source": "agent-browser",
  "message": "Telefon preluat prin browserul intern OLX."
}
```

Daca telefonul nu a fost gasit imediat:

```json
{
  "phone": "",
  "source": "queued",
  "message": "Telefonul OLX nu a fost disponibil imediat. Anuntul a fost trimis in coada interna de retry."
}
```
