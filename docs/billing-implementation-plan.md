# Plan Complet De Implementare Billing, Abonamente Si Facturare

## Obiectiv

Implementarea unui sistem complet de abonamente pentru ImoDeus care:

- factureaza la nivel de agentie
- permite alegerea unuia dintre cele 3 planuri: `Esential`, `Avansat`, `Profesional`
- taxeaza in functie de numarul de utilizatori activi ai agentiei
- blocheaza adaugarea de agenti noi atunci cand nu exista locuri disponibile
- pregateste integrarea cu Stripe pentru checkout, card management, proratare si webhook-uri
- pregateste integrarea cu SmartBill pentru emiterea automata a facturilor fiscale

## Functionalitati obligatorii in toate planurile

Aceste functionalitati raman disponibile in toate planurile:

- Anunturi particulari
- Gestiune proprietati
- Publicare pe portaluri
- Site agentie imobiliara Basic

## Pozitionarea comerciala a planurilor

### Esential

Pentru agentii care au nevoie de CRM-ul de baza si de un flux operational complet.

Include:

- Anunturi particulari
- Gestiune proprietati
- Publicare pe portaluri
- Site agentie imobiliara Basic
- CRM cumparatori
- Pipeline lead-uri
- Vizionari
- Task-uri
- Management echipa
- Dashboard operational
- Harta proprietati

### Avansat

Pentru agentii care vor sa creasca viteza de lucru, conversia si controlul comercial.

Include tot din `Esential`, plus:

- AI Assistant
- Potrivire proprietati AI
- Rapoarte avansate
- Contracte si sabloane
- OCR documente
- Portal client
- Scorare lead-uri si recomandari comerciale

### Profesional

Pentru agentii care vor branding avansat, automatizare si control executiv.

Include tot din `Avansat`, plus:

- Domeniu custom
- Website branduit premium
- Forecast si alerte executive
- Promovare si fluxuri premium
- Facturare si billing center complet
- Integrari fiscale si comerciale extinse

## Modelul de billing

### Entitatea taxata

Abonamentul este detinut de `agentie`, nu de utilizator.

### Dimensiunile abonamentului

Fiecare agentie are:

- un `plan`
- un numar de `seats` cumparate

### Regula de control

- `activeUsersCount <= purchasedSeats`

Cand agentia vrea sa adauge un utilizator nou si nu mai exista seats disponibile:

- operatiunea este oprita
- utilizatorul este invitat sa cumpere un seat suplimentar
- dupa confirmarea platii seat-ul devine disponibil

## Modelul de pret

### Planuri

- `Esential`
- `Avansat`
- `Profesional`

### Preturi de baza per utilizator

- `Esential`: 9.99 EUR / utilizator / luna
- `Avansat`: 19.99 EUR / utilizator / luna
- `Profesional`: 29.99 EUR / utilizator / luna

### Discounturi pe volum

- `1-3` utilizatori: fara discount
- `4-7` utilizatori: -15%
- `8-14` utilizatori: -25%
- `15-30` utilizatori: -35%
- `31+` utilizatori: -45%

### Valori rotunjite recomandate

- `Esential`: 9.99 / 8.49 / 7.49 / 6.49 / 5.49
- `Avansat`: 19.99 / 16.99 / 14.99 / 12.99 / 10.99
- `Profesional`: 29.99 / 25.49 / 22.49 / 19.49 / 16.49

## Arhitectura tehnica

### Surse de adevar

- `Stripe`: plata si starea financiara
- `Firestore`: entitlement, seats, plan activ si audit operational
- `SmartBill`: factura fiscala si documente contabile

### Componente

- `src/lib/billing/plans.ts`
  - defineste planurile, features si tier-urile de pret
- `src/lib/billing/entitlements.ts`
  - functii de calcul pentru drepturi, seats si pricing
- `src/app/api/billing/*`
  - endpoint-uri server-side pentru checkout, summary, upgrade, downgrade si webhook-uri
- `src/app/(dashboard)/billing/page.tsx`
  - billing center pentru agentie
- `src/app/api/agency/agents/route.ts`
  - enforcement seat-based la creare agent

## Model de date Firestore

In documentul `agencies/{agencyId}`:

