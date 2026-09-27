# Decizii finale: sincronizare, căutare, conectare și costuri

27 septembrie 2026. Acest document fixează cele patru decizii solicitate după audit și are prioritate față de formulările deschise din plan/audit. Nu reprezintă o integrare activată sau autorizarea cumpărării unor servicii.

## D1. Mesajele trimise din aplicațiile native

Decizie: Inbox central cu sincronizarea activității native prin API-urile oficiale, în conversații individuale. ImoDeus este locul recomandat pentru lucrul echipei, atribuirea agentului și automatizări. Nu folosim scraping, sesiuni WhatsApp Web sau citirea telefonului.

### WhatsApp

- Pentru numărul existent din WhatsApp Business App folosim Embedded Signup cu Coexistence. Implementăm primirea mesajelor, statusurilor și evenimentelor `smb_message_echoes`, precum și importul oficial de istoric când agenția îl autorizează.
- Activarea modului mixt necesită test real în ambele direcții: client → agenție, răspuns din Business App → Inbox, răspuns din Inbox → client și reflectarea în Business App. Se verifică separat dispozitivele suportate; nu declarăm sincronizare integrală pentru dispozitive sau tipuri de mesaje neacoperite.
- Dacă numărul nu este eligibil pentru Coexistence, integrarea lui rămâne neactivată. UI oferă conectarea unui număr business dedicat Cloud API, folosit prin Inbox web/mobil/desktop. Nu dezînregistrăm și nu migrăm automat numărul existent, nu cerem ștergerea contului de pe telefon.
- WhatsApp personal nu intră în modul mixt. Grupuri, apeluri, Status și Channels nu fac parte din sincronizarea Inbox a acestei versiuni.
- Importăm numai istoricul furnizat oficial și acceptat de agenție. Afișăm data celui mai vechi mesaj importat și starea importului; lipsa istoricului nu este prezentată ca lipsă a conversațiilor pe telefon.

### Messenger și Instagram

- Folosim webhooks pentru evenimente disponibile și Conversations API pentru import/reconciliere în limitele furnizorului. Implementăm și recunoașterea mesajelor expediate extern, nu doar a inboundurilor.
- Activarea modului mixt pe fiecare cont cere testul unui răspuns din interfața nativă și apariția lui în Inbox. Reconcilierea este declanșată la reconectare și deschiderea unei conversații cu date vechi, cu limitarea frecvenței per cont. Nu facem polling nelimitat pentru toate conversațiile.
- Dacă sincronizarea nativă nu poate fi validată, funcția este afișată «Sincronizare externă indisponibilă»; lucrul în Inbox rămâne disponibil dacă send/receive sunt validate. Automatizările bazate pe absența unui răspuns sunt oprite pentru contul respectiv. Un agent poate înregistra manual «Am răspuns extern» ca eveniment intern, nu ca mesaj pretins sincronizat.

### Comportament comun

- `origin`: imodeus / native / other_integration / unknown. Autorul intern există numai pentru mesajele trimise prin ImoDeus; nu atribuim agentului conectat un răspuns de pe telefon dacă platforma nu identifică persoana.
- Deduplicare prin cont extern + ID mesaj. Echo-ul completează mesajul existent și nu declanșează o nouă trimitere.
- Orice outbound uman observat anulează joburile de răspuns automat la inboundul pe care îl precede și mută controlul la agent. Un inbound ulterior creează un ciclu nou; nu anulăm automat remindere independente de vizionare.
- Mesajele native nu reînnoiesc artificial fereastra de răspuns a clientului. Evenimentele de editare/ștergere se aplică când sunt expuse de API; cele nesuportate nu sunt inventate.
- UI: «Trimis din ImoDeus» / «Trimis din aplicația externă» / «Origine necunoscută», ultima sincronizare și avertizarea de acoperire incompletă. Acestea sunt stări de produs definitive, nu promisiunea că API-urile oferă tot istoricul.

## D2. Căutare și performanță

Decizie: Firestore rămâne baza operațională; Typesense Cloud, într-o regiune UE disponibilă, este indexul dedicat pentru căutare. Căutarea integrală intră în prima versiune de producție a Inbox-ului. Nu migrăm baza existentă la altă ediție Firestore pentru această funcție.

