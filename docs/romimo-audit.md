# Audit Romimo / Publi24 — 26.09.2026

Audit local al implementării, al rutelor, al interfeței și al regulilor de acces folosite de integrare. Fără publicări reale, acces la cont Romimo sau deploy.

## Constatări remediate

| Prioritate | Problemă reproductibilă | Remediere |
| --- | --- | --- |
| P1 | Ștergerea proprietății bloca verificarea/retragerea; ștergerea în timpul unei cereri externe anula și salvarea rezultatului privat. | Rezultatul se păstrează independent de proprietate. Verificarea/retragerea folosesc asocierea privată. Listă paginată în Integrări pentru administrarea tuturor anunțurilor trimise. Proprietățile șterse nu sunt recreate. |
| P1 | Blocarea temporară era verificată doar la început. Un proces întârziat putea continua după expirare și suprascrie un rezultat mai nou. | Verificarea proprietarului și expirării blocării la fiecare tranzacție de scriere; rezervă de timp înaintea cererii externe; un proces vechi nu poate elibera blocarea altuia. |
| P2 | Hash-ul previzualizării includea doar payloadul. O modificare în CRM putea rămâne nedetectată dacă formularul păstra valoarea veche drept suprascriere. | Hash pentru proprietate + payload, plus reverificarea tranzacțională a proprietății după validările externe. |
| P2 | Setările salvate reutilizau automat anul construcției, etajul sau categoria veche după editarea proprietății. | Se rețin valorile derivate inițiale; previzualizarea actualizează câmpurile provenite din CRM și păstrează alegerile manuale distincte. Setările vechi fără această bază sunt păstrate pentru verificare manuală. |
| P2 | După o eroare de publicare, interfața putea continua să creadă că nu există trimitere, cu verificarea/retragerea dezactivate. | Reîncărcarea stării autoritative după eroare; un eșec secundar de reîncărcare nu transformă un răspuns reușit în mesaj fals de publicare eșuată. |
| P2 | Era acceptată o categorie de închiriere pentru o proprietate de vânzare; `Date.parse` accepta zile inexistente prin normalizare. | Validare tranzacție–categorie și dată calendaristică exactă. |
| P2 | Limitele de dimensiune se verificau după citirea completă în memorie; erorile HTML sau conexiunile blocate nu aveau tratare utilă în browser. | Citire limitată în timpul transferului, anularea corpului prea mare, timeout în browser și mesaje de recuperare fără retrimitere automată. |
| P2 | Validarea localității compara forme normalizate, însă trimitea denumirea introdusă liber. | Se trimit județul, localitatea și zona exacte returnate de nomenclatorul Romimo. |
| P2 | Proprietățile vechi fără lista `images` produceau excepție în previzualizare. | Listă goală și avertisment explicit pentru fotografii absente. |

## Problemă majoră preexistentă, rămasă deschisă

**P1 — identitatea agenției și rolul sunt controlabile de client în regulile locale.**

`src/firestore.rules` (fișierul selectat de `firebase.json`) și copia `firestore.rules`, în blocul `match /users/{userId}`, permit `read, write` asupra întregului profil dacă UID-ul corespunde. Nu protejează `role` sau `agencyId`. `requireAgencyUserFromBearerToken` din `src/lib/firebase-app-hosting.ts` citește exact aceste câmpuri pentru contextul API. În consecință, dacă aceste reguli sunt cele publicate, un utilizator autentificat își poate modifica profilul pentru a pretinde apartenența la altă agenție sau rolul de administrator. Integrarea poate apoi utiliza credențialele private ale agenției alese prin server, deși cheia API nu este expusă direct.

Această constatare se bazează pe codul și regulile locale. Nu s-au inspectat regulile din producție și nu s-a executat o tentativă de acces la date reale.

Remedierea corectă trebuie să mute atribuirea rolurilor și apartenenței într-un flux de încredere pe server și să interzică modificarea acestor câmpuri de către client, inclusiv la creare/recreare. Necesită actualizarea și testarea înregistrării cu invitație (`src/app/(auth)/register/page.tsx`), a mecanismelor de reparare din `src/context/AgencyContext.tsx`, a administrării membrilor și a regulilor pentru invitații/agenții. O simplă verificare suplimentară a rolului în ruta Romimo nu rezolvă sursa nefiabilă. Acest flux comun nu a fost modificat în auditul integrării.

**Concluzie de lansare: nu consider integrarea pregătită pentru activare în producție până la remedierea sursei de autorizare și validarea cu contul de test.**

## Ce depinde de contul de test / ce lipsește din prima etapă

- Răspunsurile autentificate Romimo nu au încă exemple reale. Parserul tokenului și interpretarea `active` sunt provizorii. Trebuie verificat dacă `active` înseamnă efectiv publicat sau doar activare cerută, inclusiv moderarea, expirarea și erorile transmise cu HTTP 200.
- Actualizarea prin același identificator rămâne condiționată de `ROMIMO_UPSERT_CONFIRMED`; nu se activează până nu este verificată lipsa duplicării și comportamentul după ștergere.
- Mediul de test, limitele pachetului, perioada de valabilitate, accesul la fotografii și distribuția pe Publi24/Romimo trebuie confirmate. Publicarea pe anuntul.ro nu este stabilită prin contractul analizat.
- Actualizare 2026-09-27: dialogul de scoatere din portofoliu retrage anunțurile înainte de ștergere sau de salvarea unei vânzări. Nu există sincronizare periodică; editările directe de status din alte fluxuri nu declanșează retragerea. Anunțurile orfane mai vechi rămân administrabile din Integrări. Vezi `property-removal.md`.
- Lead-urile și republicarea/promovarea plătită rămân în etapa ulterioară stabilită.

## Verificare

Teste locale pentru mapare, transport, autorizarea rutelor cu context simulat, persistență, paginare, recuperare după ștergere, proces expirat și cereri simultane. Testele folosesc un model de stocare în memorie; nu substituie emulatorul Firestore, verificarea regulilor publicate sau testele reale Romimo. Validarea vizuală interactivă în browser nu a fost efectuată în acest audit.

Comenzi: `npm run test:romimo`, `tsc --noEmit --incremental false`, ESLint pentru fișierele integrării, `git diff --check`.
