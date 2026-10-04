# Jarvis v5 — acțiuni reale și carduri

## Probleme confirmate și remedieri

Conversația furnizată a arătat citirea tuturor vizionărilor în locul zilei cerute, epuizarea bugetului de tokeni, lipsa modificării statusului proprietății și filtrarea zonei după primele mii de anunțuri. Aceste comportamente au fost corectate în implementare, nu doar în instrucțiunile modelului.

- Calendar: filtrare Firestore după zi/interval și status, agregare exactă și previzualizare limitată, cu nume client, proprietate și ora Bucureștiului. Continuările sunt legate de utilizator, agenție și criterii. Indexurile indisponibile duc la rezultate explicit parțiale, nu totaluri inventate.
- Acțiuni: 24 tipuri de acțiuni, 22 funcții native de pregătire, 21 instrumente de bază și 67 adaptoare pentru handler-ele modulelor existente. Permisiunile reale ale rolului rămân obligatorii.
- Adăugate: status proprietate, notă proprietate, promovare pe site, ștergere sarcină/vizionare. Rezervarea scrie atomic și istoricul statusului; vânzarea cere prețul final. Ștergerile păstrează un jurnal privat.
- Client nou + vizionare: un plan cu referința `@step:1:contactId`, fără ID inventat. Câmpurile opționale `null` din acțiunile compuse sunt normalizate pe baza contractului; câmpurile obligatorii rămân validate.
- Buget: rezervarea folosește utilizarea măsurată de provider și creșterea textului; ciphertextul raționamentului nu este taxat ca text base64. Limitele efective de tokeni, cost și durată rămân active.
- Anunțuri: proiecție v2 scrisă atomic cu sursa, index pe tranzacție/zonă/tip/camere/preț. Nu se caută numai în cele 100 de rezultate ale paginii. Indexurile sunt native Firestore; o proiecție lipsă declanșează citirea live cu continuare.
- Carduri: proprietăți cu fotografie/preț/zonă/camere, calendar cu total și oră, clienți, sarcini, statistici și documente. Butoane pentru prospectare, acord telefonic WhatsApp, vizionare, rezervare și finalizare sarcină. Potrivirile CRM au buton separat. Planul are câmpuri lizibile, iar datele tehnice rămân în detalii.

## Validare

- 609 teste automate trecute, inclusiv 349 vizionări istorice cu doar trei pentru mâine, zi DST de 23 de ore, continuări incompatibile, ciphertext mare, rezervare idempotentă și anunțuri Titan după 6.000 de anunțuri din altă zonă.
- 18 teste Firestore în emulator: istorice, planuri, acorduri și jurnalul ștergerilor nu pot fi falsificate din browser, inclusiv de administrator.
- 13 verificări UI: desktop/mobil, cereri autentificate, plan înainte de execuție, proprietari înaintea CRM, acord explicit și blocarea repetării unui rezultat extern incert. Capturi inspectate vizual.
- 12/12 evaluări OpenAI reale pe date sintetice: șase comenzi cu Luna și Sol, cost total 0,03629253 USD. Include exact familiile comenzilor eșuate: total mâine, rezervare, client nou + vizionare, Titan/2 camere/buget, sarcină finalizată și notă proprietate.
- TypeScript și build de producție trecute. Evaluările folosesc contractele reale, dar date sintetice; nu s-au creat vizionări sau trimis mesaje reale pentru testare.

## Limite operaționale

Jarvis poate folosi acțiunile înregistrate și datele autorizate. Nu are scrieri arbitrare în baza de date. Acțiunile sensibile și externe cer confirmarea planului; autorizarea existentă a pașilor safe rămâne limitată la tipurile aprobate. WhatsApp depinde de acordul explicit, șablonul eligibil și disponibilitatea integrării Meta. Anunțurile externe apar după ingestia lor în corpus; indexul nu înlocuiește ingestia.

Starea publicării și acoperirea finală a proiecției v2 sunt consemnate după verificarea producției.