- Un singur câmp de căutare: nume, telefon normalizat, email, referință/titlu proprietate, textul mesajelor și numele atașamentelor. Rezultatele includ fragmentul relevant și deschid conversația la mesajul găsit.
- Text normalizat pentru căutări cu/fără diacritice; toleranță la greșeli pentru nume și text. Telefoanele și identificatorii exacți au prioritate și nu folosesc potrivire aproximativă. OCR și transcrierea fișierelor audio nu intră în această versiune.
- Filtre: canal, cont, agent, stare, proprietate și perioadă. Notele interne au index/tip separat și sunt returnate numai utilizatorilor autorizați pentru ele.
- Colecții de căutare separate pentru conversații și mesaje; actualizări prin outbox idempotent cu versiune, inclusiv modificări/ștergeri și datele contactelor. Joburi vechi nu pot restaura mesaje șterse. Indexul poate fi reconstruit din Firestore.
- Căutarea trece exclusiv prin endpointul serverului ImoDeus. Acesta impune `agencyId` și domeniul de acces, apoi reverifică în Firestore dreptul curent asupra fiecărui rezultat înainte de a returna text sau fragmente. Nu expunem chei administrative, totaluri/facete globale sau fragmente neautorizate. Reatribuirea revocă accesul imediat, chiar dacă indexul are întârziere.
- Indexăm numai câmpurile necesare; fără payloaduri brute, tokenuri, URL-uri private sau conținut binar. Ștergerea și retenția acoperă și indexul și politica de backup a serviciului.
- Pagini: 30 conversații, 50 mesaje, 20 rezultate. Firestore folosește cursoare stabile cu ID ca departajare; căutarea folosește paginarea motorului, resetată la schimbarea interogării. Listeners pentru prima pagină și conversația activă, nu pentru întregul istoric.
- Indexare țintă: p95 sub 10 secunde în pilot. Rezultatul de căutare arată dacă indexarea întârzie. La indisponibilitatea Typesense, primirea și trimiterea continuă; UI arată «Căutarea în mesaje este temporar indisponibilă», cu navigare/filtre și căutare exactă prin câmpurile indexate în Firestore. Nu simulăm full-text descărcând toate mesajele.
- Costul serviciului de căutare este infrastructură ImoDeus, inclus în costul modulului, nu taxă Meta. Dimensionarea clusterului se face pe volumul pilotului și nu schimbă alegerea tehnologiei. Contractarea serviciului rămâne o acțiune separată de acest document.

## D3. Conectare Meta pe capabilități

Decizie: un registru comun de conexiuni la nivel de agenție, cu activare modulară pe cont și funcție. Interfața oferă două acțiuni clare: «Conectează Facebook + Instagram» și «Conectează WhatsApp». Utilizatorul nu gestionează manual tokenuri.

- Facebook + Instagram utilizează Facebook Login for Business și cont Instagram profesional legat de pagină. Administratorul selectează pagina/contul și funcțiile dorite. Instagram Login separat nu este în această versiune.
- WhatsApp utilizează Embedded Signup separat, contul și numărul aparținând agenției. Aplicația ImoDeus trebuie să îndeplinească cerințele Meta de acces/onboarding înainte de conectarea agențiilor externe.
- Permisiunile se cer incremental pentru funcția activată; permisiunile Ads nu sunt condiție de produs pentru organic sau Inbox. Dependențele cerute efectiv de Meta pentru tipul contului sunt incluse explicit, fără presupunerea că există un set universal de scopes.
- Matrice server-side: Facebook publicare; Instagram publicare; Messenger receive/send; Instagram receive/send; comentarii; statistici; WhatsApp receive/send/templates; native sync/history separat. Fiecare are statut, motiv, cont extern, permisiuni, expirare și ultima verificare.
- O funcție devine activă numai după verificarea tokenului, accesului la cont, permisiunilor, abonamentelor și probei end-to-end relevante în configurare. Publicarea de test se face doar către un cont de test ori printr-o acțiune explicită a administratorului, nu automat pe pagina publică.
- Stările vizibile sunt «Activ», «Necesită configurare», «Necesită reconectare», «În așteptarea aprobării» și «Indisponibil». Un buton blocat explică motivul și acțiunea de remediere. Problemele statisticilor nu opresc mesageria validă.
- Registrul este comun cu Meta Advertising; conectarea organică nu șterge tokenuri sau selecții necesare Ads. Granturile/tipurile de token se gestionează separat când fluxurile o cer. Deconectarea unui modul oprește joburile sale, nu revocă implicit accesul celorlalte module.
- Control pe server înainte de fiecare operație externă; revocarea sau schimbarea apartenenței contului dezactivează capabilitățile afectate. Un cont extern nu poate fi conectat simultan la două agenții ImoDeus în această versiune.

## D4. Costuri explicite

Decizie: integrare directă WhatsApp Cloud API, fără BSP în această versiune. Agenția deține WABA/numărul și își configurează metoda de plată Meta. Meta facturează agenției consumul WhatsApp. ImoDeus facturează separat abonamentul/modulul său și nu adaugă adaos pe mesaj în modelul propus.

