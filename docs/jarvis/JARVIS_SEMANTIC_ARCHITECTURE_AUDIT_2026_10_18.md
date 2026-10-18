# Audit revizuit: limbaj natural, execuție, conversații și interfață Jarvis

18 octombrie 2026. Audit al arhitecturii și al propunerii de remediere, nu implementare și nu certificare a celor 1000 de scenarii.

## Concluzie

Direcția propusă este corectă, dar insuficientă. Sunt necesare schimbări în interpretare, autorizarea acțiunilor, bugetare, starea persistentă a solicitării, recuperarea istoricului, contractele uneltelor, rezolvarea entităților, interfață și evaluare. Un prompt mai bun, activarea Jev sau încă un parser de formulări nu rezolvă împreună aceste probleme.

Cele 1000 de cereri sunt exemple de rezultate și condiții de acceptare. Nu sunt un vocabular închis de comenzi. Funcționalitățile se înregistrează și se implementează prin capabilități reutilizabile, nu printr-un handler pentru fiecare propoziție.

## Domeniul și probele auditului

- Cod auditat în ramura codex/jev-modular-20261018, HEAD d907195c2b2995aafda4a807e455f02ae1043830, inclusiv diferența față de producție. Documentele ulterioare acestui audit nu sunt cod lansat.
- Producție recitită la 10:21 București: build-20261018-jarvis-171, commit 0182bc7eeed3dcb20f322584b6a966cde2b7c5e0, READY, trafic 100%, Jev off. Buildul 172 nu este versiunea activă. Auditul nu a efectuat rollout.
- Traseu verificat: workspace, planner, provider, catalog și scheme, policy, autonomy, budget, context, jobs, goal-coverage, rezultate și UI Text/Voice; masterplanul și rapoartele de validare existente.
- Incidentul Rosetti: citire a cererii exacte, telemetriei, proprietății și configurației conturilor. Fără mutații sau postări externe. Nu s-au afișat chei, telefoane sau identificatori de utilizatori.
- Nu s-au rulat 1000 de execuții live în acest audit. Testele existente cu provider simulat nu demonstrează generalizare semantică. Costul de mai jos este calculat de aplicație, nu verificat într-o factură a furnizorului.

## 1. P1 — Bugetul cumulat de tokenuri oprește cereri ieftine

Incidentul are 8 apeluri ale modelului, 63.489 tokenuri cumulate și cost înregistrat 0,001847685 USD. Ultimul apel are 8.860 tokenuri de intrare și 51 de ieșire. Nu avea un context de 63.489 tokenuri. Intrările repetate și cache-ul sunt incluse din nou în suma cumulată.

budget.ts impune 70.000 tokenuri cumulate, 0,12 USD, 12 pași, 24 apeluri de unelte, 120 secunde, răspuns rezervat de 2.200 tokenuri. Rezervarea următorului apel depășește plafonul cumulat, deși costul este mult sub plafon. requestReservation folosește octeți când nu există o estimare anterioară compatibilă, iar altfel consumul anterior cu marjă. Modificarea instrucțiunilor/schemelor poate reveni la estimarea conservatoare în octeți.

Corecție față de propunerea anterioară: nu este suficient să spunem „buget per solicitare”. Acesta există deja. Trebuie separate:

1. limita reală de context a unui apel, incluzând răspunsul/raționamentul;
2. costul cumulat al solicitării, cu cache și consumuri estimate marcate;
3. pragurile operaționale de timp și lipsă de progres;
4. consumul cumulativ de tokenuri ca telemetrie, fără a-l folosi drept substitut rigid al costului.

Nu recomand simpla creștere a plafonului 70.000 sau execuție infinită. Recomand numărare compatibilă cu modelul unde este disponibilă, rezervări explicite, instrumentarea motivului opririi și continuare din checkpoint pentru segmentarea tehnică. Plafonul monetar al solicitării nu se resetează la fiecare segment. Eliminarea plafonului de tokenuri cumulate trebuie însoțită de control real al costului și progresului.

Referințe: src/lib/ai-assistant/budget.ts; planner.ts; telemetry.ts; models.ts.

## 2. P1 — Formularea condiționează și execuția, nu doar rutarea