- `billingPlan`
- `billingStatus`
- `billingInterval`
- `billingProvider`
- `purchasedSeats`
- `seatUsageCount`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `stripeSubscriptionItemId`
- `billingCurrency`
- `billingEmail`
- `billingCompanyName`
- `billingTaxId`
- `billingAddress`
- `billingLastSyncAt`
- `billingCurrentPeriodStart`
- `billingCurrentPeriodEnd`
- `billingCancelAtPeriodEnd`
- `billingDefaultPaymentMethodBrand`
- `billingDefaultPaymentMethodLast4`
- `smartbillCustomerId`
- `smartbillLastDocumentNumber`

Colectii recomandate:

- `agencies/{agencyId}/billingEvents`
- `agencies/{agencyId}/billingInvoices`
- `agencies/{agencyId}/billingAudit`

## Fluxuri principale

### 1. Abonare initiala

- agentia alege planul
- agentia alege numarul de seats
- se creeaza customer Stripe
- se creeaza sesiune Checkout
- cardul este salvat pentru plati recurente
- webhook-ul Stripe actualizeaza Firestore
- dupa confirmare se emite factura in SmartBill

### 2. Schimbare card

- UI whitelabel in aplicatie
- SetupIntent Stripe
- noul card devine metoda implicita
- Firestore actualizeaza sumarul cardului

### 3. Upgrade plan

- aplicatia cere preview
- serverul calculeaza proratarea
- dupa confirmare se actualizeaza pretul abonamentului
- webhook-ul sincronizeaza planul final

### 4. Downgrade plan

- recomandat la sfarsit de perioada
- nu se aplica daca ar rezulta acces ilegal la functii dependente

### 5. Add seat

- se verifica seat usage
- daca exista seat liber, agentul se poate crea
- daca nu exista seat liber, se cere cresterea cantitatii in Stripe
- agentul este creat doar dupa confirmarea seat-ului

### 6. Remove seat

- nu se poate cobori sub numarul de utilizatori activi
- reducerea este recomandata la sfarsit de perioada

### 7. Anulare

- recomandat `cancel at period end`
- accesul ramane pana la finalul perioadei platite
- dupa expirare contul intra in mod restrictionat

## Integrare Stripe

### Ce va face Stripe

- checkout initial
- stocare metoda de plata
- subscription management
- quantity upgrades
- retries si evenimente de plata
- webhook-uri

### Endpoint-uri necesare

- `GET /api/billing/summary`
- `POST /api/billing/checkout`
- `POST /api/billing/change-plan`
- `POST /api/billing/change-seats`
- `POST /api/billing/setup-intent`
- `POST /api/billing/payment-method/default`
- `POST /api/billing/cancel`
- `POST /api/stripe/webhook`

### Evenimente Stripe obligatorii

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`
- `setup_intent.succeeded`

## Integrare SmartBill

### Rol

SmartBill este folosit pentru emiterea documentului fiscal conform legislatiei locale.

### Flux recomandat

- plata confirmata in Stripe
- webhook-ul intern construieste payload-ul fiscal
- se emite factura SmartBill
- se salveaza referinta documentului in Firestore

### Date necesare

- firma
- CUI
- adresa
- email facturare
- serie factura
- produs / serviciu
- TVA
- perioada facturata

## Entitlements si gating

Sistemul de billing trebuie legat de gating real, nu doar de afisaj:

- paginile premium trebuie protejate in UI
- endpoint-urile sensibile trebuie validate server-side
- helper-ul central trebuie sa poata raspunde la:
  - ce plan are agentia
  - ce features sunt active
  - cate seats sunt disponibile

## Implementare in repo

### Faza 1

- definire planuri si entitlements
- extindere tipuri Agency
- summary route
- pagina de billing conectata la planurile reale

### Faza 2

- seat enforcement la creare agent
- infrastructura pentru checkout si upgrade routes
- audit de billing

### Faza 3

- webhook Stripe
- status sincronizat in Firestore
- preview si schimbari de seats / plan

### Faza 4

- SetupIntent pentru card management
- SmartBill API
- reconciliere Stripe -> SmartBill

### Faza 5

- feature gating complet
- dunning si recoveries
- billing center final

## Limitari externe ramase dupa implementarea locala

Pentru finalizarea live sunt obligatorii:

- chei Stripe reale
- price IDs reale in Stripe
- webhook secret Stripe
- configurare SmartBill API
- reguli fiscale finale pentru TVA si produse facturate

## Criterii de acceptare

- agentia vede planul curent si seats
- agentia vede diferentele dintre planuri
- agentia nu poate depasi seats-urile cumparate
- aplicatia este pregatita pentru checkout Stripe real
- modelul de date este compatibil cu webhook-urile
- emiterea SmartBill are loc separat, dupa configurare de credentiale