- Onboardingul pentru conturi externe se activează numai când fluxul Tech Provider/Embedded Signup și plata directă a agenției sunt validate. Dacă acest lucru nu este disponibil, afișăm configurarea incompletă; nu utilizăm automat cardul sau linia de credit ImoDeus și nu introducem un intermediar implicit.
- În Marketing → WhatsApp → Consum: buget lunar pentru trimiterile ImoDeus, estimat consumat, rezervat pentru mesaje în curs, consum reconciliat când există date suficiente, dată tarif și moneda contului. Factura Meta este referința financiară finală.
- Administratorul setează plafonul înaintea primului mesaj API cu cost potențial. Implicit, fără plafon configurat, recepția rămâne activă, iar trimiterile cu cost sau cost necunoscut sunt blocate; operațiile confirmate eligibile cu cost zero pot continua.
- Alerte la 80% și 95%; la 100% se opresc trimiterile cu cost din ImoDeus. Numai administratorul poate mări plafonul. Primirea mesajelor rămâne activă. Plafonul nu controlează traficul trimis din alte aplicații sau servicii conectate la același cont.
- Bugetul este protecție operațională bazată pe estimare conservatoare, nu garanție că factura Meta nu îl poate depăși. UI menționează întârzierile, traficul extern și reclasificările. Nu prezentăm o estimare ca debit facturat.
- Previzualizarea trimiterii arată categoria, numărul destinatarilor, estimarea și motivul unui cost zero, când acesta poate fi stabilit. Trimiterea obișnuită nu primește un dialog suplimentar pentru fiecare mesaj; campaniile au sumar de cost la programare.
- Tarife versionate cu perioadă de valabilitate, țară/piață, categorie, monedă și sursă oficială. Revalidare la execuție, rezervare atomică înainte de send, reconciliere la statusurile disponibile. Tarif necunoscut/expirat: oprirea trimiterilor potențial taxabile până la actualizare.
- Facilitățile de tarifare nu extind automat fereastra de mesagerie. Șablonul marketing/utility se clasifică conform aprobării și utilizării reale; agentul nu poate alege arbitrar categoria mai ieftină.
- Mesajele cu rezultat necunoscut păstrează rezervarea până la reconciliere sau rezoluție explicită. Nu eliberăm bugetul doar pentru că solicitarea HTTP a expirat. Costul exact nu se inventează când API-ul nu îl oferă: folosim «estimat», «reconciliat» sau «necunoscut».
- Typesense, stocare și infrastructură intră în costul modulului ImoDeus, cu limite de utilizare publicate înainte de lansarea comercială. Publicarea organică nu lansează campanii Ads și nu consumă automat bugetul publicitar. Abonamentul final nu este stabilit numeric în acest plan.

## Verificare de acceptare pentru cele patru decizii

1. Răspunsul din aplicația nativă acceptată apare o singură dată, cu origine corectă; oprește răspunsul automat corespunzător și nu generează un agent fictiv. Numărul neeligibil primește ruta explicită cu număr dedicat.
2. Căutarea găsește un mesaj vechi, funcționează cu/fără diacritice și deschide poziția corectă. Reatribuirea/ștergerea nu permite accesul prin indexul întârziat. Căderea Typesense nu întrerupe Inbox-ul.
3. Lipsa permisiunii Ads nu blochează funcțiile organic/messaging ale căror cerințe sunt satisfăcute. Revocarea unui acces blochează strict operațiile afectate; clientul nu poate ocoli controlul server-side.
4. Două trimiteri concurente nu depășesc rezervarea disponibilă; un timeout nu eliberează artificial bugetul; costul necunoscut blochează trimiterea taxabilă, iar recepția rămâne activă.

## Baza documentară

- Typesense, integrare Firebase: https://typesense.org/docs/guide/firebase-full-text-search.html
- Typesense, control acces: https://typesense.org/docs/guide/data-access-control.html
- Firebase, căutare text nativă disponibilă în ediția Enterprise: https://firebase.google.com/docs/firestore/enterprise/text-search
- 360dialog, documentația propriei integrări Coexistence și limitele dispozitivelor: https://docs.360dialog.com/docs/resources/phone-numbers/coexistence
- 360dialog, evenimentele Coexistence/history: https://docs.360dialog.com/partner/onboarding/whatsapp-coexistence/coexistence-webhooks
- Meta, Conversations API: https://www.postman.com/meta/messenger-platform-api/folder/22794852-255610cd-47f5-4f4d-b3fa-71aec360be9a
- Meta, Instagram Send API: https://www.postman.com/meta/instagram/folder/uxudqu0/send-api
- WhatsApp, tarifare: https://whatsappbusiness.com/products/platform-pricing/

Sursele furnizorului 360dialog descriu implementarea sa, nu certifică eligibilitatea aplicației ImoDeus pentru conectare directă. Referința Meta `smb_message_echoes` nu a putut fi încărcată de instrumentul web; schema/versionarea și accesul direct sunt probe obligatorii de integrare. Deciziile de produs sunt fixe, iar activarea tehnică depinde de trecerea probelor de mai sus.