facebook-immediate.ts din producție acceptă două texte fixe. Handler-ele altor domenii conțin de asemenea recunoașteri lexicale. autonomy.ts validează acțiuni prin funcții de recunoaștere a cererii și prin lista CRM_VERBS. Un model poate interpreta corect o comandă și totuși executorul autonom să o oprească din cauza formulării.

Există și condiții globale, precum respingerea promptului care conține „verifică”, ce pot împiedica o cerere compusă legitimă: „Verifică disponibilitatea și programează vizionarea”. Constatat prin inspecția codului; nu reprezintă o nouă probă cu model live.

Corecție: interpretarea semantică produce un contract structurat al solicitării: obiective, acțiuni cerute, restricții, condiții, entități, referințe la mesajele relevante și eventuale clarificări. Serverul validează accesul, scopul concret, reviziile și precondițiile. Contractul nu este un permis generic și nu permite modelului să acorde drepturi. Se păstrează diferența dintre „publică”, „arată cum aș publica”, „nu publica” și „publică numai după...”.

Fast-path-urile pot rămâne optimizări pentru evenimente structurate sau cazuri neambigue. Nu trebuie să fie singura cale de autorizare pentru o capabilitate. Datele CRM și rezultatele uneltelor nu devin instrucțiuni ale agentului.

## 3. P1 — Continuarea solicitării nu este un mecanism general persistent

Unele continuări sunt reconstruite din ultimul card, prefixe de text și prompturi restaurate. Plannerul menține temporar în memorie apelurile, citirile, acțiunile și acoperirea obiectivului. La depășirea bugetului întoarce frecvent un rezultat parțial. Există infrastructură utilă de planuri, joburi, lease-uri și reconciliere, dar aceasta nu echivalează cu reluarea generală a planificării semantice din punctul exact al întreruperii.

Corecție: o solicitare persistentă, legată de conversație, cu contractul obiectivelor, selecții, dovezi, operații executate, pași rămași, revizii, cost cumulat și starea așteptării. Un răspuns precum „al doilea” trebuie legat de lista și solicitarea care l-au produs, inclusiv după alte discuții intercalate. Cererile independente nu trebuie să moștenească automat proprietatea sau contul ultimei operații.

Stările trebuie să distingă planificare, alegere necesară, execuție, așteptare furnizor, finalizare, anulare și blocaj real. Un job tehnic „completed” nu dovedește îndeplinirea cererii: incidentul Rosetti are job completed și telemetrie partial.

Referințe: workspace.ts; jobs.ts; facebook-immediate.ts; facebook-account.ts; goal-coverage.ts.

## 4. P1 — Contextul conversațional este limitat și trunchiat fără recuperare generală

sessionHistory citește 40 de mesaje pe pagină. contextMessages construiește aproximativ 14.000 de octeți de context recent și taie textul fiecărui mesaj la 2.200 de caractere; referințele din carduri sunt limitate suplimentar. Istoricul salvat rămâne, dar nu este integral disponibil modelului. În catalogul auditat nu există o unealtă generală de căutare/paginare a istoricului propriei conversații pentru planner.

Corecție: păstrarea mesajelor originale, context recent fără tăiere silențioasă a restricțiilor, selecția fragmentelor relevante cu identificarea sursei și unelte de recuperare a mesajelor originale. Starea solicitărilor active se păstrează separat de istoricul conversațional. Indexurile și sumarizările auxiliare nu înlocuiesc originalele și nu devin dovadă pentru o stare CRM actuală.

Conversația nu are un buget cumulativ care o epuizează. Fiecare apel are inevitabil o fereastră finită; aplicația trebuie să gestioneze acest lucru. Aceeași politică se aplică în Text și Voice.

## 5. P1 — ID-urile apar în mai multe straturi ale produsului

AssistantResultCard nu folosește label ca denumire principală, iar operationCards poate înlocui numele contului cu descrierea operației. Aceasta explică de ce conexiunile pot apărea toate sub aceeași etichetă generică. ActionPreview afișează explicit nume plus ID; MetaReviewDetails redă recursiv câmpuri interne. Unele butoane trimit un prompt care conține ID-ul, iar pagina de chat expune și JSON-ul acțiunii. Voice reutilizează aceste componente.

Corecție: un contract comun de prezentare: denumire, tip, descriere de diferențiere, acțiune de selecție și referință internă. Click-ul trimite o selecție structurată, legată de solicitare/listă/revizie, iar mesajul vizibil arată denumirea. Serverul revalidează selecția. Nu înlocuim ID-urile interne cu numele: numele se pot repeta sau modifica.

