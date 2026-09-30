# Modulul de colaborare — implementare și verificare

## Fluxuri livrate

- Înscriere separată cu verificarea emailului, organizație externă și invitații pentru echipă. Conturile externe sunt izolate de CRM în rutare, API și regulile Firestore.
- Accesul agenților CRM la același dashboard de colaborare, fără autentificare suplimentară.
- Publicarea unei fișe aprobate din pagina proprietății, alegerea fotografiilor și a condițiilor, catalog comun paginat și retragerea fișei.
- Link unic per colaborator și proprietate. Pagina cumpărătorului afișează numai contactul colaboratorului; solicitările și reacțiile sunt atribuite linkului său.
- Mesajele și cererile de vizionare creează leaduri în contul colaboratorului. Pentru un agent CRM din altă agenție, contactul se adaugă și în propria agenție; nu este scris în CRM-ul agenției care deține proprietatea.
- Dosare comune pornite numai de colaborator, cu acceptarea condițiilor, schimb de mesaje, statusuri, programarea vizionării, oferte și notificări în aplicație.
- Retragere automată la schimbarea statusului sau agentului proprietății și la eliminarea proprietății; curățare periodică a documentelor de limitare a traficului.

## Verificări automate

- `npx tsc --noEmit --pretty false` — trece.
- `npx next build --webpack` — trece; avertismente existente pentru Jaeger/Tailwind.
- `cd functions && npm run build` — trece.
- `npx vitest run src/lib/collaboration/policy.test.ts src/lib/collaboration/server.test.ts src/lib/property-removal/__tests__/service.test.ts` — 22 teste trec.
- `npx eslint` pe modul și integrarea de cont — fără erori; rămân avertismente React despre actualizări de stare în efecte.
- Testele regulilor Firestore au fost adăugate, dar emulatorul nu a putut porni pe această mașină: Java nu este instalat.

## Verificare necesară înainte de lansare

1. Rulați `npx firebase emulators:exec --project demo-imodeus-collaboration --only firestore "npx vitest run src/lib/collaboration/firestore-rules.test.ts"` într-un mediu cu Java.
2. Verificați manual cu trei conturi: agentul proprietății, colaborator extern și cumpărător anonim; confirmați că leadul nu apare în agenția proprietății, că linkul afișează numai colaboratorul și că dosarul devine comun doar după deschidere.
3. Publicați aplicația, regulile Firestore din `src/firestore.rules` și funcțiile `collaborationPropertyWritten` și `collaborationRateLimitCleanup` împreună.
4. Auditați separat accesul public existent la documentele brute `agencies/{agencyId}` și `agencies/{agencyId}/properties/{propertyId}`. Regulile actuale permit citirea lor pentru site-ul public; unele documente pot conține câmpuri interne. Modulul nou proiectează o fișă limitată pentru linkul colaboratorului, dar nu schimbă această arhitectură veche a site-ului public.
