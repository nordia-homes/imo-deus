# Plan integrare InfoCUI in pagina de inregistrare

## Obiectiv

Activarea preluarii automate a datelor juridice pentru firme si PFA-uri direct din formularul de inregistrare, pe baza campului `CUI / CIF`, fara expunerea cheii InfoCUI in frontend.

## Abordare

1. Adaugam un utilitar server-side pentru lookup InfoCUI.
2. Adaugam un endpoint intern Next.js care:
   - valideaza `CUI / CIF`
   - apeleaza InfoCUI cu cheia din environment
   - normalizeaza raspunsul
   - intoarce doar campurile utile pentru onboarding
3. Legam pagina de `register` la endpointul intern.
4. La succes:
   - completam automat `Denumire legala`
   - completam automat `Nr. registrul comertului`
   - completam automat `Sediu social`
   - pastram `Reprezentant legal` editabil pentru completare manuala
   - deschidem automat campurile juridice manuale, astfel incat utilizatorul sa poata verifica datele
5. La eroare:
   - afisam feedback clar in UI
   - nu blocam completarea manuala

## Configurare

Este necesara variabila de mediu:

`INFOCUI_API_KEY=...`

Cheia trebuie folosita doar pe server, prin endpointul intern.

## Mapping propus

- `cod_fiscal` -> `companyTaxId`
- `nume` -> `legalCompanyName`
- `cod_inmatriculare` -> `tradeRegisterNumber`
- `adresa` sau adresa compusa din campurile disponibile -> `registeredOffice`
- `reprezentant legal` ramane optional/manual daca nu exista sigur in raspuns

## Rezultat asteptat

In formularul de inregistrare, utilizatorul introduce `CUI / CIF`, apasa `Preia automat datele firmei`, iar datele juridice apar direct in campurile formularului, gata de verificare si ajustare.
