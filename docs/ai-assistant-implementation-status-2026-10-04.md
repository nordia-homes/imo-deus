# AI Assistant — implementare, verificare și activare

Actualizare a auditului din 4 octombrie 2026. Documentele de audit anterioare descriu situația inițială; starea implementării locale este cea de mai jos.

## Plan corectat și etape implementate

| Etapă | Rezultat implementat | Validare |
|---|---|---|
| 1. Identitate și acces | API autentificat; agenție și rol stabilite pe server; colecții și operații permise explicit; secrete eliminate din rezultate; istoricul este reverificat după revocarea accesului | TypeScript și teste de permisiuni/recuperare |
| 2. Căutare proprietari | Anunțuri proprietari implicit; căutare pe întregul corpus eligibil; continuare fără salturi; CRM separat; moneda EUR verificată | Test pentru rezultat după poziția 300, paginare, monede și separarea surselor |
| 3. Conversație și plan | Conversații persistente; citire la cerere; instrumente structurate; schema handler-ului disponibilă modelului; plan cu pași dependenți; confirmare înaintea execuției | Teste de contract, referințe între pași și UI |
| 4. Execuție CRM | Contacte, cerințe, interacțiuni, sarcini, vizionări, recomandări în portal, import/activare/editare proprietăți, oferte și operații existente | Tranzacții atomice, ledger, teste de conflict și idempotență |
| 5. Comunicare și programare | Acord telefonic explicit; șabloane și coadă de mesaje existente; automatizări pentru sarcini, căutări proprietari și șabloane WhatsApp; scheduler și heartbeat | Politicile de comunicare existente și teste de rezultat ambiguu |
| 6. Interfață și verificare | Pagină nouă, istoric, rezultate navigabile, descărcări PDF protejate, acord WhatsApp, reluare a pașilor interni confirmați și verificarea execuțiilor întrerupte | Playwright desktop/mobil, typecheck, build Next.js și teste ale modulelor afectate |
| 7. Activare reală | Necesită deploy, indexuri READY, backfill, scheduler și test cu conturile reale | Nu a fost executată în această sesiune |

Corecțiile principale față de planul inițial:

- Modelul nu primește o copie incompletă a CRM-ului din browser și nu emite instrucțiuni text de tip `ACTION`. Cere date și pregătește acțiuni validate pe server.
- Matching-ul și portalul existent se reutilizează. Recomandarea repetată păstrează feedbackul clientului.
- Căutarea nu depinde de cele 100 de anunțuri afișate în pagina CRM și nu completează rezultatele proprietarilor cu proprietăți interne.
- Proiecția de căutare este scrisă în același document Firestore cu anunțul. Modul indexat se folosește numai când acoperirea versiunii este completă; înaintea migrării sau dacă indexul nu este disponibil, căutarea folosește scanare actuală cu cursor și limite explicite.
- Acordul telefonic este consemnat de agent, cu telefon, scop, data apelului și evidență. AI-ul nu poate acorda consimțământ.
- O automatizare nu poate fi creată ca activă doar fiindcă există un secret: este necesară o execuție recentă confirmată a workerului.
- Un mesaj pus în coadă nu este raportat ca livrat. O execuție externă ambiguă nu se repetă automat.
- Documentele dosarului sunt citite din `sales.checklist`, inclusiv versiunile; mesajele dosarului din `emailMessages`. Nu sunt presupuse colecții care nu există.

## Ce poate face pagina

Citire autorizată din 24 de domenii CRM, cu paginare și acces la câmpuri/documente mari la cerere. Include contacte, proprietăți, sarcini, vizionări, prospectare, tranzacții, documente, conversații, conexiuni, șabloane, analiză de preț, evenimente ale proprietăților, campanii, agenție, agenți, notificări și portaluri.

Catalogul include 67 de adaptoare pentru handler-ele existente, plus 19 tipuri de acțiuni CRM validate. Acoperă prospectare/import, comunicare, colaborări, analize și prezentări, video, portaluri imobiliare, dosare/documente/șabloane, Meta și TikTok. Permisiunile, aprobările și bugetele handler-ului original rămân obligatorii.