Selecția prin limbaj natural și voce poate folosi nume sau poziții. Pentru denumiri identice se adaugă informații utile autorizate, fără a cere copierea identificatorilor. Dacă numele lipsește, se folosește o descriere inteligibilă; modelul nu inventează nume. Se verifică și textul liber, previzualizările, erorile și confirmările, nu doar cardurile.

## 6. P2 — Granularitatea uneltelor și catalogul contribuie la consum

În Rosetti, cele opt apeluri au parcurs load_capabilities, discover_tools, read, discover_tools, două operation_contract și două existing_read. Nu exista o acțiune pregătită. Catalogul și instrucțiunile modulare sunt un progres, însă numeroase contracte sunt descoperite în apeluri separate și unele argumente sunt JSON încapsulat în șiruri. Strict=true al învelișului nu validează semantic acel JSON; validatorii serverului rămân obligatorii.

Corecție față de „unelte care finalizează operații”: unelte de domeniu cu parametri structurați și rezultate compacte, nu o singură unealtă gigantică „fă orice”. Se separă rezolvarea/verificarea de efectul extern. Fluxurile stabile reutilizează serviciile actuale și pot grupa citiri independente. Acțiunile compuse rămân compozabile: căutare, cumpărător, vizionare, comunicare. Nu se îngroapă deciziile ambigue într-un handler care alege arbitrar.

Catalogul autorizat rămâne distinct de uneltele expuse într-un apel. Selecția inițială este o sugestie, nu o limită a capabilităților. Politicile obligatorii ale operației nu trebuie să poată fi ocolite printr-o unealtă generică.

## 7. P2 — Interpretarea nu este demonstrată prin validitatea schemei

goalCoverage verifică citate existente, indici de pași și dovezi de citire. Codul precizează corect că nu demonstrează că modelul a identificat toate cerințele. Și contractul semantic nou va avea aceeași limitare: JSON valid nu înseamnă intenție corect înțeleasă.

Trebuie verificate omisiunile, negațiile, condițiile, schimbările de intenție și efectele necerute. Nu propun obligatoriu două sau trei modele pentru fiecare cerere: se reutilizează plannerul și se escaladează țintit doar când există o problemă de interpretare sau calitate. Erorile de infrastructură nu se repară cu un model mai scump.

## 8. P1 — Reluarea sigură și dovada finalizării trebuie păstrate

Există deja mecanisme valoroase: verificări de acces, revizii, chei de idempotency, rezervări tranzacționale, jurnale pentru rezultate incerte și reconciliere. Ele se reutilizează. Reluarea după timeout nu trebuie să retrimită automat un mesaj/postare a cărui rezultat este necunoscut.

La Facebook, job creat, postare trimisă și publicare confirmată sunt stări diferite; aprobarea administratorului grupului poate fi externă aplicației. Automatizarea locală existentă publică singură; runnerul manual desktop exclus de utilizator este alt mecanism. Device offline sau sesiune expirată sunt indisponibilități reale, nu lipsă de inteligență a modelului.

Pentru Rosetti, cele 13 conexiuni sunt local:connected; nici proprietatea, nici profilul nu au cont implicit. Nu au fost verificate live sesiunile browserului. Alegerea contului se face prin denumire; salvarea unui cont implicit nu se deduce automat din alegerea pentru o singură publicare. „Grupuri eligibile” trebuie definit explicit față de lista agenției, filtre și selecția agentului, fără destinații inventate.

## 9. P2 — Jev rămâne opțional; nu este remedierea principală

Jev este off în producție, iar incidentul nu este o eroare Jev. Adaptorul de selecție nu înlocuiește interpretarea obiectivului, rezolvarea entităților sau autorizarea. Se păstrează fallback-ul modular, extinderea capabilităților și pragurile măsurate pe română. Nu se activează Jev ca substitut pentru migrarea semantică și nu se promite economie fără benchmark comparabil.

## 10. P1 — Validarea trebuie să măsoare generalizarea și rezultatul

Raportul JEV_CORPUS_SELECTION și testul jev-corpus măsoară selecția euristică și dimensiunea contextului inițial. Nu certifică semantica, conversații lungi sau execuții complete. Inventarul local existent de 263 dovezi nu trebuie redenumit „263 scenarii perfecte”; 0 certificări E2E integrale rămâne limita raportată anterior.

