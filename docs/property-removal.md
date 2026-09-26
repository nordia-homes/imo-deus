# Retragerea proprietăților de pe portaluri înainte de ștergere

Implementare locală, 2026-09-27. Nu au fost executate retrageri reale sau publicări de reguli.

## Flux

- Dialogul „Scoate proprietatea din portofoliu” apelează `POST /api/properties/remove` cu token Firebase. Agenția, rolul și baza de date sunt stabilite de server; browserul trimite doar ID-ul proprietății și motivul/detaliile vânzării.
- Serverul identifică portalurile din proprietate, istoricul tentativelor și registrul privat Romimo. Portalurile implementate sunt Imobiliare.ro, Storia și Publi24/Romimo. O asociere activă către un portal fără adaptor împiedică finalizarea; nu se simulează retragerea.
- Retragerile rulează independent. Imobiliare trebuie să raporteze explicit `draft`; Storia trebuie să raporteze `removed_by_user`; Romimo folosește confirmarea DELETE 204 sau verificarea explicită a stării inactive. Răspunsurile necunoscute, lipsa asocierii și erorile nu autorizează ștergerea.
- O retragere parțială păstrează proprietatea. Dialogul arată rezultatul fiecărui portal. Reîncercarea reutilizează confirmările salvate numai pentru aceleași identificatoare externe.
- După confirmarea tuturor portalurilor, istoricul și ștergerea sunt salvate în aceeași tranzacție Firestore. Vânzarea agenției păstrează proprietatea cu statusul `Vândut` și prețul final; vânzările externe păstrează istoricul și elimină proprietatea din portofoliu.
- Retrimiterea aceleiași operațiuni finalizate întoarce rezultatul salvat, fără istoric duplicat. Schimbarea asocierilor în timpul retragerii împiedică finalizarea și cere reîncercare.
- În demo, operațiunea este exclusiv locală. Retragerea Storia păstrează restricția existentă pentru administratorii agenției; rolul este verificat înainte de cereri externe.

## Concurență și recuperare

Registrul privat este `agencyPrivateIntegrations/{agencyId}__property_lifecycle/operations/{propertyId}`. Publicarea și retragerea se exclud printr-un proprietar de operațiune (`owner`) dobândit tranzacțional. Odată începută retragerea, `removalRequested` blochează publicări noi, inclusiv reactivarea prin promovările Imobiliare. Publicarea și aplicarea promovărilor Storia folosesc același mecanism.

Nu există expirare automată a acestei blocări: oprirea procesului nu dovedește că portalul a oprit cererea deja trimisă. În mod normal, `owner` se eliberează în `finally`, inclusiv la erori. Dacă un proces este oprit forțat sau eliberarea eșuează, un operator trebuie să verifice că procesul s-a terminat și să reconcilieze anunțurile înainte de a elibera `owner`. **Nu se golește registrul și nu se elimină `removalRequested` doar pentru că a trecut un interval de timp.** După eliberarea justificată a `owner`, aceeași cerere de retragere poate fi reluată. Nu există încă o interfață de recuperare a proceselor întrerupte sau un worker de reîncercare automată.

Sincronizările și operațiunile întârziate Imobiliare/Storia scriu numai în documente existente; webhookurile Storia folosesc actualizări cu precondiție de existență. Nu mai pot recrea o proprietate ștearsă printr-un `set(merge:true)` întârziat. Anunțurile cu publicări incerte și fără identificator recuperabil necesită reconciliere manuală; nu se presupune că un 404 confirmă retragerea.

## Livrare și limite

- `firebase.json` selectează `src/firestore.rules`. Această versiune și copia `firestore.rules` blochează ștergerea directă de către client; regula generică nu mai acordă implicit dreptul de ștergere a proprietăților. Serverul Admin SDK finalizează operațiunea. Regulile trebuie livrate împreună cu noul client/server; clienții vechi care șterg direct vor primi refuz.
- Problema preexistentă de autorizare prin profiluri `/users/{uid}` editabile de utilizator, descrisă în `romimo-audit.md`, rămâne de rezolvat înainte de producție. Blocarea ștergerii directe nu repară această problemă.
- Fluxul acoperă anunțurile asociate și cunoscute de CRM. Nu descoperă anunțuri introduse independent în portal și nu oprește reclame/social media. Editările de status din alte ecrane nu declanșează acest flux.
- Confirmarea într-un API partajat acoperă numai anunțul asociat acelui API; nu dovedește retragerea din servicii distincte fără asociere și confirmare documentate.
- Testele unitare folosesc Firestore în memorie și răspunsuri HTTP simulate. Contul de test Romimo este încă necesar pentru verificarea contractului real. Testele de reguli necesită un emulator Firestore și Java.

Comandă teste: `npx vitest run src/lib/property-removal/__tests__ src/lib/romimo/__tests__`.

## Verificări locale

- 66 de teste au trecut; 6 teste de reguli sunt omise automat fără `FIRESTORE_EMULATOR_HOST`. Emulatorul nu a rulat în această sesiune.
- TypeScript complet: fără erori.
- ESLint pentru serviciile/rutele noi și adaptoarele modificate: fără erori sau avertismente. Cele două componente UI existente păstrează trei avertismente preexistente legate de hookuri; nu au erori ESLint.
- Nu au fost efectuate teste vizuale interactive sau apeluri autentificate către portaluri.