Exemple de comenzi:

1. „Găsește 5 apartamente în Titan sub 130000 euro.” Rezultate din Anunțuri proprietari; buton separat **Vezi potrivirile din CRM**.
2. „Programează o vizionare pentru clientul X la proprietatea Y mâine la 15:00.” Identifică entitățile, cere datele lipsă, verifică disponibilitatea și pregătește planul.
3. „Adaugă cele mai bune 5 oferte potrivite clientului X în portal și pregătește mesajul WhatsApp.” Reutilizează matching-ul; actualizarea portalului și trimiterea sunt pași distincți.
4. „Creează o sarcină de follow-up pentru clientul X vineri.” Salvează sarcina reală.
5. „Monitorizează apartamentele cu 2 camere în Pipera sub 160000 euro.” Pregătește o căutare programată, dacă workerul este activ; anunțurile noi identificate produc notificări fără duplicare.
6. „Importă acest anunț din prospectarea mea, completează datele și activează proprietatea.” Importul este inițial inactiv; activarea verifică datele și imaginile necesare.
7. „Verifică documentele lipsă din dosarul X și pregătește următorii pași.” Citește checklist-ul, mesajele și auditul accesibile.

Prospectarea a 10 proprietari nu presupune automat că există acordul lor. Rezervarea/prospectarea, identificarea telefonului, acordul și mesajul sunt etape reale distincte. Se folosesc numai conexiunile și destinatarii eligibili conform configurării Meta existente.

## Garanții și limite precise

- Rezultatele sunt actuale față de scrierile confirmate în CRM. Un anunț extern încă necolectat sau o modificare a site-ului extern încă nesincronizată nu poate fi cunoscută de asistent.
- Proiecția nativă este menținută de fluxurile de ingestie/enrichment/canonicalizare modificate. Orice viitor script care modifică prețul sau localizarea trebuie să actualizeze aceeași proiecție. Nu este suficient să păstreze artificial `searchVersion: 1`.
- Scanarea are bugete de citire; când nu este terminată, returnează cursor și stare parțială. Nu promite că un prim lot este întreaga bază.
- Un plan are maximum 12 pași și expiră după o oră. Cererile ample se împart în planuri verificabile. Un plan intern oprit poate fi reluat explicit fără repetarea pașilor confirmați. Execuțiile întrerupte se pot verifica din UI; efectele externe neconfirmate necesită verificare în modulul/furnizorul corespunzător.
- Blocarea tranzacțională a calendarului protejează acțiunile acestei pagini. Fluxurile vechi care scriu direct din browser nu folosesc această blocare; migrarea lor la același serviciu este necesară pentru o garanție globală de concurență între toate interfețele CRM.
- Nu există execuție arbitrară de cod, SQL, URL sau modificare de permisiuni de către model. Comenzile pentru operații fără adaptor sunt raportate ca indisponibile, nu simulate.
- OAuth, configurarea conturilor externe, încărcarea fișierelor locale, semnarea documentelor și modificarea abonamentelor nu sunt executate arbitrar prin chat. Aceste fluxuri necesită interfețele și autorizările lor specifice. Accesul la datele dosarelor nu reprezintă semnarea sau certificarea documentelor.
- Aprobarea Meta nu expediază automat drafturile vechi. Consimțământul, șablonul, bugetul și eligibilitatea se verifică din nou la trimitere.

## Verificări locale

Rezultate confirmate: **181 teste trecute, 13 sărite**, TypeScript aplicație și Functions fără erori, test UI desktop/mobil trecut și build Next.js de producție reușit. Cele 13 teste sărite reprezintă 3 teste de reguli Firestore și 10 teste de scraping live. După ultimele ajustări, verificările relevante de execuție, acces și planificare au fost reluate.

Comenzi reproductibile:

