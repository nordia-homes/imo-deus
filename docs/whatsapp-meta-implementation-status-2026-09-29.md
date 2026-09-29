# Stadiu implementare WhatsApp Meta — 29 septembrie 2026

Acest document urmărește planul `whatsapp-meta-implementation-plan-2026-09-29.md`. Modificările de cod sunt locale; nu reprezintă activarea serviciului în Meta sau lansarea în producție.

## Implementat local

- Sesiune Embedded Signup pe server, cu expirare, folosire unică și legare de agenție, administrator și mod; inspecția tokenului, verificarea permisiunilor, WABA, numărului și monedei; token criptat și data expirării.
- Detectarea expirării autorizării în worker și marcarea reconectării necesare.
- Status de eșec după acceptarea API, păstrarea erorii Meta, fără retrogradare de la `read` și fără contabilizarea acceptării ca livrare.
- Rezervarea bugetului până la `delivered`, `read` sau `failed`; erorile cu rezultat incert rămân `unknown` și nu sunt retrimise automat.
- Blocare pentru retragerea consimțământului, inclusiv comenzi STOP primite pe WhatsApp; verificare repetată înaintea executării jobului.
- Paginarea șabloanelor, previzualizarea corpului cu parametrii introduși și respingerea explicită a componentelor pe care editorul actual nu le poate completa; verificarea șablonului aprobat înainte de trimitere.
- Coada conversațiilor neatribuite pentru administrator și instrument CLI de reluare controlată a unui webhook eșuat.
- Selectarea tarifului numai în moneda verificată a WABA.

## Rămâne de implementat în aplicație

1. Diagnostic complet al capabilităților `send`, `receive`, `templates`, `nativeSync`, `history`, inclusiv probă reală înainte de activarea trimiterii și indicatori pentru calitatea numărului/abonarea webhook.
2. Normalizare completă pentru mesajele interactive, tipurile media și istoricul Coexistence; reconciliere pentru evenimente fără cont asociat, statusuri lipsă și `unknown`.
3. Editor pentru parametri de header, butoane și media ai șabloanelor, cu previzualizarea conținutului final.
4. Validarea la expediere a ofertelor imobiliare, prețului, disponibilității, linkului și aprobării draftului.
5. Ledger financiar detaliat, alerte la praguri, limite zilnice/per campanie și reconciliere cu rapoartele/factura Meta.
6. Repartizare automată, SLA, escaladare, semnalarea lucrului simultan, legături CRM/proprietăți fără fuziuni ambigue și tratamentul celor 42 de linkuri WhatsApp externe din aplicație.
7. Căutare completă și reconstrucție Typesense, retenție și ștergere/export în toate copiile derivate, inclusiv media și backup.
8. Automatizări pentru vizionări, campanii cu aprobare, raportare imobiliară și dashboard operațional.
9. Publicarea regulilor/indecșilor/TTL, configurarea mediului, monitorizarea și pilotul pe numere autorizate.

## Dependențe ale titularului contului Meta

- Administrarea portofoliului Meta, verificarea afacerii, App Review și permisiunile necesare agențiilor externe.
- Alegerea numărului pilot și verificarea eligibilității Coexistence sau a numărului Cloud API.
- Confirmarea modelului de facturare directă, monedei și metodei de plată în WABA; apoi configurarea `WHATSAPP_DIRECT_BILLING_READY` numai dacă este verificat.
- Configurația Embedded Signup și ID-ul ei, domenii/URL-uri aprobate, webhook și abonarea WABA.
- Numere de test cu consimțământ, șablon aprobat și decizii privind opt-in, retenție, ore/frecvență de contact.

## Reguli de produs confirmate de titular

- Mesaje: retenție 12 luni; media: 6 luni; evenimente tehnice: 30 de zile.
- Campanii și automatizări: `Europe/Bucharest`, 09:00–18:00, maximum un mesaj pe zi pentru un destinatar.
- Aceste reguli încă necesită implementarea completă în toate depozitele și fluxurile automate. Webhookurile au deja `expiresAt` la 30 de zile în cod, dar politica TTL trebuie publicată în mediul Firebase.

## Verificare locală efectuată până acum

- `npm run typecheck:communications`: trecut și după verificarea monedei WABA.
- `npm run test:communications`: 40 trecute, 2 omise deoarece necesită emulatorul Firestore.
- `git diff --check`: fără erori de spațiere.
- Nu a fost executat un pilot live și nu au fost trimise mesaje reale.