Programul revizuit de evaluare:

- Pentru fiecare familie de capabilități: rezultat așteptat și restricții, independente de formularea exemplelor.
- Set separat de formulări nefolosite la implementare, scrise și de oameni; parafrazele generate de același model nu sunt suficiente.
- Cereri indirecte, greșeli, diacritice, transcrieri vocale, negații și condiții. Comenzi compuse și corecții în timpul execuției.
- Conversații cu cel puțin 100 de solicitări, depășirea pragului de 40 de mesaje, recuperarea referințelor vechi, două obiective intercalate și aceeași entitate cu nume schimbat.
- Date curente schimbate după selecție, cont revocat, rezultate externe incerte, timeout, reluare fără duplicate și anulare.
- Metrici separate: intenție, entități, condiții păstrate, finalizare, efecte necerute, întrebări inutile, duplicate, cost pe solicitare finalizată și latență p50/p95.
- Probe cu model real și transport extern simulat; ulterior acceptanță controlată cu furnizori reali, fără mesaje sau publicări de test neautorizate. În acest audit nu au fost efectuate apeluri AI cu plată.

## Ordinea de implementare revizuită

1. Păstrează punctele de revenire și fixează un set de incidente/reformulări ca evaluare de bază. Nu activa buildul îngust 172 ca soluție semantică.
2. Corectează bugetarea și telemetria: context per apel, cost per solicitare, cache, rezervări și motiv exact al opririi. Fără resetarea costului la reluare.
3. Introdu starea persistentă a solicitării și contractul selecțiilor prin denumiri. Leagă Text/Voice de aceeași stare și același executor.
4. Introdu contractul semantic și migrează împreună rutarea și gate-urile lexicale de execuție. Nu elimina validările serverului. Acoperă întâi proprietăți/contacte/vizionări și publicarea Facebook, apoi restul domeniilor pe același mecanism.
5. Reduce ciclurile de descoperire prin unelte de domeniu și reguli încărcate pe operație. Nu duplica schemele sau logica de business.
6. Adaugă recuperarea autorizată a istoricului original și referințe stabile la mesajele relevante. Nu înlocui conversația cu rezumate.
7. Validează generalizarea și execuția, costul și UI, inclusiv reluarea și anularea. Nu condiționa verdictul numai de testele exacte din corpus.
8. Activează gradual, pe domenii și feature flag, cu rollback de cod/configurație și compatibilitate cu solicitările deja în curs. În observare rulează doar interpretarea, fără dublarea efectelor externe.

Acceptanță minimă: niciun flux declarat migrat nu depinde de egalitatea cu o propoziție din corpus; interpretările valide au aceeași cale de execuție; agenții nu văd sau copiază ID-uri; cererile noi nu moștenesc un plafon consumat al conversației; limitele tehnice permit reluare fără pierdere de condiții/duplicate; rezultatul declarat coincide cu dovezile reale. Procentele de succes și costurile se raportează pe seturi și medii explicite, fără garanția imposibilă asupra tuturor formulărilor viitoare.

## Ce se păstrează și ce nu se declară finalizat

Se păstrează serviciile CRM, integrarea Facebook automată, descrierea și fotografiile originale, șabloanele WhatsApp, restricțiile de acces și regulile de produs cerute anterior, Europe/Bucharest, executorul, dovezile și mecanismele de deduplicare. Nu este necesară rescrierea individuală a celor 1000 de scenarii.

Acest document este rezultatul auditului. Codul nu a fost schimbat în această etapă și nu s-a publicat o versiune nouă. Proiectarea exactă a contractului semantic, migrarea tuturor gate-urilor, recuperarea istoricului și evaluarea cu modele reale rămân de implementat și verificat.

## Documentație oficială consultată

- Function calling și limitele strict mode: https://developers.openai.com/api/docs/guides/function-calling
- Conversation state și fereastra de context per apel: https://developers.openai.com/api/docs/guides/conversation-state
- Evaluări bazate pe date și rezultate așteptate: https://developers.openai.com/api/docs/guides/evals

Documentația susține mecanismele API; constatările despre Jarvis provin din codul și telemetria aplicației. Nu s-a presupus o migrare de model sau API.