```powershell
npm run typecheck
npx tsc --noEmit -p functions/tsconfig.json
npx vitest run src/lib/ai-assistant/__tests__ src/lib/owner-listings/__tests__ src/lib/communications/__tests__
npm run test:ai-assistant:ui
npx next build --webpack
npm run ai-assistant:contracts
npm run backfill:owner-search-index -- --help
```

Testul UI folosește componenta reală și CSS-ul aplicației, cu răspunsuri API locale controlate. Verifică autentificarea, pregătirea fără mutație, execuția explicită, căutarea proprietari, separarea CRM, acordul telefonic, lățimea mobilă și absența excepțiilor de browser. Nu este un test end-to-end cu Firebase/Meta/OpenAI reale.

Testele Firestore rules necesită emulatorul; cele trei teste de reguli sunt sărite dacă emulatorul nu rulează. Zece teste de scraping live sunt de asemenea sărite implicit. Nu se prezintă aceste verificări ca trecute.

Nu au fost trimise mesaje reale, publicate reclame/proprietăți, apelate servicii OpenAI plătite, rulate migrări cu `--apply` sau efectuate deploy-uri. Există avertizări ale build-ului din dependența Genkit/OpenTelemetry (`exporter-jaeger`) și clase Tailwind ambigue existente; nu sunt erori de compilare ale asistentului.

## Ordinea activării în producție

1. Verifică proiectul Firebase și mediul de deploy. Folosește staging pentru probele cu date și conexiuni reale.
2. Rulează testele de reguli în emulator și probează două agenții, agent/admin și revocarea accesului. Deploy **mai întâi** al regulilor care interzic scrierile directe în colecțiile server-managed ale asistentului; altfel nu activa noua aplicație.
3. Deploy indexurile din `firestore.indexes.json`; așteaptă starea READY. Nu presupune că indexurile sunt pregătite imediat după comandă.
4. Configurează modelul și cheia pe server (`OPENAI_API_KEY`, opțional `OPENAI_ASSISTANT_MODEL`). În lipsa cheii, căutarea structurată rămâne disponibilă; conversația nu pretinde că modelul este activ.
5. Deploy aplicația cu noii writeri de anunțuri. Rulează `npm run backfill:owner-search-index` în mod dry-run, verifică proiectul/numărul documentelor, apoi `npm run backfill:owner-search-index -- --apply`. Sunt procesate și documentele vechi, cu precondiție de versiune pentru a nu suprascrie actualizări concurente. Repetă verificarea până la acoperire completă; scanarea live rămâne fallback.
6. Creează secretul `AI_ASSISTANT_WORKER_SECRET` și acordă acces backendului App Hosting **înaintea deploy-ului aplicației**, deoarece `apphosting.yaml` include acum binding-ul secretului. Configurează aceeași valoare pentru Functions și URL-ul aplicației în secretul existent `OWNER_LISTINGS_APP_BASE_URL`. Deploy funcția `aiAssistantAutomationsDrain`; confirmă heartbeat-ul și execuția unei sarcini programate de test. Nu publica secretul în client sau documentație.
7. Probează o vizionare, o ofertă în portal, importul și o automatizare cu date de test. Confirmă că stările sunt persistate și că reluarea nu dublează înregistrările.
8. Probează WhatsApp cu numărul/destinatarul permis în mediul Meta actual: acord telefonic înregistrat, șablon aprobat, preview, trimitere, webhook de livrare și oprirea după răspuns. Extinde destinatarii numai când configurarea Meta o permite.
9. Fă rollout controlat. Urmărește latența, citirile Firestore, costurile modelului, execuțiile `unknown`/`blocked` și sănătatea workerului. Rollback-ul aplicației nu revocă efectele externe deja confirmate; nu reexecuta automat operațiile ambigue.

Nu se poate declara pagina validată integral în producție înainte de aceste verificări. Codul și testele locale sunt reviewabile; activarea infrastructurii și probele cu conturile reale constituie etapa rămasă.
