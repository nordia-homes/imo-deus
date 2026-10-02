# ImoSocial — plan de implementare și activare pilot

Scop: integrarea din prompt, refolosind infrastructura existentă, remediind problemele care afectează pilotul. Nu include campanii în masă, SLA, automatizări imobiliare sau reconstruirea Facebook/Instagram. Fără commit/push și fără trimitere/modificare a dosarului App Review.

## Dovezi Meta citite la început

- ImoSocial App ID 2339244290179735; Config ID 1401889672012663 în linkul Meta-hosted afișat.
- Business Verification: Approved; App Review: In review (stare preexistentă).
- Meta cere video send/receive și un video separat de creare template pentru whatsapp_business_management.
- Linkul Meta-hosted indică Embedded Signup v4, sessionInfoVersion=3 și varianta Business App onboarding.
- Pagina Next steps arată Phone Number: Not registered, Payment: Not added, Approved message template: Not created. Acestea trebuie confirmate pe assetul pilot efectiv, nu tratate drept inventar al tuturor WABA.

## Ordine și criterii de acceptare

1. Configurație WhatsApp distinctă: ID/secret/config/version, mod disabled/test/production, allowlist server-side pilot. Păstrăm Meta general. Start, finish, template management și outbound respectă modul pilot.
2. Signup: state legat de aplicație/config/mod/admin, o singură sesiune UI, timeout/anulare, event-uri validate, paginare phone_numbers, protecție proprietate înaintea mutațiilor, verificare stare număr și register numai la nevoie în Cloud. Nicio migrare automată.
3. Webhook/callbackuri: secret dedicat, proveniență aplicație în conexiuni; revocare și data deletion izolate per aplicație. GET verificare comună poate fi reutilizat. Nu declarăm ștergerea integrală a istoricului ca implementată.
4. Recepție/outbound: validare și izolare per eveniment, opt-out înainte de send și blocare la backlog nesoluționat, izolare Storia/social, corelare sigură receipts/job, păstrarea erorii, contabilizare idempotentă inclusiv tranziții neordonate, acces media separat de send.
5. Template-uri: listare și trimitere existente; creare minimală server-side și UI pentru template text simplu, admin, validare strictă; respingerea formatelor/parametrilor nesuportați. Nu construim editor complex.
6. Teste: separare app/secrets, acces pilot, state/replay, Cloud/Coexistence, webhook și corelare, template create/validation, regresii audit; typecheck, communications, build Functions și diff check. Emulator dacă runtime-ul necesar este disponibil.
7. Configurare/deployment: verificăm Meta Login configuration/origins, callbackuri, webhook și câmpuri; pregătim secrete/App Hosting, reguli/indecși/Functions. Setările externe se salvează numai când endpointul și valorile sunt valide; nu bifăm artificial billing/production.
8. Pilot: cont CRM și numere explicit alese, signup, inbound, răspuns, delivered/read/failed controlat, creare/listare/trimitere template aprobat. Înregistrăm ce a trecut și ce depinde de titular/Meta. Nu trimitem către destinatari nealeși.
9. Ghid App Review cu ecrane, butoane, permisiuni și date de ascuns; nu trimitem dosarul la Meta.

## Dependențe externe

App Secret ImoSocial trebuie disponibil în Secret Manager ca META_WHATSAPP_APP_SECRET; cheia existentă de criptare rămâne stabilă. Pilotul necesită UID admin CRM allowlisted, număr business separat și destinatar autorizat. OTP/identitate, plăți/termeni și aprobările Meta nu se pot substitui prin cod. Deploymentul public nu se declară finalizat doar pentru că testele locale trec.
