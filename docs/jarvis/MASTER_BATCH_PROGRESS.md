# Corpus Jarvis — implementare pe loturi

## Publicare în producție — 8 octombrie 2026

Toate modificările de aplicație până la commitul **033d7d05ab74b83266ded71c55430da37a1716cb** au fost publicate pe **https://imodeus.ro**, prin buildul **build-2026-10-08-001**, READY cu **100% trafic**. Acest release include cele 41 de commituri de după versiunea activă anterior, 323893ca. Mențiunile „nepublicat” din loturile de mai jos descriu situația istorică la implementarea lor; ele sunt acum incluse în acest release.

Regulile Firestore au fost publicate și comparate cu sursa validată. Au fost verificate cele 9 funcții necesare, 3 schedulere, 72 de indexuri și răspunsurile HTTP/autentificarea rutelor de intrare. Funcțiile, indexurile, configurația secretelor și installerul desktop nu aveau modificări față de producție și nu au necesitat republicare. Dovada verificării: [RELEASE_2026_10_08.json](RELEASE_2026_10_08.json).

Publicarea nu certifică cele 1.000 de scenarii: rămân 42 cu dovezi locale folosind model real. Nu au fost trimise mesaje de test către clienți; utilizarea WhatsApp real rămâne condiționată de aprobarea Meta și verificarea fluxului extern.

Ținta solicitată: fiecare dintre cele 1.000 de scenarii originale îndeplinit până la rezultatul cerut, fără oprire nejustificată după primul pas. Aprobările, clarificările necesare și accesul autorizat fac parte din scenariul complet; nu se elimină pentru a declara succes.

Inventarul reproductibil este [MASTER_BATCHES.json](evals/MASTER_BATCHES.json): 20 de loturi a câte 50 de ID-uri, textul original și hash per cerere. Se verifică prin `node scripts/jarvis-corpus-batches.mjs --check`. Inventarul nu este un raport de acceptanță; regenerarea lui nu certifică scenariile. Ordinea de lucru începe cu loturile 17 și 18 (801–900), apoi loturile de domeniu 1–16 și 19–20.

## Lot variante de ciornă pentru Facebook și Instagram — 17 octombrie 2026

Scenariile **0391** și **0392** pregătesc în conversație variante factuale pentru proprietatea selectată sau ultima ciornă. Datele sunt recitite din CRM; prețurile schimbate înlocuiesc valorile vechi. Varianta scurtă Facebook are un obiectiv editorial de maximum 500 de caractere și omite dotările opționale. Varianta Instagram are maximum 2.200 de caractere, conform limitei integrării existente, și poate include dotările declarate în CRM. Nu se presupune că limita editorială Facebook reprezintă limita platformei.

Se păstrează linii întregi, cu prioritate pentru informațiile de bază și preț înainte de localizare/dotări. Câmpurile eliminate sunt reflectate în metadatele ciornei, iar revizia este recalculată după textul rezultat. Nu se deduc facilități din descrieri private și nu se transformă închirierea în vânzare. Drepturile și starea proprietății folosesc verificările existente. Ciornele nu modifică descrierea CRM, nu creează postări sociale și nu înlocuiesc descrierea sau fotografiile folosite la publicarea în grupuri. Runnerul manual nu este modificat.

Validare: 92 teste unitare/regresie și 19 teste de integrare trecute, cu cererile originale, date actualizate, limite de lungime, date exagerat de lungi, replay și lipsa efectelor externe. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Dovadă: [Social lot 06](evals/SOCIAL_EXECUTION_BATCH_06.json). **203/1000 dovezi locale** (133 cu model real, 70 deterministe). Lot nepublicat; fără certificare integrală în producție.

## Lot comparația performanței sociale — 17 octombrie 2026

Scenariul **0389** citește indicatorii destinațiilor publicate prin serviciul social existent și îi prezintă pe postare și canal. Facebook folosește aprecieri, comentarii și distribuiri; Instagram folosește aprecieri și comentarii. Valorile lipsă, invalide sau negative rămân necunoscute; zero este păstrat ca valoare reală. Erorile unui cont nu elimină destinația din raport și nu sunt transformate în zero. Datele brute și tokenurile nu sunt expuse.

Raportul compară totaluri cumulative citite în momentul cererii, fără a pretinde un interval comun, conversii, impresii sau un clasament între platforme. Sunt verificate cele mai recente 20 de destinații din istoricul disponibil; dacă există mai multe, numărul total și limita sunt explicite, iar cardul este incomplet. Nu există încă paginare a acestei comparații. Profilul, agenția, postarea publicată, ID-ul extern și capabilitatea insights sunt recitite înaintea fiecărui apel. Accesul administrativ existent este păstrat.

Validare: 71 teste unitare/regresie și 27 teste de integrare trecute, inclusiv ambele canale, valori zero/lipsă, erori Meta și plafonul de 20 de apeluri. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Dovadă: [Social lot 05](evals/SOCIAL_EXECUTION_BATCH_05.json). **201/1000 dovezi locale** (133 cu model real, 68 deterministe). Meta este simulat; fără certificare în producție. Lot nepublicat.

## Păstrarea progresului la eroarea unei reluări — 16 octombrie 2026

Când prima pagină a unei reluări de comentarii eșuează, Jarvis păstrează reperul și oferă din nou „Continuă comentariile”. Același cursor este folosit la noua solicitare; primele 10 pagini nu sunt recitite. Răspunsul eșuat rămâne explicit incomplet, fără comentarii inventate și fără detaliile brute ale furnizorului. Repetarea aceluiași requestId returnează răspunsul persistent; o nouă solicitare explicită reîncearcă pagina. Verificările de acces și de identitate a postării rămân înaintea apelului Meta și nu sunt transformate în reluări permise.

Validare: 69 teste unitare/regresie și 24 teste de integrare trecute. Cele două cazuri noi verifică eroare HTTP și răspuns invalid pe pagina 11, păstrarea reperului, replay fără apel nou și recuperarea paginii 11 la următoarea solicitare. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Corecție a scenariului existent: **200/1000 dovezi locale**, fără scenarii noi contabilizate. Meta simulat; lot nepublicat.

## Reluarea comentariilor după limita de pagini — 16 octombrie 2026

După un segment incomplet cu un cursor valid, Jarvis oferă „Continuă comentariile”. Reluarea folosește un reper privat din assistantResultSets, colecția existentă gestionată exclusiv pe server. Reperul este legat de utilizator, agenție, postare, cont și ID-ul extern verificat; expiră după o oră. Conversația conține doar ID-ul reperului și instrucțiunea de continuare, fără cursorul Meta. Cursorii deja văzuți sunt păstrați ca hashuri, pentru detectarea buclelor între segmente. Limita de protecție a istoricului este de 1.000 de cursori.

La „Continuă comentariile”, se citește următorul segment de maximum 10 pagini. Segmentul anterior rămâne în conversație; noul răspuns nu pretinde că reprezintă istoricul agregat. Un reper expirat, al altui utilizator sau al unei postări cu ID extern schimbat este respins înaintea apelului Meta. Fără reper în ultimul răspuns nu se inventează o selecție. Replay-ul aceleiași cereri reutilizează răspunsul persistent. Reperele expirate sunt refuzate la citire; acest lot nu configurează curățarea lor automată.

Validare: 69 teste unitare/regresie și 22 teste de integrare, inclusiv reluare exact de la pagina 11 și lipsa apelurilor duplicate. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Extensie a scenariului existent, fără ID-uri noi contabilizate: **200/1000 dovezi locale**. Meta este simulat în teste. Lot nepublicat.

## Continuarea citirii comentariilor între pagini — 16 octombrie 2026

Fluxul scenariului **0379** nu se mai oprește automat după prima pagină. Folosește cursorul after din răspunsul Meta, validat și codificat ca parametru pe ruta fixă a postării. URL-ul next nu este urmat și nu este expus în conversație. Comentariile duplicate sunt eliminate după ID, iar rezultatul agregat este ordonat după data disponibilă, cu afișare în Europe/Bucharest.

Înainte de fiecare pagină se recitesc profilul, agenția, postarea, conexiunea și permisiunea de comentarii. Schimbarea ID-ului extern al postării împiedică amestecarea a două fire de comentarii. Revocarea accesului oprește cererea. La eșecul unei pagini ulterioare se păstrează rezultatele deja citite și se anunță explicit lista incompletă. Cursorul lipsă/invalid sau repetat și limita de 10 pagini opresc continuarea fără a declara istoricul complet. Limita este pe cerere; nu există încă reluare de la pagina 11.

Validare: 69 teste unitare/regresie, 17 teste de integrare, ESLint, paritate și build complet (inclusiv TypeScript) trecute. Extensie a unui scenariu existent, fără creșterea numărului contabilizat: **200/1000 dovezi locale**. Fără apeluri Meta reale sau publicare în producție. Runnerul manual și conținutul publicărilor în grupuri nu sunt modificate.

## Lot diagnostic social — 16 octombrie 2026

Scenariul **0384** păstrează selecția explicită a postării și contului și folosește serviciul existent pentru cele patru verificări Meta: identitatea autorizării, validitatea tokenului și permisiunile, lista postărilor contului și accesul direct la postare. Continuarea distinge diagnosticul de citirea comentariilor. Profilul, agenția și selecția eligibilă sunt recitite înaintea serviciului; permisiunile administrative și condițiile serviciului existent rămân aplicabile.

Raportul prezintă separat dovezile confirmate, neconfirmate și necunoscute, fără tokenuri, URL-uri de autorizare sau erori brute. Absența din primele 100 de postări nu dovedește ștergerea. O verificare Meta eșuată nu devine acces confirmat. Diagnosticul nu testează comentariile și nu reconectează contul. A fost corectată și concluzia serviciului existent, care afirma nejustificat că citirea comentariilor este refuzată atunci când postarea era accesibilă direct.

Validare: 69 teste unitare/regresie și 10 teste de integrare, inclusiv ambele canale, replay fără apeluri duplicate și probe Meta eșuate. Serviciul și citirea tokenului sintetic sunt reale în emulator; transportul Meta este simulat. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Dovadă: [Social lot 04](evals/SOCIAL_EXECUTION_BATCH_04.json). **200/1000 dovezi locale** (133 cu model real, 67 deterministe). Fără certificare live în producție. Lot nepublicat.

## Lot citirea comentariilor sociale — 16 octombrie 2026

Scenariul **0379** prezintă perechile postare/cont eligibile și continuă la selecția explicită „Postare socială: ID; Cont social: ID”. Recitește profilul, agenția, postarea publicată și capabilitatea de comentarii înainte de a folosi serviciul social existent. Conturile deconectate, selecțiile neofertate și postările șterse nu produc cereri către Meta. Permisiunea administrativă existentă se păstrează.

Facebook și Instagram folosesc câmpurile specifice fiecărui canal. Rezultatul proiectează numai ID-ul, autorul, textul și data comentariului, afișată în Europe/Bucharest. Câmpurile brute și URL-ul de paginare al furnizorului nu sunt expuse. Comentariile sunt ordonate după data disponibilă în segmentul primit; când Meta indică pagini suplimentare, rezultatul este marcat incomplet. Integrarea existentă citește maximum 50 de comentarii; nu se pretinde acoperirea întregului istoric sau continuarea paginării. Un răspuns invalid ori un eșec Meta nu devine o listă goală prezentată drept succes. Replay-ul cererii nu repetă apelul furnizorului.

Validare: 76 teste unitare/regresie și 7 teste de integrare, cu conversație persistentă, serviciul real, token sintetic criptat în emulator și numai transport HTTP simulat. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Dovadă: [Social lot 03](evals/SOCIAL_EXECUTION_BATCH_03.json). **199/1000 dovezi locale** (133 cu model real, 66 deterministe). Fără comentarii, aprecieri sau publicări trimise; fără certificare în producție. Lot nepublicat.

## Lot căutare în istoricul social — 16 octombrie 2026

Scenariul **0388** caută postările proprietății după titlul salvat la creare sau după titlul, zona și adresa actuală din CRM. Sunt acceptate diacriticele românești moderne și cu sedilă, majusculele și ghilimelele. Cuvintele sunt comparate integral, pentru a nu confunda Titan cu Titanic ori numărul 12 cu 123. Cererile de forma „Găsește/Arată-mi postările proprietății din/numite ...” folosesc același flux.

Căutarea citește întregul istoric social, fără limita de 50 a dashboardului, și păstrează legătura prin propertyId când proprietatea a fost redenumită. În lipsa fișei CRM, poate găsi titlul istoric, precizând sursa potrivirii. Fișele marcate șterse sau aparținând altei agenții și postările șterse logic sunt excluse. Accesul administrativ este revalidat în tranzacție. Rezultatul nu expune textul postării, datele proprietarului sau erorile brute și nu produce efecte externe. Citirea integrală are cost proporțional cu istoricul și numărul proprietăților; nu este un index de căutare scalabil.

Validare: 73 teste unitare/regresie și 7 teste de integrare, inclusiv postare veche precedată de 55 de postări recente, redenumire, diacritice, acces revocat, rezultat gol și replay fără modificări. ESLint, paritate și build complet (inclusiv TypeScript) trecute. Dovadă: [Social lot 02](evals/SOCIAL_EXECUTION_BATCH_02.json). **198/1000 dovezi locale** (133 cu model real, 65 deterministe). Nu certifică publicarea live în Meta sau întregul corpus în producție. Lot nepublicat.

## Lot dashboard social și conexiuni cu probleme — 16 octombrie 2026

Scenariile **0385** și **0387** citesc configurația persistentă a paginilor Facebook și conturilor Instagram. Jarvis arată starea conexiunii și disponibilitatea publicării, comentariilor și statisticilor; capabilitățile lipsă rămân neconfirmate. Raportul nu pretinde verificarea live a tokenurilor Meta sau a publicării.

Administratorul primește și istoricul din ultimele 50 de înregistrări de postări, cu starea fiecărei destinații. Agenții păstrează accesul existent la conexiuni, fără extinderea accesului la istoricul administrativ. Profilul și agenția sunt recitite în tranzacție; înregistrările șterse sau ale altei agenții sunt excluse. Răspunsurile omit tokenurile, textele postărilor și erorile brute de la furnizor. Nu se modifică datele și nu se fac apeluri externe.

Validare: 113 teste unitare/regresie, 4 teste de integrare, ESLint, paritate și build complet (inclusiv TypeScript) trecute. Dovadă: [Social lot 01](evals/SOCIAL_EXECUTION_BATCH_01.json). **197/1000 dovezi locale** (133 cu model real, 64 deterministe), fără certificare integrală în producție. Descrierea și fotografiile pentru grupurile Facebook rămân cele din CRM; runnerul manual nu este modificat. Lot nepublicat.

## Confirmări stricte pentru controlul joburilor Facebook — 16 octombrie 2026

Executorul confirmă acum reprogramarea numai dacă rezultatul handlerului corespunde jobului, agentului, agenției, contului, orei și setului exact de grupuri cerute. Grupurile duplicate, lipsă, străine sau care nu mai sunt queued invalidează confirmarea. Datele echivalente cu offset diferit sunt comparate ca momente absolute. Anularea verifică identitatea și starea cancelled.

Handlerul de reprogramare și pregătirea loturilor refuză joburile cu dispatchState pending sau unknown, înainte de un nou apel la runner. Anularea rămâne disponibilă; rezultatul său trebuie confirmat de handler. Aceste verificări nu anulează efecte externe deja produse și nu declanșează retransmitere automată.

Validare: 188 teste unitare/regresie, 42 teste de integrare, ESLint, paritate și build complet trecute. Sunt verificate și controalele existente, mutarea în lot și anularea unui job cu expediere neconfirmată. Corecții pentru fluxuri existente, fără scenarii noi contabilizate: **195/1000 dovezi locale**. Fără publicări externe; runnerul manual nu este extins. Lot nepublicat.

## Lot reprogramare Facebook în selecție multiplă — 16 octombrie 2026

Scenariul **0397** cere selecția explicită „Joburi Facebook: ID1, ID2”, apoi mută fiecare programare cu 60 de minute după momentul salvat. Sunt păstrate contul, grupurile și proprietatea; confirmările folosesc Europe/Bucharest. Operația reprezintă 60 de minute efective, inclusiv peste miezul nopții sau schimbarea orei. Nu interpretează automat întreaga listă afișată drept selecție.

Înaintea execuției verifică toate ID-urile selectate, oferta anterioară, apartenența, starea joburilor, revizia și datele. Selecția invalidă, un job preluat de runner sau terminat împiedică pregătirea lotului. Duplicatele sunt eliminate; selecțiile peste limita de 100 sunt refuzate. Fiecare mutare trece secvențial prin executor și handlerul PATCH existent, care revalidează datele la commit. Nu există tranzacție atomică peste mai multe apeluri externe: la eroare, modificările deja confirmate rămân salvate, următorii pași sunt opriți și rezultatul este parțial. Replay-ul aceleiași cereri nu repetă mutările.

Validare: 145 teste unitare/regresie, 40 teste de integrare, TypeScript, ESLint, paritate și build complet trecute. Sunt verificate două joburi mutate pe local/cloud simulat, joburi neselectate sau terminate nemodificate, selecții devenite invalide și eșecul cloud la al doilea pas fără repetarea primului ori executarea celui de-al treilea.

Dovadă: [Facebook lot 10](evals/FACEBOOK_EXECUTION_BATCH_10.json). **195/1000 dovezi locale** (133 cu model real, 62 deterministe). Fără publicări externe și fără certificarea corpusului integral în producție. Runnerul manual nu este extins; lot nepublicat.

## Lot verificarea orei persistate Facebook — 16 octombrie 2026

Scenariul **0395** recitește jobul din baza de date și compară ora cu ultima confirmare reușită a executorului pentru același job, păstrată în conversație. După creare sau reprogramare identifică jobul din rezultatul execuției chiar dacă există alte joburi. Comparația se face între momentele absolute, iar afișarea folosește exclusiv Europe/Bucharest, inclusiv ora de vară/iarnă.

O oră schimbată ulterior este raportată diferită. Lipsa unei confirmări anterioare produce explicit lipsa comparației, fără a presupune ora cerută. Un job anulat, terminat, eșuat sau cu expediere neconfirmată nu este declarat programare activă, chiar dacă ora coincide. Pentru mai multe joburi, alegerea „Job Facebook: ID” continuă verificarea orei. Nu se fac modificări sau retrimiteri.

Validare: 145 teste unitare/regresie, 52 teste de integrare, ESLint, paritate și build complet trecute. Dovadă: [Facebook lot 09](evals/FACEBOOK_EXECUTION_BATCH_09.json). **194/1000 dovezi locale** (133 cu model real, 61 deterministe). Verificarea vizează starea salvată în aplicație, nu confirmarea publicării în Facebook. Runnerul manual nu este modificat; lot nepublicat.

## Lot alegerea contului Facebook pe proprietate — 16 octombrie 2026

Scenariul **0353** listează conturile proprii disponibile și continuă la „Cont Facebook: ID”. Nu deduce care cont este corect și nu schimbă tacit contul. După alegerea explicită, folosește update_property prin executorul CRM, fără aprobare suplimentară, cu revizia proprietății și istoricul modificării. Replay-ul nu dublează salvarea; selectarea altor proprietăți sau a unui cont neofertat nu produce modificări.

Conturile sunt recitite la selecție, iar executorul verifică în tranzacția de salvare agenția, proprietarul, ștergerea, starea conectată și, pentru automatizarea locală, dispozitivul nerevocat. Un cont care devine indisponibil între planificare și execuție este refuzat. Setarea contului nu creează joburi și nu publică nimic. Descrierea și pozele CRM rămân neschimbate; runnerul manual nu este extins.

Validare: 30 teste de integrare, 119 teste unitare/regresie, ESLint, TypeScript, paritate și build complet trecute. Dovadă: [Facebook lot 08](evals/FACEBOOK_EXECUTION_BATCH_08.json). **193/1000 dovezi locale** (133 cu model real, 60 deterministe). Fără publicări externe și fără certificarea corpusului integral în producție. Lot nepublicat.

## Validarea disponibilității proprietății la publicarea automată — 16 octombrie 2026

Crearea și reprogramarea joburilor automate verifică acum și disponibilitatea proprietății: documentele șterse logic, cu agencyId incompatibil, inactive, vândute sau închiriate sunt refuzate. Verificarea este în handlerul comun folosit de aplicație și Jarvis, nu doar în planificator. La creare se execută în tranzacția de rezervare, înainte de salvarea jobului și înainte de apelul cloud. La reprogramare se execută înainte de apelul cloud și din nou în tranzacția de commit.

Dacă proprietatea se schimbă în timpul apelului cloud, aplicația refuză confirmarea locală și nu repetă apelul. Această verificare nu poate retrage un efect extern deja produs; este necesară verificarea runnerului pentru reconciliere. Anularea rămâne disponibilă pentru a opri un job chiar dacă proprietatea a devenit indisponibilă.

Descrierea și pozele CRM nu sunt modificate; runnerul manual nu este extins. Validare: 71 teste de integrare, 68 teste unitare/regresie, ESLint, paritate și build complet trecute. Acesta este un lot de corecții pentru fluxurile existente, fără scenarii noi contabilizate: **192/1000 dovezi locale**. Lot nepublicat și fără publicări externe de test.

## Lot creare imediată Facebook și continuarea selecției — 16 octombrie 2026

Comenzile originale **0358 și 0362** pornesc crearea unui job automat pentru proprietatea deschisă. Dacă destinațiile nu sunt selectate, Jarvis prezintă grupurile eligibile și continuă la „Grupuri Facebook: ID1, ID2”. Comanda inițială autorizează crearea; nu este cerută o aprobare suplimentară. Nu sunt selectate tacit toate grupurile. Selecția este legată de proprietatea inițială și de ultimul mesaj de clarificare; grupurile sunt recitite și validate înainte de execuție.

Jobul este creat prin executor și handlerul existent, cu scheduledAt null. Descrierea și pozele rămân cele din CRM, fără draft generat sau modificare a proprietății. Runnerul manual nu este extins. Replay-ul nu dublează expedierea; schimbarea proprietății, grupurile neofertate sau eliminate și contul revocat nu creează joburi. Confirmarea separă jobul creat de publicarea efectivă; nu mai afirmă lipsa publicărilor externe după pornirea automatizării.

Validare: 136 teste unitare și de regresie, 28 teste de integrare, ESLint, paritate și build final complet trecute. Dovadă: [Facebook lot 07](evals/FACEBOOK_EXECUTION_BATCH_07.json). **0362** are dovadă locală de creare a jobului, iar **0358 rămâne incomplet** pentru publicarea efectivă, deoarece transportul cloud este simulat. Total: **192/1000 dovezi locale** (133 cu model real, 59 deterministe), fără certificare integrală în producție. Lot nepublicat.

## Lot rapoarte Facebook zilnice și intervenții — 16 octombrie 2026

Scenariile **0399 și 0400** citesc prin chat joburile proprii ale automatizării Facebook. Rezumatul zilei folosește datele de execuție (pornire, terminare, trimitere sau eroare), convertite în Europe/Bucharest; o simplă editare sau programare nu este prezentată ca publicare. Trimiterile cu aprobare în așteptare sunt numărate ca trimiteri, fără confirmare de publicare. Cardurile prezintă starea curentă; lipsa datelor de execuție nu permite atribuirea unei zile și nu se pretinde existența unui jurnal istoric complet.

Raportul de intervenții include erori, reconectări, expediere neconfirmată și grupuri cu rezultat incert sau necunoscut, inclusiv la joburi marcate completed. Joburile sănătoase și simpla așteptare a aprobării nu sunt declarate erori. Sunt excluse joburile altor agenți, ale altor agenții și cele șterse. Fiecare citire verifică apartenența și rolul curent; raportarea nu modifică și nu retrimite joburi.

Conform clarificării utilizatorului, runnerul manual desktop (agentul apasă Publică) este exclus din implementările viitoare. Nu a fost dezactivat în acest lot și nu a fost extins. Automatizarea continuă să folosească descrierea și pozele CRM.

Validare: 148 teste unitare și de regresie, 12 teste de integrare, ESLint, paritate și build complet trecute. Comenzile originale au fost executate prin chat persistent, cu replay, comparația stării nemodificate a joburilor, acces revocat, rezultate goale și limita de zi București la schimbarea orei. Dovadă: [Facebook lot 06](evals/FACEBOOK_EXECUTION_BATCH_06.json). **191/1000 dovezi locale** (133 cu model real, 58 deterministe). Rapoarte din starea salvată; fără interogare live Facebook, fără publicări externe și fără certificare integrală în producție. Lot nepublicat.

## Regula publicării în grupurile Facebook — 16 octombrie 2026

Clarificare explicită a utilizatorului: Jarvis folosește aceeași automatizare ca agentul, cu pozele și descrierea proprietății din CRM. Nu reformulează și nu înlocuiește descrierea cu draftul din conversație. Redactarea solicitată separat rămâne în conversație și nu modifică automat conținutul publicării în grupuri.

Încercarea nefinalizată de a transfera draftul în job a fost eliminată înainte de commit. Schema strictă de creare nu acceptă suprascrierea descrierii, pozelor sau un postDraft. Verificările traversează chatul după redactarea unui draft, crearea jobului, apoi payloadul cloud simulat sau claim-ul runnerului local; compară exact descrierea, inclusiv diacriticele și paragrafele, și ordinea pozelor CRM. Nu sunt trimise postări externe și nu se adaugă scenarii noi la numărul de dovezi din corpus.

## Lot texte Facebook din datele proprietății — 16 octombrie 2026

Scenariile **0372–0375** pregătesc și reformulează textul în conversație din câmpurile publice actuale ale proprietății selectate. Fiecare cerere recitește CRM-ul: modificarea prețului sau eliminarea dotărilor ajunge în noul draft, inclusiv când stilul comercial se păstrează. Nu sunt inventate facilități din descriere, apropierea de metrou, randament, comision sau disponibilitate. Datele proprietarului și notele interne nu intră în text. Moneda costurilor de publicitate nu schimbă moneda prețului proprietății.

Selecția explicită din pagina curentă are prioritate; conversația poate continua ultimul draft după părăsirea paginii. Lipsa selecției, datele insuficiente, tipul incompatibil cu vânzarea și proprietățile închise cer clarificarea relevantă. Un anunț rezervat păstrează acest statut în text. Apartenența și accesul la proprietate sunt recitite tranzacțional. Rezultatul este salvat în mesaj și card cu revizia datelor folosite; aceeași cerere nu dublează mesajul. Acest flux pregătește textul, fără publicare externă.

Validare: **257 teste unitare și de regresie, 17 teste de integrare** prin emulator, inclusiv cele patru comenzi originale prin chat persistent, actualizări CRM, acces revocat, date private, schimbarea selecției, corectarea dotărilor inventate anterior și replay. TypeScript, ESLint, paritatea operațiilor și buildul complet trecute. Comenzile originale au rutare deterministă; variantele libere de exprimare și publicarea externă nu sunt certificate prin acest lot.

Dovadă: [Facebook lot 05](evals/FACEBOOK_EXECUTION_BATCH_05.json). **189/1000 dovezi locale** (133 cu model real, 56 deterministe). Nu reprezintă certificarea celor 1000 de scenarii în producție. Lot nepublicat.

## Lot creare și programare Facebook — 16 octombrie 2026

Scenariile **0357 și 0360**: comanda de programare pentru mâine la 07:00 găsește proprietatea în CRM după titlu/localizare/adresă cu normalizare românească, păstrează tipul apartament cerut, folosește contul configurat pe proprietate sau contul implicit al profilului și selectează grupurile eligibile pentru tranzacție. Jarvis creează jobul prin executor și handlerul POST, apoi confirmă data București din rezultatul salvat. Selecțiile multiple continuă cu „Proprietate: ID”, fără aprobare suplimentară; data calculată inițial rămâne în context. Un cont inaccesibil sau de reconectat nu este înlocuit tacit. Comanda de verificare a reconectării nu programează nimic.

Crearea a fost mutată într-un serviciu tranzacțional comun cu interfața aplicației. Apartenența, contul propriu activ, dispozitivul local, proprietatea, grupurile și duplicatul sunt verificate înainte de rezervare. requestId UUID produce un ID stabil de job și un hash al cererii; replay identic reutilizează jobul, payload diferit este refuzat. Executorul generează requestId, nu modelul. Cererile simultane pentru aceeași publicare nu creează joburi suplimentare. Reluarea unei tranzacții Firestore închise este limitată la trei încercări de rezervare, fără apel extern în tranzacție.

Cloud POST este separat de rezervare și executat o singură dată. Răspunsul este verificat pentru identitate, grupuri și programare, apoi sunt salvate numai câmpurile necesare. Pending, timeout și răspuns incompatibil păstrează protecția contra duplicării; nu sunt confirmate drept programări finalizate de runner. Joburile eșuate sau care cer reconectare nu sunt relansate printr-un nou create. Programarea confirmată nu înseamnă publicare Facebook confirmată. Rezolvarea unui rezultat cloud necunoscut necesită verificarea runnerului, nu retransmiterea automată.

Validare: **233 teste unitare și de regresie, 20 teste de integrare**, inclusiv chat original 0357 pe local/cloud simulat, guard 0360 și refuz efectiv în POST, selecție cu ID sensibil la majuscule, localizare românească, cereri simultane, replay, payload modificat, acces revocat, grup neeligibil și expediere cloud încă în curs/neconfirmată. Prima probă concurentă a expus INVALID_ARGUMENT / transaction closed în emulator; rezervarea are acum retry limitat numai pentru acel caz, verificat separat, iar suita finală trece. ESLint, TypeScript, paritatea operațiilor și buildul final complet trecute.

Dovadă: [Facebook lot 04](evals/FACEBOOK_EXECUTION_BATCH_04.json). **185/1000 dovezi locale** (133 cu model real, 52 deterministe). Nu au fost trimise postări externe și nu este certificată publicarea reală sau execuția integrală în producție. Lot nepublicat.

## Lot control joburi Facebook — 16 octombrie 2026

Scenariile **0365 și 0366** sunt executate prin chat, autorizare implicită, executor și handler-ele reale PATCH/DELETE. Reprogramarea schimbă ora în aceeași zi calendaristică București și păstrează contul/grupurile. Anularea oprește jobul în aplicație, fără să pretindă retragerea postărilor deja trimise sau lipsa unui efect extern al pasului deja pornit. Pentru selecție multiplă, comanda rămâne în contextul conversației și continuă la „Job Facebook: ID”, fără altă aprobare. Repetarea aceluiași requestId nu repetă operația externă.

Handler-ele comune aplicației și Jarvis verifică proprietarul/agenția, starea jobului și revizia cerută. Commitul tranzacțional verifică din nou documentul, profilul, conexiunea, laptopul local, proprietatea și eligibilitatea grupurilor. Un job început nu este resetat; unul completed nu este rescris cancelled. Anularea locală păstrează dovezile grupurilor deja trimise și revocă lease-ul. O anulare locală simultană cu o reprogramare permite un singur commit. Pentru cloud, răspunsul trebuie să corespundă identității, orei, grupurilor și stării cerute; câmpurile de proprietar, proprietate și lease nu sunt copiate din răspuns. Conflictul după apelul cloud este raportat neconfirmat, fără reluare automată. Conturile șterse sunt refuzate înaintea apelului cloud.

Validare: **223 teste unitare/planner/autonomie/paritate/confirmări și 27 teste de integrare**. Fiecare comandă originală este verificată prin chat atât pentru coada locală, cât și pentru un transport cloud simulat. Sunt acoperite continuarea selecției, replay, acces revocat, cont șters, dispozitiv revocat, revendicare concurentă de către runner, modificări simultane, timeout, răspunsuri cloud incompatibile și schimbarea grupurilor. Testul concurent a necesitat contextul intern de autentificare pentru a evita pierderea mock-ului la importuri dinamice simultane; verificarea finală a trecut. ESLint, TypeScript, paritatea operațiilor și buildul final complet trecute.

Dovadă: [Facebook lot 03](evals/FACEBOOK_EXECUTION_BATCH_03.json). **183/1000 dovezi locale** (133 cu model real, 50 deterministe). Nu s-au făcut apeluri externe către Facebook și nu este certificată executarea corpusului integral în producție. Lot nepublicat.

## Lot monitorizare Facebook — 16 octombrie 2026

Șase scenarii: **0359, 0363, 0364, 0369, 0370, 0371**. Jarvis citește joburile proprii salvate, grupurile jobului, progresul, erorile și programările pentru mâine în Europe/Bucharest. Sunt verificate agenția și rolul actual; datele altor utilizatori și câmpurile sensibile ale runnerului sunt excluse. Dacă există mai multe joburi, utilizatorul poate continua cu „Job Facebook: ID”; selecția este verificată din nou pe server. Datele sunt recitite la fiecare comandă.

Statusul completed al jobului și statusurile submitted/pending_approval ale grupurilor nu sunt prezentate drept dovadă a publicării. Răspunsul precizează că este starea salvată în aplicație, fără interogare live Facebook. Calculul zilei de mâine folosește data calendaristică București și este verificat la schimbările DST și de an. Joburile anulate/finalizate nu apar ca programări active pentru mâine.

Validare: **98 teste unitare/planner/outcome, 8 teste de integrare incluzând 6/6 scenarii originale prin chat**, selecție explicită, schimbarea proprietarului, rol revocat și rezultate actualizate. TypeScript, ESLint, paritatea operațiilor și buildul complet au trecut. Verificarea TypeScript a identificat și corectat în testele WhatsApp existente folosirea unui ID opțional fără verificare: acum lipsa ID-ului produce explicit eșecul fixture-ului. Regresia WhatsApp finală: 144 teste trecute, 33 excluse prin configurația suitei. Prima rulare a avut 143 trecute și o eroare INVALID_ARGUMENT / transaction closed în emulator la reconcilierea concurentă; repetarea completă a trecut.

Dovadă: [Facebook lot 02](evals/FACEBOOK_EXECUTION_BATCH_02.json). **181/1000 dovezi locale** (133 cu model real, 48 deterministe). Testele folosesc Firestore local și stări sintetice ale runnerului; nu certifică publicarea reală pe Facebook și nici întregul corpus în producție. Lot nepublicat.

## Lot configurare Facebook — 16 octombrie 2026

Șase scenarii executate împreună: **0351, 0352, 0354, 0355, 0356, 0361**. Jarvis citește conturile proprii marcate conectate, setarea Facebook a proprietății, grupurile agenției, grupurile pentru vânzare/închiriere și conexiunile blocate. Citirile verifică apartenența și rolul într-o tranzacție; conturile altor utilizatori, șterse sau cu agenție necorespunzătoare sunt excluse. Câmpurile returnate sunt selectate explicit, fără tokenuri, date de sesiune, URL-ul curent al browserului sau erori brute.

Pentru proprietate, setarea explicită este distinsă de contul implicit al profilului. Un cont configurat dar inaccesibil nu este înlocuit tacit. Contextul paginii curente prevalează; lipsa proprietății sau o selecție multiplă cere alegerea proprietății. Configurația grupurilor folosește regulile domeniului sale/rent/both. Când agenția nu are grupuri, lista implicită a aplicației este etichetată ca atare. Linkurile invalide sunt excluse, iar URL-urile identice sunt deduplicate.

Diagnosticul identifică conexiunile care necesită reconectare, sunt deconectate, în curs, cu eroare sau cu stare necunoscută. Pentru conturile locale verifică și existența, proprietarul și revocarea laptopului asociat. Un laptop doar offline este raportat separat, fără a fi confundat cu o înregistrare revocată. Sunt stări/configurații salvate, nu probe în timp real ale sesiunii Facebook sau permisiunilor de publicare în fiecare grup.

Validare: **104 teste unitare/planner/outcome, 19 teste de integrare, incluzând 6/6 scenarii originale prin chat**, repetare cu rezultate actuale, acces revocat, selecții lipsă/inaccesibile și patru variante de dispozitiv local. ESLint, paritatea operațiilor și buildul final complet trecute. Dovadă: [Facebook lot 01](evals/FACEBOOK_EXECUTION_BATCH_01.json). **175/1000 dovezi locale** (133 cu model real, 42 deterministe). Fără cereri externe, joburi noi sau postări de test; fără certificare integrală în producție. Lot nepublicat.

## Lot reluări safe-to-retry — 16 octombrie 2026

Scenariul **0347** selectează mesajele eșuate înainte de apelul de trimitere, pe baza unei dovezi server-side și a identității unice a eșecului. Comanda explicită autorizează reluarea fără aprobare suplimentară. Unknown, mesaje ajunse la furnizor și eșecuri istorice fără dovadă sunt excluse. Agenții operează numai conversațiile proprii și neatribuite.

Reluarea reutilizează același mesaj și job, fără să schimbe cererea originală. În tranzacție sunt reverificate apartenența și rolul, atribuirea, destinatarul, conținutul, consimțământul, fereastra canalului, răspunsurile noi, matchingul și vizionarea asociată. Costul nu poate crește față de estimarea precedentă. Rezervarea veche este decontată, iar cea nouă este creată o singură dată. Istoricul reluării este păstrat per eșec; repetarea aceleiași acțiuni sau două cereri concurente nu produc alt mesaj. Workerul folosește datele recitite în tranzacția de preluare.

Un mesaj devenit neeligibil este raportat individual; celelalte mesaje eligibile din lot continuă. Rezultatul confirmă repunerea în coadă, nu livrarea. O nouă eroare înainte de trimitere primește alt identificator și necesită o nouă solicitare pentru reluare. Nu sunt reactivate acorduri retrase și nu sunt ignorate modificările proprietății.

Validare: **139 teste unitare, 144 teste coadă/worker/reguli și 2/2 scenarii prin chat (0347 și regresia 0348)**, ESLint, paritatea operațiilor și build final complet. Corectată izolarea unui tarif sintetic rămas dintr-un test anterior; regresia finală a trecut. Dovadă: [lot 38](evals/PROSPECTING_EXECUTION_BATCH_38.json). **169/1000 dovezi locale** (133 cu model real, 36 deterministe).

Limite: un lot respectă limita generală de 100 de acțiuni; restul este raportat separat. Căutarea inițială citește istoricul joburilor agenției, fără certificare de performanță pentru istorice foarte mari. Nu se reiau automat eșecuri ulterioare apelului către furnizor, chiar dacă un răspuns de respingere ar permite o analiză suplimentară. Meta simulat, fără mesaje externe sau certificare integrală în producție. Lot nepublicat.

## Lot reconciliere rezultate necunoscute — 16 octombrie 2026

Scenariul **0348** execută reconcilierea mesajelor cu rezultat necunoscut din conversațiile accesibile agentului, fără plan suplimentar de aprobare. Executorul recitește apartenența, rolul, atribuirea, jobul și mesajul în aceeași tranzacție. Identificatorul furnizorului, confirmarea salvată și/sau ecoul nativ trebuie să corespundă conexiunii și conversației; mesajele altui agent sau altei agenții nu sunt procesate.

Workerul salvează separat identificatorul și momentul acceptării înaintea tranzacției complexe de confirmare. Reconcilierea poate astfel recupera acceptarea după o întrerupere a salvării, poate aplica o confirmare de livrare/citire/eșec și poate uni ecoul nativ cu mesajul inițial. Costul se decontează idempotent, numai pe dovezi de livrare/eșec; acceptarea nu înseamnă livrare. Nu se apelează furnizorul pentru o nouă expediere.

Rezultatele fără dovezi corelate rămân explicit necunoscute. Acest lot nu implementează retrimiterea safe-to-retry (0347) și nu pretinde că orice rezultat extern necunoscut poate fi rezolvat fără o confirmare. Loturile au maximum 100 de mesaje per acțiune și limita generală de acțiuni; mesajele din afara lotului sunt raportate separat. Căutarea inițială citește joburile agenției; nu există certificare de performanță pentru istorice foarte mari.

Validare: **138 teste unitare, 125 teste coadă/worker/reguli și scenariul 0348 prin chat persistent**. Incluse: eșecul tranzacției după acceptarea furnizorului, dovezi contradictorii/lipsă, acces revocat, ecou nativ și decontare concurentă. ESLint, paritatea operațiilor și buildul complet trecute. Dovadă prin chat persistent: [lot 37](evals/PROSPECTING_EXECUTION_BATCH_37.json). **168/1000 dovezi locale** (133 cu model real, 35 deterministe), fără certificare integrală în producție. Furnizor simulat; fără mesaje externe. Lot nepublicat.

## Consolidare trimiteri istorice — 16 octombrie 2026

Scenariile **0321–0323** verifică acum și joburile istorice cu identificator explicit de client și proprietate, create înaintea evidenței `communicationPropertyShares`. Aceeași verificare este folosită la pregătirea acțiunilor, executarea lor și înscrierea în coadă. O cerere nouă nu retrimite automat un mesaj queued/accepted/delivered/read/failed/unknown. Coada recuperează atomic evidența lipsă, inclusiv la două cereri simultane. Lectura din chat nu modifică istoricul.

Căutarea separă agenția, clientul și proprietatea; nu deduce identitatea proprietății din textul unui mesaj generic. Aceste mesaje fără metadate de matching rămân în afara protecției istorice. Interogarea istorică este în afara tranzacției, iar evidența este recitită în tranzacție pentru a evita conflictele dintre interogări și crearea concurentă. La publicare trebuie instalat indexul nou din `firestore.indexes.json` înaintea aplicației.

Verificări: **139 teste unitare, 111 teste coadă/worker/reguli și 3/3 scenarii prin chat**, inclusiv comanda 0323 cu evidența nouă eliminată intenționat. ESLint, paritatea operațiilor și buildul final complet trecute. Dovadă: [istoric proprietăți](evals/HISTORICAL_PROPERTY_SHARES.json). Furnizor simulat, fără mesaje externe.

Aceasta consolidează scenarii existente; inventarul rămâne **167/1000 cu dovezi locale**, fără certificare integrală în producție.

## Lot trimitere proprietăți din matching — 16 octombrie 2026

Trei scenarii verificate împreună: **0321, 0322, 0323**, folosind o proprietate selectată sau lista de matching salvată pentru client. Jarvis păstrează ordinea listei, recitește proprietățile active și clientul, creează recomandările în portalul clientului și pune mesajele cu linkul public în coada reală. Nu trimite linkuri CRM private. Dacă există mai multe conversații accesibile pentru același client, cere alegerea prin „Conversație: ID”, apoi continuă solicitarea inițială fără aprobare suplimentară. Resolverul include conversațiile proprii și neatribuite.

Coada creează atomic o evidență per client/proprietate pentru trimiterile cu matchingSelection. Repetările și două cereri simultane nu creează două mesaje pentru aceeași pereche; evidența este comună canalelor și protejată prin reguli server-managed. Un rezultat failed/unknown nu este retrimis automat prin această comandă. Workerul reverifică și portalul/recomandarea înainte de expediere, pe lângă reviziile clientului/proprietății și eligibilitatea canalului.

Validare: **139 teste unitare/planner/autorizare, 102 teste de coadă/worker și reguli Firestore, 3/3 scenarii prin chat și emulator**. Probe pentru reluare după alegerea destinatarului, recomandări persistate, payload cu link public, trei mesaje distincte acceptate de Meta simulat, repetare fără duplicate, concurență și recomandare eliminată/portal înlocuit înainte de expediere. ESLint, paritatea operațiilor și build final complet trecute, după corectarea tipului de retur al executorului. Dovadă: [lot 36](evals/PROSPECTING_EXECUTION_BATCH_36.json). Inventar: **167/1000 dovezi locale** (133 cu model real, 34 deterministe).

Limite: probele folosesc fereastră de răspuns deschisă și context de matching salvat; nu certifică selecția liberă din orice pagină CRM, alegerea automată a șablonului în afara ferestrei sau identificarea trimiterilor istorice fără metadate explicite de matching. Adăugarea în portal și trimiterea sunt etape distincte: dacă eligibilitatea se schimbă, recomandarea poate rămâne în portal fără mesaj trimis. Fără mesaje externe sau certificare în producție. Lot nepublicat; publicarea necesită și regulile Firestore actualizate.

## Lot sincronizare și eșecuri Communications — 16 octombrie 2026

Trei scenarii verificate împreună: **0332, 0333, 0346**. Comanda explicită sincronizează conversația selectată fără plan de aprobare suplimentar. Importul textual Messenger/Instagram parcurge paginile, verifică identitatea și participantul, salvează cursorul după fiecare pagină și reia progresul după întrerupere. Mesajele existente sunt deduplicate după identificatorul furnizorului. Apartenența, rolul și accesul sunt reverificate în tranzacția fiecărui mesaj importat, inclusiv dacă atribuirea se schimbă în timpul apelului către furnizor.

O execuție are maximum 20 de pagini a câte 50 de mesaje. Limita produce explicit rezultat parțial, cu reluare la următoarea comandă; nu este declarată sincronizare completă. O cerere prea recentă/deja în curs este raportată fără a confirma un import nou. Atașamentele media nu sunt restaurate de acest import textual. Pentru WhatsApp/Storia, Jarvis explică primirea prin webhook fără a pretinde import manual. Diagnosticul citește starea salvată, progresul reluabil și categoria eșecului; nu inventează cauza exactă atunci când datele furnizorului nu o stabilesc și nu expune erori brute sau tokenuri.

Raportul zilnic include numai mesaje trimise cu status failed și data eșecului în ziua Bucureștiului. Data este înregistrată de worker sau din recepția furnizorului, inclusiv când recepția precedă mesajul. Mesajele istorice fără data eșecului sunt numărate separat; unknown și conversațiile altui agent sunt excluse. Raportul nu autorizează retrimitere.

Verificări: **133 teste unitare/planner/autorizare, 96 teste coadă/worker, 3/3 scenarii prin chat și emulator**, ESLint, paritatea operațiilor și build final complet. Probe pentru șase pagini, întrerupere și reluare, limită de 20 de pagini și continuare, lipsa duplicatelor, atribuire revocată, delimitarea zilei Bucureștiului și rezultate parțiale. Dovadă: [lot 35](evals/PROSPECTING_EXECUTION_BATCH_35.json). Inventar: **164/1000 dovezi locale** (133 cu model real, 31 deterministe). Furnizor simulat; fără mesaje externe sau certificare integrală în producție. Lot nepublicat în producție.

## Lot șabloane WhatsApp complete — 16 octombrie 2026

Trei scenarii verificate împreună: **0316, 0318, 0320**. Catalogul actual furnizează șabloanele aprobate și suportate, textul și numărul parametrilor. Pentru cererea generică fără șablon sau valori, Jarvis cere informațiile lipsă și reia fluxul din chatul persistent. „Trimite un template aprobat” păstrează autorizația inițială până la completarea parametrilor, fără încă un plan de aprobare; completarea simplă și verificarea politicii produc o ciornă fără trimitere. Acest flux generic nu schimbă trimiterea directă a șablonului dedicat de prospectare.

La fiecare pas sunt recitite accesul, acordul și catalogul. Identitatea șablonului include limba, categoria, textul și numărul parametrilor: dacă se schimbă în timpul completării, valorile nu sunt aplicate automat unui alt conținut. Fereastra deschisă este explicată separat de eligibilitatea mesajului. Ciorna persistentă reutilizează coada și workerul existente, cu destinatar verificat, cost și cheie de deduplicare; repetarea cererii nu trimite din nou. Scenariile au verificat mesajul exact în payloadul Meta simulat și starea accepted, distinctă de delivered.

Validare: **125 teste unitare/planner/autorizare, 95 teste de coadă/worker și 3/3 scenarii prin chat persistent și emulator**, plus ESLint, verificarea inventarului/parității și build complet trecut după corectarea tipului catalogului. Variante unitare pentru șablon schimbat sau suspendat, acord retras, număr incorect de parametri și anulare. Dovezi: [lot 34](evals/PROSPECTING_EXECUTION_BATCH_34.json). Inventar: **161/1000 dovezi locale** (133 cu model real, 28 deterministe). Nu sunt certificate selecția semantică automată pentru orice mesaj, toate reformulările naturale sau livrarea reală Meta. Fără mesaje externe; lot nepublicat în producție.

## Lot ciorne și trimitere explicită — 16 octombrie 2026

Patru scenarii verificate: **0311, 0312, 0313, 0338**. Pregătirea mesajului caută destinatarul numai în conversațiile accesibile, cere ID-ul la nume ambiguu și textul exact dacă lipsește. Următorul răspuns completează informația lipsă și produce o ciornă persistentă în subcolecția server-managed a sesiunii. Acest lot pregătește textul indicat de agent; nu certifică generarea liberă de texte, șabloanele sau aprobarea unui lot de mesaje.

Ciorna păstrează destinatarul, conținutul și oferta de cost verificate de serviciul existent. Previzualizarea afișează textul exact salvat. „Nu trimite răspunsurile încă” păstrează ciorna fără mesaj în coadă; nu anulează un mesaj deja pus în coadă. „Trimite mesajul aprobat” autorizează ciorna unică selectată, fără încă un plan de aprobare. Coada și workerul reverifică identitatea, accesul, fereastra, acordul și costul. Cheia de trimitere derivă din ciornă, astfel încât cereri distincte/repetate nu dublează mesajul; confirmarea queued nu este prezentată drept delivered.

Verificări: **111 teste unitare/planner/autorizare, 95 teste de coadă/worker și 4/4 scenarii prin chat persistent**, inclusiv reluarea după alegerea destinatarului ambiguu. Expirarea ciornei, schimbarea destinatarului, refuzul ulterior, fereastra expirată și sesiunea altui utilizator sunt respinse înainte de coadă. Pentru trimiterea validă, Meta simulat primește exact textul salvat o singură dată, iar mesajul ajunge accepted. ESLint și build complet trecute după corecția tipului reviziei destinatarului. Fără mesaje externe. Dovadă: [lot 33](evals/PROSPECTING_EXECUTION_BATCH_33.json). Inventar: **158/1000 dovezi locale** (133 cu model real, 25 deterministe), fără certificare integrală în producție. Lot nepublicat în producție.

## Lot editări Inbox și opt-out — 16 octombrie 2026

Cinci scenarii verificate: **0326, 0330, 0331, 0344, 0345**. Pentru conversația selectată, nota internă, atribuirea și asocierea proprietății cer informația lipsă, apoi reiau solicitarea fără aprobare generică. Nota este salvată literal în subcolecția internă, fără mesaj către client. Agentul poate prelua pentru sine o conversație neatribuită; administratorul poate atribui unui membru agent/admin al aceleiași agenții. Asocierea caută titlul/adresa normalizate (Cișmigiu/Cismigiu), cere ID la ambiguitate și păstrează proprietățile deja asociate.

Executorul nativ verifică apartenența, accesul, versiunea și existența țintei în tranzacția care salvează modificarea și dovada execuției. Confirmarea finală provine din această dovadă. Verificate reluarea chatului și a executorului fără duplicate, versiune depășită, proprietate ștearsă, agent străin, atribuire interzisă, atribuire permisă administratorului și acces revocat. Reluarea după clarificare se aplică ultimei editări în așteptare; comenzile de anulare nu sunt transformate în valori ale editării.

Comenzile de verificare opt-out citesc explicit refuzul global și acordurile service/marketing, fără trimitere ori modificarea acordului. Numărul public și starea unknown nu devin acord. Identitatea și accesul la conversație sunt reverificate după citirea acordurilor. Probe cu model real pentru refuz global, refuz marketing, unknown și granted; coada respinge cazurile neeligibile, iar workerul nu expediază dacă refuzul apare după punerea în coadă.

**119 teste unitare/planner/autorizare și 5/5 scenarii prin chat/emulator trecute**, plus repetarea celor trei editări cu verificările suplimentare de executor/admin. ESLint și build complet trecute după corectarea referinței TypeScript pentru proprietate. Dovezi: [lot 31, editări deterministe](evals/PROSPECTING_EXECUTION_BATCH_31.json), [lot 32, model real și Meta simulat](evals/PROSPECTING_EXECUTION_BATCH_32.json). Inventar: **154/1000 dovezi locale** (133 cu model real, 21 deterministe). Fără mesaje externe sau certificare în producție; lot nepublicat în producție.

## Lot prioritizare Inbox — 16 octombrie 2026

Patru scenarii verificate împreună: **0334, 0335, 0349, 0350**. Starea conexiunilor afișează separat starea fiecărei capacități, fără credențiale sau erori brute de provider. O conexiune connected nu este declarată automat aptă de trimitere; lipsa unei capacități rămâne unknown. Este starea înregistrată în aplicație, nu un test live al furnizorului.

Conversațiile fără răspuns sunt calculate din mesajele curente. Așteptarea începe la primul mesaj primit după ultimul răspuns accepted/delivered/read; o revenire a clientului și trimiterile queued/failed/unknown nu resetează termenul. Exact 24 de ore nu înseamnă peste 24. accepted este explicit separat de delivered. Prioritatea operațională: așteptare peste 24h, trimitere eșuată/necunoscută fără răspuns ulterior acceptat, apoi mesaje recente. Primele trei sunt selectate după această ordine, vechime și ID. Conversațiile resolved/spam/snoozed sunt excluse; un needsReply fără istoric verificabil este raportat fără durată inventată. Nu este analiză semantică a calității răspunsului.

Acces numai propriu/neatribuit pentru agenți, recitire înainte de returnare, fără trimitere, retrimitere, marcare drept citit sau alte schimbări ale conversațiilor. Probe cu peste 50 de conversații private, atribuire revocată, capacitate modificată și replay fără efecte. **80 teste unitare/planner, 4/4 scenarii prin chat persistent și emulator, ESLint și build complet trecute.** Dovadă: [lot 30](evals/PROSPECTING_EXECUTION_BATCH_30.json). Inventar: **149/1000 dovezi locale** (131 cu model real, 18 deterministe), fără certificare în producție. Lot nepublicat în producție.

## Lot verificări WhatsApp și stări Inbox — 16 octombrie 2026

Șapte scenarii finalizate în probele locale: **0314, 0315, 0317, 0319, 0327, 0328, 0329**. Pregătirea/trimiterea generală a mesajelor și celelalte scenarii intermediare rămân de verificat în loturile următoare; nu sunt incluse în această numărătoare.

- 0314–0315: statusul mesajului selectat este recitit. Probe pentru queued, accepted, delivered și read prin coadă, worker și recepții Meta simulate; nicio retrimitere la verificare sau replay. Sunt acceptate și referințele din cardurile de mesaje ale lotului anterior.
- 0317: catalogul curent separă șabloanele aprobate/suportate de PENDING, format nesuportat și PAUSED, fără a trimite sau modifica acordul.
- 0319: explică fereastra actuală de 24 de ore fără să o confunde cu eligibilitatea completă a mesajului. Verificate momente din interior/exterior, iar testele deterministe acoperă exact limita de 24 de ore și date lipsă/invalide/viitoare.
- 0327–0329: marcarea ca citită, închiderea și redeschiderea salvează numai câmpul cerut și versiunea. Permisiunea rezultă din solicitarea explicită, pentru conversația selectată. Executorul verifică apartenența, atribuirea și versiunea și salvează modificarea împreună cu dovada execuției într-o tranzacție. Reatribuirea și alte modificări nu sunt incluse în această autorizare. Confirmarea finală provine din rezultatul salvat.

Validare: **114 teste unitare/planner/autorizare și 7/7 scenarii originale în emulator**; replay, conflicte de versiune și revocare de acces verificate. Contextul istoric și memoria sunt excluse din verificările WhatsApp/status, care primesc citirile curente. Dovezi: [lot 28, model real și Meta simulat](evals/PROSPECTING_EXECUTION_BATCH_28.json), [lot 29, modificări tranzacționale](evals/PROSPECTING_EXECUTION_BATCH_29.json). Inventar: **145/1000 dovezi locale** (131 cu model real, 14 deterministe), fără certificare integrală în producție. Nu s-au contactat destinatari reali. Lot nepublicat în producție.

## Lot conversații — scenariile 0301–0309 — 16 octombrie 2026

Nouă scenarii verificate împreună prin chat persistent și Firestore local. **0301–0304:** conversații necitite conform readBy, activitate WhatsApp în ziua Bucureștiului, căutare după nume normalizat și ultimele zece mesaje în ordine cronologică. **0305–0307:** rezumat, întrebări fără răspuns și promisiuni, cu model real care primește exclusiv mesajele proaspăt citite. Sunt păstrate direcția, starea livrării și ID-urile; mesajele eșuate nu dovedesc promisiuni transmise, iar datele relative se raportează la data mesajului. **0308–0309:** căutare după cuvânt și după proprietate/cartier, inclusiv asocierea explicită a conversației cu proprietatea. Potrivirea pentru Titan nu include Titanic.

Accesul este reverificat înainte de afișare și după analiza cu model; istoricul vechi al chatului și rezumatul de memorie nu sunt transmise modelului. Numele ambigue cer selectarea conversației pentru analiză. Nu sunt marcate conversațiile drept citite și nu se trimit mesaje. În cazul depășirii bugetului pentru un istoric lung, rezultatul este explicit parțial, fără a prezenta un rezumat incomplet ca integral; acest lot nu certifică toate dimensiunile de istoric ori toate formulările.

Validare: **70 teste unitare/planner**, **9/9 scenarii în emulator**, plus reverificarea 0309 după corecția căutării după cartier. Variante: peste 50 de conversații private excluse, acces propriu/neatribuit, revocare în timpul analizei, nume ambigue, replay fără efecte și o singură reluare după eroare temporară de furnizor. Dovezi: [lot 26, model real](evals/PROSPECTING_EXECUTION_BATCH_26.json), [lot 27, execuție deterministă](evals/PROSPECTING_EXECUTION_BATCH_27.json). Inventar: **138/1000 dovezi locale** (127 cu model real, 11 deterministe), fără certificare integrală în producție. Lot nepublicat în producție.

## Lot comun după apel — scenariile 0295–0300 — 16 octombrie 2026

Șase scenarii implementate/verificate împreună, cu o singură pornire a emulatorului pentru lot. Comanda `--corpus-prospecting-live --case=master-0295,master-0296,master-0297,master-0298,master-0299,master-0300` selectează explicit toate cazurile. Rulările viitoare se organizează în loturi de fluxuri înrudite, conform cererii utilizatorului.

- **0295:** solicită rezultatul efectiv când lipsește, păstrează prospectul selectat, reia cererea și salvează rezultatul/nota fără confirmare suplimentară; test prin chat persistent, model real și verificarea scrierii/replay.
- **0296–0297:** recitește colaborarea și refuzurile, pregătește pașii numai când acceptarea există și păstrează distincția dintre acord verbal și contract semnat. Nu creează un contract sau taskuri dintr-o cerere de pregătire a pașilor. Variante fără acceptare, cu refuz, fără selecție și cu atribuire revocată.
- **0298:** refolosește închiderea tranzacțională a follow-up-ului după verificarea refuzului. Anulează apelurile nelansate și arhivează taskurile proprii de apel; păstrează taskurile altor agenți, documentele și apelurile deja în curs. O cerere de explicație nu autorizează închiderea. Model real, executor și replay verificate.
- **0299:** listează apelurile AI și taskurile de apel uman finalizate fără rezultat; un rezultat manual mai vechi decât apelul nu îl ascunde. Sunt excluse apelurile/taskurile altor agenți. Apelurile umane fără nicio evidență CRM nu pot fi identificate.
- **0300:** raport pe ziua Bucureștiului, cu apelurile AI separate de rezultatele manuale înregistrate. Apelurile doar în coadă nu sunt declarate efectuate; categoriile posibil suprapuse nu sunt însumate. Raportează separat taskurile de apel finalizate fără rezultat, indiferent de zi.

Validare: **118 teste unitare/planner/autorizare și 6/6 scenarii originale în emulator**. Dovezi: [lot 24, model real](evals/PROSPECTING_EXECUTION_BATCH_24.json) și [lot 25, execuție deterministă](evals/PROSPECTING_EXECUTION_BATCH_25.json). Inventar: **129/1000 dovezi locale** (124 cu model real, 5 deterministe), fără certificare integrală în producție. Nu s-au efectuat apeluri sau trimis mesaje externe. Lotul nu este publicat în producție.

## Cerință actualizată — master script de prospectare — 16 octombrie 2026

Utilizatorul configurează un singur master script, comun tuturor apelurilor de prospectare. Jarvis nu trebuie să genereze, să scurteze sau să adapteze individual scriptul pentru proprietari. Scenariile originale 0292–0294 se reevaluează conform acestei cerințe; nu se implementează ca generare liberă și nu sunt marcate ca executate. Modificările începute pentru generarea/scurtarea scriptului au fost retrase înainte de commit sau publicare. Continuarea planului trebuie să respecte master scriptul configurat de utilizator.

## Proprietari de sunat astăzi — scenariul 0291 — 16 octombrie 2026

Comanda „Spune-mi ce proprietari merită sunați azi.” citește toate paginile prospectelor și taskurile/stările de apel ale agenției. Returnează numai prospecte active proprii ori neatribuite, cu telefon valid; exclude refuzurile și apelurile deja în coadă/programate/în curs, inclusiv la alte anunțuri cu același telefon. Prioritatea este operațională: task restant/scadent în ziua Bucureștiului, follow-up fără termen, apoi prospect activ. Termenele viitoare sau invalide nu sunt transformate în recomandări pentru astăzi. Telefoanele sunt deduplicate; răspunsul nu inițiază apeluri și nu depinde de activarea Vapi.

Verificare: 71 de teste unitare/planner și scenariul original prin chat persistent cu Firestore local, peste 50 de prospecte, telefon canonic, refuz, termen viitor, duplicate, schimbare de atribuire și replay. Ruta acestei comenzi este deterministă: proba nu implică model real. Dovadă: [PROSPECTING_EXECUTION_BATCH_23.json](evals/PROSPECTING_EXECUTION_BATCH_23.json). Inventarul ajunge la **123/1000 dovezi locale de execuție** (122 cu model real, una deterministă); acestea nu certifică producția sau toate variantele de formulare. Modificările acestui lot nu sunt publicate în producție.

## Explicația clasamentului — scenariul 0290 — 16 octombrie 2026

„Explică de ce le prioritizezi în ordinea aceasta.” folosește clasamentul complet din ultimul răspuns relevant, păstrează pozițiile și punctajele afișate și recitește toate paginile CRM înaintea explicației. Punctajul curent este raportat separat dacă datele s-au schimbat. Prospectele șterse, inactive, refuzate ori atribuite altor agenți sunt indicate doar prin poziția indisponibilă, fără detalii istorice. Fără un clasament selectat, Jarvis cere afișarea lui înainte să inventeze o justificare.

Prima probă cu model real a identificat o scurgere de context: modelul repeta numele vechi din istoric, deși citirea nouă nu le mai furniza. Pentru acest flux, istoricul conversației, memoria și rezumatul nu mai intră în contextul modelului; serverul transmite numai explicațiile și starea reverificate. O regresie verifică exact absența detaliilor istorice din toate cererile către model.

Au trecut 71 de teste unitare și proba originală cu model real, după un clasament 0289 creat în aceeași conversație: paginare, punctaj istoric 60 versus punctaj actual 40, reatribuire, ștergere, păstrarea ordinii, departajarea după ID, context lipsă, reluare idempotentă și nicio modificare a prospectelor sau contactare externă. ESLint și paritatea au trecut. Dovadă: [PROSPECTING_EXECUTION_BATCH_22.json](evals/PROSPECTING_EXECUTION_BATCH_22.json), inclusiv prima probă nereușită.

Versiuni jarvis-107 / tools 137. Inventarul crește la 122/1000 dovezi locale cu model real, cu 0 certificări complete în producție. Acest lot nu este publicat în producție.

## Zece prospecte prioritare — scenariul 0289 — 16 octombrie 2026

„Arată-mi cele mai promițătoare zece prospecte.” parcurge toate paginile CRM și calculează pe server un top global de maximum zece prospecte active, proprii sau neatribuite. Sunt excluse atribuirile altor agenți, rezultatele negative și refuzul de apel înregistrat. Clasamentul nu este prezentat până la încheierea citirii tuturor paginilor, inclusiv când prima pagină nu conține rezultate eligibile.

Criteriile sunt explicite: follow-up înregistrat (+40), telefon românesc valid (+20), ID pentru departajarea egalităților. Este o prioritate operațională bazată pe aceste date, nu o probabilitate de vânzare și nici o evaluare a prețului sau cererii cumpărătorilor. Lipsa telefonului este indicată drept informație de completat înainte de apel. Cererea nu autorizează contactarea ori modificarea prospectelor.

Au trecut 67 de teste unitare și proba cu model real prin chatTurn: 65 de înregistrări locale, primul lot fără rezultate eligibile, prospectul cu scor maxim pe pagina următoare, exact zece rezultate în ordinea așteptată, punctaje și explicații, reluare idempotentă, înregistrări nemodificate și recitire cu rezultat gol după dezactivare. Verificarea TypeScript, ESLint, paritatea și inventarul au trecut. Dovadă: [PROSPECTING_EXECUTION_BATCH_21.json](evals/PROSPECTING_EXECUTION_BATCH_21.json).

Versiuni jarvis-106 / tools 136. Inventarul crește la 121/1000 dovezi locale cu model real, cu 0 certificări complete în producție. Nu au fost contactate persoane reale. Acest lot nu este publicat în producție.

## Prospectul WhatsApp verificat până la trimitere — 13 octombrie 2026

Referința prospectului se păstrează acum în mesajul pregătit și în jobul de trimitere. Atribuirea conversației singură nu era suficientă: prospectul putea fi reatribuit altui agent după pregătire, iar conversația rămânea la agentul inițial. Coada și workerul recitesc prospectul, atribuirea efectivă, starea activă și telefonul, inclusiv după recuperarea șablonului. Mesajele Inbox folosesc și legătura salvată în conversație. O schimbare nepermisă oprește trimiterea înainte de Meta și eliberează bugetul rezervat.

Au trecut 80 de teste unitare, 90 de integrare (12 cazuri noi) și toate cele 12 probe cu model real. Zece variante verifică executarea comenzii de prospectare până la trimiterea simulată și reluarea fără duplicate: standard, anunțuri cu același proprietar, telefon lipsă, fără intermediari, șablon dedicat, refuz WhatsApp, alt agent, refuz la punerea în coadă, fără previzualizare și fără aprobare suplimentară. Celelalte două sunt regresiile originale 0277 și 0281. Cazurile cu destinatari neeligibili verifică rezultat parțial explicit și continuarea celorlalte trimiteri, nu succes inventat pentru toate contactele.

Buildul cu TypeScript și 227 de pagini, ESLint, paritatea și inventarul au trecut. Dovadă: [WHATSAPP_PROSPECT_BINDING_EXECUTION.json](evals/WHATSAPP_PROSPECT_BINDING_EXECUTION.json). Meta este simulat; nu au fost contactate persoane reale. Versiuni jarvis-105 / tools 135. Inventarul rămâne 120/1000 dovezi locale cu model real și 0 certificări complete în producție; acestea sunt regresii și variante, nu scenarii originale noi. Modificările nu sunt publicate în producție.

## Acces agenți: prospectare și WhatsApp — 13 octombrie 2026

Conform alegerii utilizatorului, agenții lucrează pe prospectele și conversațiile proprii sau neatribuite. Inbox include lista neatribuită și preluarea pentru sine; agenții pot înregistra acordul WhatsApp cu dovezi și pot trimite șabloanele eligibile. Colaborarea veche nu mai oferă agenților acces la conversațiile atribuite altcuiva. Conexiunea, bugetul și administrarea șabloanelor la nivelul agenției rămân la administrator.

API-ul, regulile Firestore și interogările Inbox folosesc aceeași limită de acces. Sunt adăugate șapte indexuri pentru listele după agent. Prospectarea, importul, acordul și crearea conversației folosesc atribuirea efectivă (preluare, rezultat de contact, rezervare activă). Apelurile recitesc atribuirea înaintea lansării, inclusiv după o programare. Mutarea blocării comune a telefonului și reîncercarea limitată exclusiv a tranzacției închise de Firestore rezolvă eroarea descoperită la două cereri concurente; apelul furnizorului rămâne în afara reîncercării.

Au trecut 141 teste unitare și 114 teste de integrare, inclusiv API → coadă → worker → șablon, reatribuire, acces interzis la alt agent și altă agenție, listări și reguli Firestore, plus apeluri concurente. Cele 12 probe opționale cu model real nu au fost rulate în această suită. Furnizorii Meta/Vapi sunt simulați și nu s-au contactat persoane reale. Nu se adaugă scenarii certificate: inventarul rămâne 120/1000 dovezi locale cu model real și 0 certificări complete în producție. Buildul final cu TypeScript și 227 de pagini, verificarea parității și inventarul au trecut. ESLint: zero erori, trei avertismente preexistente de efecte React în Inbox. Versiuni jarvis-104 / tools 134. Modificările necesită publicarea aplicației, regulilor și indexurilor pentru a deveni active în producție.

## Preluări numai cu drept — scenariul 0287 — 13 octombrie 2026

„Nu le prelua fără drept.” este tratată ca o restricție, nu ca o comandă de preluare a prospectelor disponibile. Jarvis citește toate paginile atribuirilor din agenție, fără instrumente de scriere, și afișează prospectele rezervate, preluate sau cu rezultat de contact atribuit altor agenți. Atribuirile inactive rămân vizibile dacă executorul încă le protejează. Serverul furnizează explicit valabilitatea rezervării și expirarea în București.

Verificarea tranzacțională exista deja în executor. Proba nouă folosește doi agenți care citesc prospectul liber și încearcă simultan să îl preia: există exact un câștigător, iar celălalt nu suprascrie atribuirea. Verifică și reluarea idempotentă, refuzul unui rol admin fals, preluarea/rezultatul de contact care rămân prioritare după expirarea rezervării și preluarea legitimă cerută explicit după expirarea unei rezervări simple.

Proba cu model real și chatTurn verifică citirea proaspătă a patru atribuiri, răspunsul fără preluare, lipsa planului și a modificărilor, precum și reluarea idempotentă. Revizuirea textului inițial a descoperit o generalizare greșită despre expirare; răspunsul final distinge rezervarea simplă expirată de preluare și de rezultatul de contact. Dovadă: [PROSPECTING_EXECUTION_BATCH_20.json](evals/PROSPECTING_EXECUTION_BATCH_20.json).

Au trecut 64 de teste unitare și 31 de teste de integrare. Încărcarea lentă a grafului de instrumente a fost mutată în pregătirea suitei pentru a nu contamina testele următoare după un timeout; testul concurent permite 30 de secunde pentru reîncercările Firestore. Manifestul de paritate a fost regenerat pentru o linie UI deplasată în modificările deja existente, fără schimbarea numărului de operațiuni.

ESLint, paritatea, verificarea inventarului și buildul final cu TypeScript și 227 de pagini au trecut. Versiuni jarvis-103 / tools 133. Inventarul crește la 120/1000 dovezi locale cu model real; rămân 0 certificări complete în producție. Nu au fost contactate persoane reale. Acest lot nu este publicat în producție.

## Rezervările altor agenți — scenariul 0286 — 12 octombrie 2026

„Care prospecte sunt rezervate altui agent?” citește toate paginile prospectelor agenției și filtrează pe server numai rezervările active ale altor agenți. Prospectele proprii, inactive, preluate, cu rezultat de contact și rezervările expirate nu sunt prezentate ca rezervări valabile ale altui agent. Se afișează agentul responsabil; ora rezervării este formatată în București. O dată lipsă sau invalidă nu eliberează atribuirea și nu produce o expirare inventată.

Citirea reutilizează paginarea verificată pentru prospectele proprii, fixează resursa și cursorul pe server și nu expune instrumente de modificare. Proba cu model real și chatTurn a parcurs 57 de înregistrări, cu prima pagină fără potriviri, și a returnat exact cele două rezervări așteptate. A verificat agentul, păstrarea tuturor înregistrărilor, reluarea idempotentă și recitirea listei goale după dezactivare. Scenariul 0288 a trecut din nou ca regresie. Dovadă: [PROSPECTING_EXECUTION_BATCH_19.json](evals/PROSPECTING_EXECUTION_BATCH_19.json).

Revizuirea răspunsului inițial a identificat o eroare pe care prima probă nu o verifica: ora începerii rezervării era prezentată ca termen de expirare. Serverul returnează acum separat expiresLocal, calculat cu durata CRM de patru ore efective. Proba finală verifică ora din răspunsul modelului, iar testul determinist acoperă trecerea la ora de iarnă. Dovada inițială este păstrată ca nereușită; nu este folosită pentru certificare.

Au trecut 62 de teste unitare la rularea separată, cele două scenarii cu model real, ESLint, paritatea și buildul final cu TypeScript și 227 de pagini. Rularea unitară simultană cu primul build a depășit timeoutul de inițializare și a perturbat mock-urile testelor următoare; reluarea separată a trecut fără modificarea pragului de timeout.

Versiuni jarvis-102 / tools 132. Inventarul crește la 119/1000 dovezi locale cu model real, cu 0 certificări complete în producție. Nu au fost contactate persoane reale. Modificările nu sunt publicate în producție.

## Prospectele proprii active — scenariul 0288 — 12 octombrie 2026

„Găsește prospectele mele active.” folosește acum citirea paginată a prospectelor agenției, cu filtrare pe server după agentul autentificat. Se reutilizează regulile CRM: preluarea are prioritate, apoi atribuirea prin rezultatul contactului, apoi rezervarea neexpirată. Sunt excluse înregistrările inactive, neatribuite și rezervările expirate. Crearea unui prospect de către agent nu îl face automat proprietarul atribuirii.

Serverul fixează resursa și cursorul, elimină selecțiile sau filtrele inventate de model și cere toate paginile înainte de încheiere. O pagină fără potriviri nu este confundată cu o listă completă goală. Cererea de citire nu expune instrumente de modificare sau contactare.

Proba prin chatTurn, cu model real și Firestore local, include 57 de prospecte: prima pagină fără potriviri și exact trei rezultate pe pagina următoare. Verifică atribuirea, înregistrările nemodificate, reluarea idempotentă și recitirea după dezactivarea celor trei rezultate. Dovadă: [PROSPECTING_EXECUTION_BATCH_18.json](evals/PROSPECTING_EXECUTION_BATCH_18.json). Versiuni jarvis-101 / tools 131. Rezultatul este local, fără contactarea persoanelor reale; modificările nu sunt publicate în producție.

Au trecut 59 de teste unitare, 30 de teste de integrare, scenariul original cu model real la verificarea finală, ESLint, paritatea și buildul cu verificare TypeScript și 227 de pagini. Inventarul crește la 118/1000 dovezi locale cu model real; rămân 0 certificări complete în producție.

## Starea mesajului WhatsApp — scenariul 0281 — 12 octombrie 2026

Cererea originală „Verifică dacă mesajul este queued, accepted, delivered sau read.” epuiza bugetul înainte de prima citire. Planificarea folosește acum numai citirea mesajului și verificarea acoperirii cererii. Referința este fixată de server la mesajul selectat ori la unicul mesaj din rezultatul ultimei execuții. Rezultatele trimiterilor păstrează și conversationId, astfel încât verificarea ulterioară să nu depindă de o identificare inventată de model. Selecțiile multiple cer precizarea mesajului; o pagină fără context nu șterge selecția din conversație.

API-ul este recitit la fiecare cerere nouă, apoi rezultatul este restrâns la ID-ul exact. Un mesaj dispărut nu este înlocuit cu starea altui mesaj din conversație. queued înseamnă în coadă; accepted nu confirmă livrarea; delivered nu confirmă citirea; read confirmă citirea. Verificarea nu expediază mesaje.

Proba cu model real pornește din ledgerul și coada aplicației, trimite o singură dată către Meta simulat și verifică toate cele patru stări. delivered/read sunt produse prin normalizarea și ingestia confirmărilor simulate, nu prin modificarea directă a statusului în fixture. Contextul conversației păstrează receipt-ul inițial queued, demonstrând citirea proaspătă. Reluarea requestului nu retrimite, iar un delivered sosit după read nu retrogradează starea. Dovadă: [PROSPECTING_EXECUTION_BATCH_17.json](evals/PROSPECTING_EXECUTION_BATCH_17.json).

Au trecut 114 teste unitare, 77 teste de integrare, scenariul original cu model real în toate cele patru stări, TypeScript, ESLint, paritatea și buildul final cu 227 de pagini. Versiuni jarvis-100 / tools 130. Inventarul crește la 117/1000 dovezi locale cu model real; rămân 0 certificări complete în producție. Nu au fost contactate persoane reale și modificările nu sunt publicate în producție.

## Prospectare: cereri explicite fără previzualizare sau aprobarea agentului — 12 octombrie 2026

Recunoașterea comenzii distingea insuficient între interdicția de trimitere și renunțarea la un pas manual. „Contactează proprietarii pe WhatsApp fără previzualizare” și „Nu îmi mai cere aprobarea. Găsește ... și contactează proprietarii pe WhatsApp” erau respinse de filtrul general de negații. Formulările explicite de renunțare la previzualizare ori la confirmarea agentului sunt acum recunoscute în contextul unei cereri de contactare.

Interdicțiile de trimitere, lipsa acordului, condițiile, exemplele și cererile de ciornă rămân distincte. Niciun refuz înregistrat al proprietarului nu este eliminat, iar pregătirea verifică în continuare șablonul, destinatarul și costul. Probele complete verifică alegerea șablonului de prospectare dintre trei șabloane aprobate, trei mesaje independente, absența unui plan manual și reluarea fără duplicate.

Regresia cu model real a identificat și o referință inexistentă la conexiune. Citirea catalogului poate recupera automat unica conexiune WhatsApp conectată, prin API-ul autorizat al aceleiași agenții. Corecția este explicită în rezultatul instrumentului și nu expediază mesaje. Nu se aplică dacă sunt mai multe conexiuni, dacă accesul este interzis, în afara unei comenzi de prospectare sau pentru erori incerte ale furnizorului.

Au trecut 153 teste unitare distincte, 77 teste de integrare, toate cele 11 verificări cu model real la rerularea completă, TypeScript, ESLint, paritatea și buildul final cu 227 de pagini. Dovadă pentru comenzile noi: [WHATSAPP_NO_PREVIEW_COMMANDS_EXECUTION.json](evals/WHATSAPP_NO_PREVIEW_COMMANDS_EXECUTION.json). Cele două variante au expediat fiecare trei mesaje prin worker către Meta simulat și niciun mesaj suplimentar la reluarea comenzii.

Versiuni jarvis-99 / tools 129. Inventarul rămâne 116/1000 dovezi locale cu model real și 0 certificări complete în producție. Variantele nu sunt scenarii originale noi; nu au fost contactate persoane reale și modificările nu sunt publicate în producție.

## Prospectare: continuare după un refuz cert al cozii — 12 octombrie 2026

Un destinatar devenit neeligibil după pregătirea mesajelor nu mai oprește ceilalți destinatari independenți. Ruta de mesaje identifică refuzurile de validare în care mesajul nu a fost pus în coadă; executorul le păstrează ca respinse, cu motivul exact. Reluarea aceleiași execuții păstrează refuzul și cheile celorlalți pași, fără mesaje suplimentare. Rezultatele incerte, pierderea accesului și planurile mixte ori dependente opresc în continuare execuția.

Răspunsul final numără numai mesajele acceptate de coadă, afișează separat refuzul și marchează cererea parțial îndeplinită. Nu confundă punerea în coadă cu livrarea WhatsApp. Verificarea cu model real a evidențiat și o recuperare insuficientă după referințe invalide în acoperirea planului: serverul furnizează acum citatul, pașii existenți și ID-urile citirilor reușite pentru corectare, fără acceptarea automată a unei acoperiri neverificate.

Au trecut 156 teste unitare distincte, 76 teste de integrare și toate cele 9 verificări cu model real la rerularea finală, TypeScript, ESLint, paritatea și buildul final cu 227 de pagini. Cazul nou retrage acordul în timpul execuției, după pregătirea reușită; celelalte două mesaje sunt acceptate de furnizorul simulat, refuzul rămâne înregistrat și reluarea nu retrimite. Dovadă: [WHATSAPP_QUEUE_REJECTION_EXECUTION.json](evals/WHATSAPP_QUEUE_REJECTION_EXECUTION.json).

Versiuni jarvis-99 / tools 128. Inventarul rămâne 116/1000 dovezi locale cu model real și 0 certificări complete în producție. Acestea sunt variante suplimentare, nu scenarii originale noi. Nu au fost contactate persoane reale; modificările nu sunt publicate în producție.

## Prospectare: un destinatar blocat nu oprește mesajele independente — 12 octombrie 2026

Pregătirea lotului tratează separat fiecare mesaj independent de prospectare. Un refuz WhatsApp sau o conversație atribuită altui agent nu mai anulează mesajele pregătite pentru ceilalți proprietari. Modelul primește pașii efectiv pregătiți și motivele pentru destinatarii blocați; nu trebuie să repete lotul ori să ceară aprobarea textului. Deduplicarea se păstrează în lot și între propuneri. Planurile mixte, cele cu referințe între pași și cererile fără autorizare explicită își păstrează pregătirea existentă.

Aplicația păstrează pe server cerințele neîndeplinite pentru destinatarii blocați, inclusiv când modelul le omite din acoperirea cererii. Prin urmare, contactarea a doi dintre trei proprietari nu este raportată drept succes integral. Pregătirea reușită ulterior elimină motivul anterior pentru același anunț. Trimiterea autonomă rămâne limitată la mesaje pregătite de server și acoperite de plan; refuzurile și accesul nu sunt modificate pentru a forța expedierea.

Au trecut 122 teste unitare, 75 teste de integrare și 8 verificări cu model real, TypeScript, ESLint, paritatea și buildul final cu 227 de pagini. Cele două variante noi au trimis exact două șabloane către furnizorul simulat, au păstrat refuzul/atribuirea celuilalt proprietar și nu au retrimis la reluarea requestului. Testul de integrare suplimentar verifică și raportarea omisiunii modelului. Dovadă: [WHATSAPP_INDEPENDENT_RECIPIENTS_EXECUTION.json](evals/WHATSAPP_INDEPENDENT_RECIPIENTS_EXECUTION.json).

Versiuni jarvis-99 / tools 127. Inventarul rămâne 116/1000 dovezi locale cu model real și 0 certificări complete în producție. Acestea sunt variante suplimentare, nu scenarii originale noi. Nu s-au contactat persoane reale și modificările nu sunt publicate în producție.

## Prospectare directă cu șablonul dedicat, fără previzualizare manuală — 12 octombrie 2026

Clarificarea utilizatorului prevalează asupra unui flux cu previzualizare obligatorie: comanda explicită de prospectare WhatsApp autorizează expedierea șablonului dedicat, fără ca agentul să confirme textul, mesajul sau planul. Costul și eligibilitatea se verifică intern în pregătire și în expeditor. Consultarea șabloanelor sau previzualizarea cerută expres rămân operații separate, niciodată pași manuali obligatorii ai prospectării. Completările nefinalizate pentru un nou instrument de previzualizare au fost retrase.

Instrucțiunile disting șablonul dedicat prospectării de cele pentru newsletter și confirmări de vizionare; existența șabloanelor cu alte scopuri nu mai trebuie tratată ca motiv de a cere agentului să aleagă. În lipsa datelor indispensabile ori dacă există mai multe variante de prospectare indistincte, Jarvis trebuie să precizeze problema reală, fără să o prezinte drept lipsa aprobării agentului. Refuzurile înregistrate și verificările reale de expediere rămân active.

Proba nouă cu model real a găsit trei apartamente, a ales `prospectare_proprietari` din trei șabloane aprobate cu scopuri diferite și a expediat trei mesaje prin coada/workerul aplicației către Meta simulat. Niciun plan de aprobare, nicio solicitare de previzualizare și nicio retrimitere la reluarea requestului. Au trecut 105 teste unitare și toate cele 6 cazuri cu model real din suita WhatsApp, TypeScript, ESLint, paritatea și buildul final cu 227 de pagini. Dovada: [WHATSAPP_DIRECT_PROSPECTING_TEMPLATE.json](evals/WHATSAPP_DIRECT_PROSPECTING_TEMPLATE.json).

Versiune prompt jarvis-98. Inventarul rămâne 116/1000 cu dovezi locale și 0 certificări complete în producție; aceasta este o variantă suplimentară, nu un scenariu original nou. Nu au fost contactate persoane reale și modificările nu sunt publicate în producție.

## Șabloane WhatsApp după acord — 0277 — 12 octombrie 2026

Cererea originală „După acord, verifică template-urile disponibile.” citește acum acordurile conversației selectate și șabloanele conexiunii sale prin API-ul existent al aplicației. Jarvis prezintă numele, limba, categoria, statusul Meta și numărul parametrilor. Separă aprobarea Meta de compatibilitatea formatului: un șablon PENDING/PAUSED sau cu format incompatibil nu este oferit ca disponibil pentru pregătire. Disponibilitatea tehnică nu certifică eligibilitatea destinatarului ori costul; acestea rămân supuse previzualizării mesajului concret. Cererea de consultare nu înregistrează acorduri și nu trimite mesaje.

Conversația este fixată pe server din selecția existentă și păstrată în rezultat pentru verificarea următoare. Lipsa acordului sau refuzul global sunt raportate fără apelarea catalogului Meta; o eroare a furnizorului nu este transformată în listă goală. Catalogul paginat este citit prin serviciul existent. Nu se elimină controalele de acces ale API-ului.

Scenariul original a trecut prin `chatTurn` cu model real, Firestore local și Meta simulat, inclusiv citirea ulterioară a unui șablon schimbat din APPROVED în PAUSED, reluarea idempotentă a requestului și absența mesajelor/joburilor outbound. Raportul păstrează și încercarea intermediară nereușită cauzată de conexiunea absentă din fixture; datele finale includ conexiunea cerută de API. Dovada: [PROSPECTING_EXECUTION_BATCH_16.json](evals/PROSPECTING_EXECUTION_BATCH_16.json).

Au trecut 77 teste unitare, 74 teste de integrare, scenariul original cu model real, TypeScript, ESLint, manifestul de paritate și buildul final cu 227 de pagini. Versiuni jarvis-97 / tools 126. Inventar: **116/1000 dovezi locale cu model real, 0 certificări complete în producție**. Nu au fost contactate persoane reale și modificările nu sunt publicate în producție.

## Prospectare WhatsApp: filtrele ofertelor nu interzic contactarea — 12 octombrie 2026

Solicitările explicite care includ „fără intermediari”, „fără agenții” sau „fără comision” sunt recunoscute acum ca solicitări de contactare. Aceste expresii descriu ofertele; anterior, simpla prezență a cuvântului „fără” dezactiva fluxul de prospectare autorizat prin solicitare. Excepția este limitată la cele trei expresii complete. „Fără acord”, „nu trimite”, condițiile, exemplele și cererile de ciornă continuă să nu acorde permisiunea de expediere, inclusiv în aceeași cerere cu un filtru admis. Recunoașterea intenției nu certifică absența comisionului unei oferte.

Cererea „Găsește 3 apartamente fără intermediari în Titan sub 130000 euro și contactează proprietarii pe whatsapp” a fost executată prin model real și serviciile aplicației, cu Firestore local și Meta simulat: trei destinatari, trei șabloane acceptate, zero retrimiteri la reluarea aceluiași request. Au fost rerulate cu succes și variantele standard, proprietar comun cu titluri lungi și telefon lipsă. Dovada: [WHATSAPP_PROSPECTING_FILTERS_EXECUTION.json](evals/WHATSAPP_PROSPECTING_FILTERS_EXECUTION.json).

Validare: 94 teste unitare, 69 teste de integrare, 4 variante cu model real; TypeScript, ESLint, manifestul de paritate și buildul final cu 227 de pagini trecute. Versiuni jarvis-96 / tools 125. Aceste probe suplimentare nu măresc inventarul original: 115/1000 dovezi locale cu model real și 0 certificări complete în producție. Nu au fost contactate persoane reale. Modificările nu sunt publicate în producție.

## Prospectare WhatsApp: destinatari comuni, date lipsă și rezultate lungi — 12 octombrie 2026

Au fost verificate trei variante cu model real și fluxul efectiv chat → căutare → pregătire → API → coadă → worker, pe Firestore local și Meta simulat. Dovadă: [WHATSAPP_PROSPECTING_VARIANTS_EXECUTION.json](evals/WHATSAPP_PROSPECTING_VARIANTS_EXECUTION.json). Cazul obișnuit trimite trei șabloane. Trei anunțuri cu titluri foarte lungi și un proprietar comun produc două mesaje către două numere distincte; formularea „Găsește doar 3...” este recunoscută ca solicitare explicită. Când al treilea anunț nu are telefon, cele două mesaje eligibile sunt executate, iar lipsa telefonului rămâne indicată în răspuns și starea cererii este `partial`. Nu sunt inventate date și nu este declarat succes integral pentru proprietarul necontactat. Reluarea fiecărui request nu retrimite mesajele.

Compresia rezultatelor păstrează numele/telefonul proprietarului și identificatorul/scopul dovezii de citire. Un titlu lung nu mai elimină datele necesare contactării din contextul modelului. Deduplicarea funcționează și între propuneri succesive din aceeași cerere, cu indicarea pașilor deja pregătiți. Planurile mixte își păstrează ordinea și referințele dintre pași.

Execuția parțială este limitată la mesaje de prospectare independente, pregătite de server și acoperite de cerințe validate, atunci când planificarea a reușit sau cere clarificări pentru alt destinatar. Opririle de buget, erorile, refuzurile și planurile fără dovadă validă nu sunt convertite în permisiune de expediere. Refuzurile WhatsApp, identitatea destinatarului, costul și bugetul continuă să fie verificate de serviciul de expediere.

Validare: TypeScript, ESLint, manifestul de paritate și buildul final au trecut, împreună cu 180 teste unitare, 69 teste de integrare fără model și 3 variante suplimentare cu model real, inclusiv execuție prin handlerul real și verificarea numărului exact de apeluri către furnizorul simulat. Inventarul original rămâne 115/1000 dovezi locale, cu 0 certificări complete în producție. Aceste variante nu cresc artificial numărul de scenarii originale certificate. Nu au fost contactate persoane reale și modificarea nu este publicată în producție.

## Prospectare WhatsApp cu destinatari noi: cerere executată cu model real — 12 octombrie 2026

Cererea „Găsește 3 apartamente în Titan sub 130000 euro și contactează proprietarii pe whatsapp” a fost verificată în aceeași tură de chat, cu model real, căutarea reală a aplicației, crearea conversațiilor, acordul declarat prin solicitare, handlerul API, coada și workerul reale. Firestore a rulat local, iar Meta a fost simulat; nu au fost contactate persoane reale. Dovada este [WHATSAPP_PROSPECTING_REQUEST_EXECUTION.json](evals/WHATSAPP_PROSPECTING_REQUEST_EXECUTION.json).

Rezultatul verificat: trei vânzări de 120000, 125000 și 130000 EUR; excluse oferta peste plafon, chiria și oferta din alt cartier. Au fost create trei conversații și expediate trei șabloane către furnizorul simulat. Reluarea aceluiași request nu a retrimis mesaje. Nu este necesară crearea manuală a contactului/conversației sau completarea acordului în Inbox. Conversațiile păstrează legătura cu anunțul proprietarului, fără a inventa un cumpărător în CRM. Anunțurile cu același număr sunt deduplicate în lot; conversațiile atribuite altui agent nu sunt preluate.

Verificarea cu model real a identificat și rezolvat trei blocaje care nu apăreau în testarea izolată: instrucțiuni/unelte prea voluminoase, lipsa datelor proprietarului în rezultatul căutării și lipsa dovezii pentru o pagină care conținea deja numărul de oferte solicitat. Fluxul folosește acum instrucțiuni specifice; căutarea expune datele necesare contactării și dovada limitată la rezultatele returnate, fără a pretinde un total global. Răspunsul final confirmă introducerea mesajelor în coadă și indică Inbox, fără afirmația contradictorie că nu au fost trimise mesaje și fără a confunda acceptarea furnizorului cu livrarea.

Validare: TypeScript, ESLint, manifestul de paritate și buildul final (227 pagini) au trecut; 155 teste unitare; suita de integrare include 68 cazuri fără model, plus verificarea separată cu model real. Exemplul utilizatorului este o dovadă suplimentară, nu un scenariu original nou certificat: inventarul rămâne 115/1000 dovezi locale din corpus și 0 certificări complete în producție. Modificarea nu este publicată în producție.

## Prospectare WhatsApp: declarația agentului prin solicitare — 12 octombrie 2026

La solicitarea explicită a utilizatorului, comanda de contactare WhatsApp a proprietarilor este declarația agentului că a obținut anterior acordul telefonic pentru prospectare. Pentru mesajele pregătite cu anunțul concret, serverul salvează acordul marketing și istoricul cu sursa `agent_request_prior_phone_consent`, autorul, solicitarea originală, sesiunea, anunțul și destinatarul. Nu inventează răspunsul proprietarului sau data apelului. Agentul nu mai completează formularul Inbox pentru acest flux. Declarația poate rămâne înregistrată chiar dacă verificarea ulterioară a șablonului/configurației/costului împiedică expedierea.

Numărul trebuie să coincidă cu anunțul accesibil din prospectarea agenției sau cu un anunț public canonic, gata de utilizare. Solicitarea salvată, apartenența agentului, accesul la conversație, numărul și eventualele refuzuri se recitesc în tranzacție. Declarația nu suprascrie un refuz global/marketing și nu înlocuiește dovezile unui acord deja existent. Același request nu dublează istoricul. Un număr public, o ciornă, o verificare sau o solicitare ipotetică nu acordă permisiunea de contact.

Mesajele de prospectare cu dovadă produsă de server, șablon marketing aprobat și cost verificat intră în execuția autorizată de solicitare, fără încă un opt-in al agentului. Rămân verificările reale din coadă și worker, inclusiv retragerea acordului după pregătire și rezervarea bugetului. Confirmarea participării la vizionare rămâne separată și provine exclusiv din răspunsul WhatsApp corelat.

Validare: TypeScript, ESLint, manifestul de paritate și buildul de producție (227 pagini) au trecut; 125 teste unitare și 62 teste de integrare în emulator, cu serviciul real de coadă/worker și Meta simulat. Au fost verificate înregistrarea acordului, numărul public fără favorit, expedierea o singură dată, refuzul, schimbarea numărului/accesului, proveniența solicitării și eliberarea bugetului. Aceasta nu reprezintă o nouă certificare a corpusului: rămân 115/1000 dovezi locale cu model real. În această modificare nu s-a verificat cap-coadă prin model căutarea celor trei oferte plus crearea unor conversații noi; pregătirea `message_send` necesită în continuare conversații concrete existente. Nu s-au contactat persoane reale și nu s-a publicat în producție.

Această regulă înlocuiește cerința pasului manual descrisă mai jos numai pentru solicitarea explicită de prospectare WhatsApp. Fluxul manual rămâne disponibil pentru alte situații.

## Fluxul uman de acord și numărul public — 0275 parțial / 0276

Jarvis recunoaște cererea originală de înregistrare prin fluxul uman și citește acordurile reale ale conversației selectate. Oferă linkul exact către Inbox, indică panoul „Consimțământ WhatsApp”, scopul, dovada/data și pasul administratorului. Nu colectează dovada în chat, nu scrie acordul și nu pretinde că acesta a fost înregistrat. Formularul Inbox golește dovada și resetează scopul la schimbarea conversației, evitând reutilizarea textului pentru alt destinatar.

Cererea originală 0276, „Nu presupune acordul WhatsApp din faptul că numărul este public.”, a fost verificată cu model real, număr public în context și acorduri absente. Răspunsul păstrează starea necunoscută, nu deduce acord sau refuz, nu scrie consimțământ și nu creează mesaje. Pentru 0275 s-au verificat ghidarea și reluarea conversației, dar înregistrarea umană rămâne neexecutată și scenariul nu este numărat ca finalizat. Dovadă: [PROSPECTING_EXECUTION_BATCH_15.json](evals/PROSPECTING_EXECUTION_BATCH_15.json).

Au trecut 113 teste unitare, TypeScript, paritatea și buildul final cu 227 de pagini; lint are 0 erori și 3 avertismente React privind setState în efectele Inbox. Versiuni **jarvis-92 / tools 121**. Total **115/1000** cu dovezi locale prin model, **0 certificări complete în producție**. Formularul nu a fost verificat în browser, iar probele nu implică acorduri reale sau mesaje externe. Modificările nu sunt publicate în producție.

## Verificarea destinatarului prin Jarvis — 0274

Cererea originală „Nu trimite WhatsApp dacă destinatarul nu este eligibil.” verifică acum conversația selectată printr-un instrument nativ de citire. Serverul fixează destinatarul din selecție, cere citirea înainte de încheiere și nu expune trimiterea sau modificarea acordurilor în acest flux. Refuzul global înregistrat este raportat ca blocare; lipsa refuzului sau existența unui număr de telefon nu devin acord ori eligibilitate. Categoriile service/marketing sunt prezentate separat și mesajul concret rămâne supus previzualizării existente.

Proba cu model real prin `chatTurn` a verificat cererea originală, refuzul global, răspunsul persistent și reluarea lui, apoi acordurile necunoscute după eliminarea refuzului. Nu sunt create mesaje outbound, acorduri sau acțiuni de trimitere. Prima rulare a găsit selecția ascunsă de contextul gol al paginii; corecția păstrează conversația salvată. Au trecut 112 teste unitare, TypeScript, lint, paritatea și buildul final cu 227 de pagini. Dovadă: [PROSPECTING_EXECUTION_BATCH_14.json](evals/PROSPECTING_EXECUTION_BATCH_14.json). Protecțiile cozii și workerului au dovezi separate în cele două rapoarte 0274 de mai jos.

Versiuni **jarvis-91 / tools 120**. Total **114/1000** cu dovezi locale prin model, **0 certificări complete în producție**. Această verificare locală nu certifică tariful, aprobarea șablonului, disponibilitatea Meta sau livrarea; nu înlocuiește verificările mesajului concret înainte de expediere. Modificările nu sunt publicate în producție.

## Șabloane marketing și previzualizare actuală — progres parțial 0274

Previzualizarea mesajului recitește acum destinatarul și acordul după obținerea șablonului, înainte să returneze rezultatul. Astfel, schimbarea destinatarului sau retragerea globală a acordului în timpul citirii șablonului nu produce o previzualizare validată pe date vechi.

Cele nouă cazuri noi folosesc un șablon MARKETING aprobat și un tarif nenul, în afara ferestrei de răspuns. Retragerea/ștergerea acordului de marketing și refuzul global sunt verificate înainte de coadă și după estimarea workerului. Mesajele blocate nu ajung la furnizor, rezervarea de 500.000 micros EUR este eliberată fără cheltuire, iar reluarea nu expediază. Cazul eligibil este acceptat o singură dată de furnizorul simulat și păstrează costul rezervat până la receipt.

Au trecut **52 teste Firestore**, **43 teste unitare**, TypeScript, lint, paritatea și buildul cu **227 de pagini**. Limita suitei locale outbound este acum 20 de secunde per test, după un timeout intermediar de 5 secunde și interferența lui cu un test ulterior; timpii aplicației nu sunt modificați. Dovadă: [WHATSAPP_MARKETING_ELIGIBILITY_PARTIAL_0274.json](evals/WHATSAPP_MARKETING_ELIGIBILITY_PARTIAL_0274.json).

Totalul rămâne **113/1000** cu dovezi locale prin model și **0 certificări complete în producție**. Nu s-a executat din nou cererea originală prin model și nu s-a contactat niciun destinatar real. Schimbarea aprobării șablonului în timpul expedierii și receipt-urile reale Meta nu sunt certificate aici. Modificările nu sunt publicate în producție.

## Eligibilitate WhatsApp la trimitere — progres parțial 0274

Coada și workerul reverifică acum fereastra de răspuns și acordul WhatsApp după estimarea inițială. În tranzacția cozii, retragerea acordului împiedică scrierea mesajului și a jobului. Workerul recitește acordul după pregătirea conexiunii și oprește expedierea dacă destinatarul nu mai este eligibil. Verificarea răspunsului deja primit păstrează prioritatea motivului de oprire a unui follow-up.

Au trecut TypeScript, lint, paritatea, buildul final cu 227 de pagini, 43 de teste unitare și 43 de teste Firestore, inclusiv șase cazuri noi cu retragere globală, retragerea acordului de serviciu sau expirarea ferestrei între pași. Furnizorul simulat nu este apelat în aceste cazuri; reluarea workerului nu expediază mesajul blocat. Cazul eligibil existent continuă să trimită o singură dată. Dovadă: [WHATSAPP_ELIGIBILITY_PARTIAL_0274.json](evals/WHATSAPP_ELIGIBILITY_PARTIAL_0274.json).

Acest increment întărește execuția reală, dar nu certifică cererea originală 0274 prin model. Totalul rămâne **113/1000** cu dovezi locale și **0 certificări complete în producție**. Cazurile noi folosesc mesaje de serviciu fără șablon; variantele de marketing și furnizorul Meta real nu sunt certificate. Verificarea locală nu formează o tranzacție cu furnizorul extern: o modificare după ultima citire nu poate retrage o cerere deja expediată. Modificările nu sunt publicate în producție.

## Ciornă de colaborare pentru proprietar — 0273

Cererea originală „Pregătește un mesaj de colaborare pentru proprietar.” citește prospectul selectat înainte de redactare. Serverul fixează resursa și ID-ul citirii; acest flux expune numai citirea și verificarea acoperirii cererii. Ciorna completă rămâne în conversația salvată, iar aplicația o etichetează explicit ca netrimisă. Nu se creează task, apel AI sau conversație WhatsApp și nu se înregistrează acordul proprietarului.

Proba cu model real prin `chatTurn` a verificat numele și anunțul, textul integral, lipsa comisionului inventat, salvarea și reluarea răspunsului fără efecte externe. A doua cerere a preluat numele și titlul actualizate în CRM, în ciuda istoricului vechi, și a reușit fără telefon. O rulare intermediară a omis mențiunea „netrimis”; eticheta este acum adăugată de aplicație, iar proba finală a trecut. Au trecut 107 teste unitare, TypeScript, lint, paritatea și buildul final cu 227 de pagini. Dovadă: [PROSPECTING_EXECUTION_BATCH_13.json](evals/PROSPECTING_EXECUTION_BATCH_13.json).

Versiuni **jarvis-90 / tools 119**. Total **113/1000** cu dovezi locale, **0 certificări complete în producție**. Scenariul cere redactare; eligibilitatea WhatsApp, șabloanele Meta și livrarea nu sunt certificate de această probă. Toate parafrazele și interfețele browser/voce nu sunt verificate. Modificările nu sunt publicate în producție.

## Task de apel uman în loc de apel AI — 0272

Cererea originală cere acum ziua lipsă și păstrează prospectul selectat în conversația salvată. Răspunsul „Mâine la ora 10:30.” continuă cererea autorizată și creează un singur task pentru același prospect. Plannerul acestui flux nu are instrumente de lansare a apelului AI și respinge acțiunile pentru alt prospect.

Proba cu model real prin `chatTurn` a verificat taskul efectiv salvat, participantul Alin Matei, telefonul din sursa prospectului, data și ora Bucureștiului, confirmarea persistentă și reluarea fără duplicare. Nu s-a creat niciun apel AI. Au trecut 106 teste unitare, 30 de teste Firestore, TypeScript, lint, paritatea și buildul final cu 227 de pagini. Dovadă: [PROSPECTING_EXECUTION_BATCH_12.json](evals/PROSPECTING_EXECUTION_BATCH_12.json).

Versiuni **jarvis-89 / tools 118**. Total **112/1000** cu dovezi locale, **0 certificări complete în producție**. Sunt verificate formularea originală și răspunsul cu zi și oră; nu sunt certificate toate parafrazele, variantele fără telefon, interfața vocală sau browserul. Modificările nu sunt publicate în producție.

## Oprirea follow-up-ului prin comanda agentului — 0271

Cererea originală „Oprește follow-up-ul dacă proprietarul a refuzat.” verifică refuzul actual pentru prospectul selectat și continuă cu o acțiune nativă. Solicitarea agentului autorizează această modificare CRM, fără activarea unei permisiuni suplimentare. Lipsa refuzului înregistrat nu este transformată într-un refuz inventat și nu produce acțiuni.

Executorul reverifică profilul, agenția și refuzul în aceeași tranzacție cu modificările: anulează apelurile AI nelansate, golește următorul follow-up AI și arhivează/elimină taskurile deschise de apel/follow-up ale agentului. Administratorul poate include taskurile agenției. Taskurile finalizate, fără legătură sau ale colegilor rămân nemodificate pentru agent. Refuzul retras între citire și execuție oprește modificările. Repetarea cheii de execuție întoarce rezultatul inițial fără duplicarea arhivelor.

Proba cu model real a verificat comanda originală, anularea unui apel programat, eliminarea recuperabilă a unui task, păstrarea taskurilor fără legătură și ale colegului, confirmarea rezultatului și varianta fără refuz. Apelurile deja expediate sau posibil expediate sunt raportate separat ca neoprite. Au trecut **129 teste unitare**, **30 teste Firestore**, TypeScript, lint și verificarea parității (**180 operații / 41 acțiuni native**) și buildul final cu **227 de pagini**. Dovadă: [PROSPECTING_EXECUTION_BATCH_11.json](evals/PROSPECTING_EXECUTION_BATCH_11.json).

Versiuni **jarvis-88 / tools 117**. Total **111/1000** cu dovezi locale, **0 certificări complete în producție**. Selecția taskurilor cere legătura ownerListingId și termeni de apel/follow-up în descriere; toate formulările nestructurate nu sunt certificate. Peste 100 de apeluri sau taskuri pentru un anunț, operația se oprește fără scrieri parțiale. Convorbirile reale, interfața vocală și reluarea conversației persistate nu sunt verificate. Eșecul concurent HTTP 500 observat în etapa anterioară nu s-a reprodus în această suită; cauza lui rămâne neclarificată. Modificările nu sunt publicate în producție.

## Refuz persistent și oprirea follow-up-urilor AI nelansate — 0271, parțial

Webhookul salvează acum tranzacțional starea apelului și refuzul proprietarului. Un eveniment ulterior fără refuz nu șterge aiDoNotCall și nici dovada refuzului din rezultatul apelului. Evenimentele de început sosite după o stare terminală nu readuc apelul în curs. Un apel vechi nu înlocuiește starea ultimului apel al proprietarului.

După refuz, aiNextFollowUpAt este golit și apelurile queued/scheduled ale aceluiași anunț sunt anulate, cu reverificare tranzacțională înaintea fiecărei anulări. Apelurile deja expediate și cele pentru alte anunțuri rămân nemodificate. Pentru alte anunțuri cu același telefon rămâne verificarea existentă de refuz la lansare. Câmpul opțional confidence lipsă nu mai produce o scriere undefined în Firestore.

Au trecut **50 teste unitare**, **29 teste Firestore**, TypeScript, lint și buildul final cu **227 de pagini**. Testul folosește ruta HTTP reală de webhook și verifică refuzul, anularea, evenimentele întârziate și păstrarea stării unui apel mai nou, fără apeluri către furnizor. Prima rulare a găsit eroarea confidence, corectată, și un HTTP 500 la testul concurent existent; acesta a trecut la reluare fără schimbarea codului de dispatch. Cauza acelui 500 nu este stabilită și stabilitatea sub concurență nu este certificată.

Scenariul 0271 rămâne parțial: comanda conversațională de oprire, taskurile de apel uman, refuzurile înregistrate manual și furnizorul real nu sunt acoperite de această probă. Nu se pretinde închiderea unui apel deja lansat. Dovadă: [OUTREACH_REFUSAL_PARTIAL_0271.json](evals/OUTREACH_REFUSAL_PARTIAL_0271.json). Totalul rămâne **110/1000** cu dovezi locale, **0 certificări complete în producție**. Modificările nu sunt publicate în producție.

## Programarea apelului după clarificarea orei — 0270

Cererea originală „Programează apelul conform funcționalității existente.” cere acum data și ora lipsă pentru prospectul selectat. Răspunsul ulterior continuă aceeași programare: modelul calculează momentul în București, verifică eligibilitatea la ora cerută și pregătește acțiunea cu scheduledAt. Serverul respinge continuarea fără moment verificat, o acțiune diferită de cea verificată sau folosirea unei selecții vechi când lista nouă este ambiguă.

Verificarea preliminară folosește intervalul permis la data programării și respinge trecutul. Proba cu model real pentru răspunsul „Mâine la ora 10:30.” a salvat prin ruta HTTP reală un singur apel scheduled în Firestore local, fără invocarea furnizorului. Confirmarea indică ora Bucureștiului și faptul că apelul nu este încă efectuat. Repetarea aceleiași execuții întoarce rezultatul existent fără duplicat.

Au trecut **86 teste unitare**, **28 teste Firestore**, TypeScript, lint, paritatea operațiilor și buildul final cu **227 de pagini**. Dovadă: [PROSPECTING_EXECUTION_BATCH_10.json](evals/PROSPECTING_EXECUTION_BATCH_10.json). Versiuni **jarvis-87 / tools 116**. Total **110/1000** cu dovezi locale, **0 certificări complete în producție**.

Clarificarea inițială este deterministă; continuarea folosește modelul real. Interfața de aprobare, reluarea conversației persistate, schedulerul la scadență și apelul telefonic efectiv nu sunt certificate de această probă. Sunt acoperite cererea originală și continuări recunoscute care încep cu data; toate variantele de limbaj natural nu sunt încă verificate. Modificările nu sunt publicate în producție.

## Lansarea apelului pentru prospectul selectat — 0266, probă locală cu model real

Cererea originală „Pornește apelul AI dacă este eligibil și este aprobat.” are acum o verificare preliminară dedicată: prospect activ, telefon românesc complet, titlu actual, serviciu activ, interval București, limite zilnice și buget, refuzuri și contactări deja înregistrate la același număr. Lipsa selecției cere alegerea prospectului. Verificarea nu creează apeluri, nu modifică setări și nu ține loc de aprobare.

Planificatorul fixează prospectul din context pe server și acceptă numai acțiunea returnată de verificarea reușită. Nu poate declara cererea acoperită oprindu-se după verificare: trebuie să pregătească apelul. Executorul existent reverifică starea înaintea lansării și repetarea aceleiași execuții nu produce un al doilea apel.

Proba cu model real a parcurs cererea originală, pregătirea planului, executorul pentru acțiunea aprobată, ruta HTTP reală și salvarea în Firestore local. Furnizorul simulat a primit exact un apel; confirmarea spune că furnizorul l-a acceptat, fără să pretindă încheierea conversației. Varianta cu serviciul dezactivat a produs explicație fără o nouă acțiune sau apel. Au trecut **121 teste unitare**, **27 teste Firestore**, TypeScript, lint, paritatea operațiilor și buildul final cu **227 de pagini**. Dovadă: [PROSPECTING_EXECUTION_BATCH_09.json](evals/PROSPECTING_EXECUTION_BATCH_09.json).

Versiuni **jarvis-86 / tools 115**. Total **109/1000** cu dovezi locale, **0 certificări complete în producție**. Interfața de aprobare, furnizorul real și conversația telefonică nu sunt certificate. Ruta compactă acoperă comanda originală și variante simple de lansare imediată, nu certifică toate formulările sau programările. Scanarea istoricului pentru agenții mari și rezervarea concurentă a cotelor necesită verificări suplimentare. Modificările nu sunt publicate în producție.

## Confirmarea stării apelului în conversație — 0266, parțial

Confirmarea execuției recunoaște acum rezultatul operației outreach_start și identificatorul apelului salvat. Acceptarea furnizorului este afișată numai pentru starea calling cu ID extern; nu este prezentată drept conversație încheiată. Programările viitoare au dată și oră București, inclusiv diferența vară/iarnă. Anularea, eșecul și lansarea incertă au mesaje distincte. Rezultatele fără identificator concordant sau programările expirate nu primesc o confirmare de succes.

Validare: **26 teste unitare**, **26 teste în emulatorul Firestore**, TypeScript și lint trecute. Confirmarea a fost verificată și pe răspunsul rutei HTTP reale, cu furnizor simulat, pentru acceptare și refuzul intervenit înaintea lansării. Nu s-a reluat buildul de producție pentru această modificare. Nu s-a rulat modelul real în acest lot și nu s-au efectuat apeluri externe.

Totalul rămâne **108/1000** cu dovezi locale și **0 certificări complete în producție**. Scenariul 0266 rămâne parțial; mai trebuie validat traseul conversațional complet de la solicitare la plan și execuție. Modificările nu sunt publicate în producție.

## Formatul telefonului la furnizor și refuzul intervenit înaintea lansării — 0266, parțial

Adaptorul trimite acum telefonul românesc complet în format internațional +40 către endpointul POST /call documentat de [Vapi](https://docs.vapi.ai/calls/outbound-calling). Formatele locale, +40 și 0040 sunt normalizate la transport; snapshotul din CRM nu este modificat. Numerele incomplete sunt respinse înaintea cererii HTTP și înaintea creării documentului de apel, inclusiv forma veche de opt cifre acceptată de normalizatorul general.

Crearea apelului nu mai scrie aiDoNotCall=false. Astfel, un refuz salvat după verificarea inițială nu mai este șters de actualizarea stării apelului. Tranzacția de lansare vede refuzul, anulează apelul cu motiv și îl păstrează în evidența proprietarului. Răspunsul rămâne anulare, fără a pretinde că proprietarul a fost sunat.

Au trecut **71 teste unitare**, **26 teste Firestore**, TypeScript, lint, paritatea celor 180 de operații, inventarul corpusului și buildul final cu 227 de pagini. Testul de transport verifică payloadul efectiv și păstrează ca incert un răspuns HTTP fără ID de apel. Proba HTTP/Firestore introduce refuzul exact între verificarea eligibilității și actualizarea stării, apoi verifică anularea, lipsa marcajului de expediere și zero apeluri către furnizorul simulat. Dovadă: [OUTREACH_PROVIDER_PARTIAL_0266.json](evals/OUTREACH_PROVIDER_PARTIAL_0266.json).

Versiuni **jarvis-85 / tools 114**. Totalul rămâne **108/1000** cu dovezi locale, **0 certificări complete în producție**. Scenariul 0266 rămâne parțial: nu este certificat apelul real, fluxul de aprobare sau rezultatul conversației externe. Nu au fost efectuate apeluri reale și modificările nu sunt publicate în producție.

## Modificarea setărilor prin conversație — 0269; telefonul pentru 0266, parțial

Cererea originală „Actualizează setările de outreach pe care am dreptul să le schimb.” citește configurația și drepturile actuale. Agentul fără drept de editare nu primește un plan de scriere. Administratorului i se cer valorile noi dacă lipsesc, iar răspunsul ulterior continuă aceeași cerere și pregătește numai câmpurile solicitate. Planul nu este prezentat drept salvare.

Handlerul salvează patchul într-o tranzacție: modificări concurente la câmpuri diferite se păstrează, în loc să rescrie configurația din copii învechite. Receiptul de succes este emis după commit, iar confirmarea în conversație folosește acel rezultat, cu limita zilnică și intervalul București. Reluarea aceleiași execuții întoarce receiptul salvat fără încă o scriere.

Pornirea apelului poate folosi acum telefonul din anunțul canonic cu publicationStatus=ready când telefonul lipsește din prospect. Numărul explicit salvat, chiar invalid, nu este înlocuit automat; un număr transmis arbitrar în cererea HTTP este ignorat. Sursele draft sau necanonice nu furnizează telefonul. Proba HTTP verifică numărul transmis furnizorului simulat și cel salvat în apel.

Au trecut proba 0269 cu model real, **118 teste unitare**, **25 teste Firestore**, TypeScript, lint, paritatea celor 180 de operații, inventarul corpusului și buildul final cu 227 de pagini. Proba concurentă a necesitat timeout de 30 secunde în loc de 5 pentru reîncercările Firestore; limitele aplicației nu au fost mărite. Dovadă: [PROSPECTING_EXECUTION_BATCH_08.json](evals/PROSPECTING_EXECUTION_BATCH_08.json). Versiuni **jarvis-85 / tools 113**. Total **108/1000** cu dovezi locale, **0 certificări complete în producție**.

Proba continuării folosește mesajele conversației și executorul pentru acțiunea aprobată; nu certifică interfața aprobării sau reluarea din chat persistent. Scenariul 0266 rămâne parțial, fără apel real certificat. Nu au fost contactați clienți și modificările nu sunt publicate în producție.

## Comanda de blocare și revalidarea orei apelului — 0267; 0266/0269 parțial

Cererea originală „Nu porni apelul dacă serviciul este dezactivat.” verifică acum configurația actuală și răspunde fără lansare sau reactivare. Modelul real a executat citirea în trei variante locale: document absent, serviciu dezactivat și serviciu activ. În fiecare caz sunt verificate lipsa acțiunilor de pornire, a modificărilor configurației și a documentelor de apel. Starea activă nu transformă o cerere negativă într-o autorizație de lansare.

La preluarea tranzacțională, lansarea recitește data salvată și intervalul actual al agenției. Programarea viitoare rămâne intactă, fără furnizor invocat, chiar dacă executorul avea o copie veche cu o dată deja trecută. O programare fără dată validă sau o lansare în afara intervalului permis este anulată cu motiv. Orele sunt evaluate în București, inclusiv intervalele care trec peste miezul nopții.

Actualizarea setărilor respinge orele invalide, câmpurile necunoscute și patchurile goale. Scrierea este disponibilă în registrul Jarvis numai administratorilor, în concordanță cu handlerul existent. Formularul trimite numai câmpurile editabile; identitatea agenției și metadatele documentului nu ajung în patch. Proba HTTP verifică salvarea normală din formular, un interval nocturn și păstrarea câmpurilor nemodificate.

Au trecut **150 teste unitare**, **24 teste Firestore**, proba 0267 cu model real, TypeScript, lint, contractele regenerate, paritatea celor 180 de operații, inventarul corpusului și buildul final cu 227 de pagini. Dovadă: [PROSPECTING_EXECUTION_BATCH_07.json](evals/PROSPECTING_EXECUTION_BATCH_07.json). Versiuni **jarvis-84 / tools 112**. Total **107/1000** cu dovezi locale, **0 certificări complete în producție**.

Proba locală 0267 completează verificarea conversațională lipsă în raportul anterior. Nu certifică lansarea reală 0266, modificarea setărilor prin limbaj natural 0269, disponibilitatea furnizorului sau concurența limitelor zilnice. Dezactivarea după preluarea tranzacțională nu retrage o cerere deja expediată. Nu au fost efectuate apeluri reale și modificările nu sunt publicate în producție.

## Configurația outreach și oprirea lansării după dezactivare — 0268; 0267 parțial

Cererea originală „Verifică setările de outreach.” citește configurația actuală a agenției printr-un instrument dedicat. Jarvis prezintă activarea, comisioanele, intervalul în București, limitele și dreptul de editare. Citirea nu expune câmpuri arbitrare sau credențiale salvate accidental în document. Lipsa configurației înseamnă valorile implicite cu serviciul dezactivat, fără crearea unui document. Activarea nu certifică eligibilitatea proprietarului sau configurarea furnizorului.

Lansarea apelurilor recitește acum setările în tranzacția de preluare a apelului. O configurație dezactivată sau absentă anulează apelul queued/scheduled înainte de furnizor, chiar dacă intrarea executorului avea o copie veche cu enabled=true. Rezultatul este anulare, nu apel efectuat. Starea proprietarului este sincronizată fără suprascrierea unui apel mai nou. Furnizorul primește configurația citită în tranzacția reușită.

Au trecut proba 0268 cu model real pe două variante Firestore (configurație absentă și salvată), **86 teste unitare**, **22 teste Firestore**, TypeScript, lint, paritatea celor 180 de operații, inventarul corpusului și buildul final cu 227 de pagini. Dovezi: [PROSPECTING_EXECUTION_BATCH_06.json](evals/PROSPECTING_EXECUTION_BATCH_06.json) și [OUTREACH_DISABLED_PARTIAL_0267.json](evals/OUTREACH_DISABLED_PARTIAL_0267.json).

Versiuni **jarvis-83 / tools 111**. Total **106/1000** cu dovezi locale, **0 certificări complete în producție**. Scenariul 0267 rămâne parțial: proba acoperă codul aplicației, fără comanda originală prin model și fără furnizor real. Dezactivarea după preluarea tranzacțională nu retrage un apel deja în curs de expediere. Modificările nu sunt publicate în producție.

## Consultarea apelurilor AI — 0263, 0264, 0265

Jarvis citește acum lista apelurilor AI, apelurile eșuate și rezultatul ultimului apel printr-un instrument dedicat. Pentru liste, aplicația fixează filtrul cerut și cursorul și nu permite încheierea înaintea ultimei pagini, inclusiv când o pagină intermediară nu conține potriviri. Schema compactă elimină epuizarea bugetului de planificare observată în proba inițială cu mai multe pagini.

Ultimul apel este ales după startedAt, apoi endedAt sau createdAt, independent de ordinea documentelor. Programările, cozile și anulările nu devin rezultate de apel. Starea în curs și lansarea cu rezultat necunoscut rămân explicite. Rezumatul, rezultatul structurat și motivul erorii sunt păstrate; orele apelului și programării sunt calculate în Europe/Bucharest.

Au trecut cele trei cereri originale cu model real și Firestore local, inclusiv 101 apeluri vechi între înregistrările relevante, fără modificări CRM sau apeluri externe. Au trecut și **58 teste unitare**, **21 teste Firestore**, TypeScript, lint, paritatea celor 180 de operații, inventarul corpusului și buildul final cu 227 de pagini. Dovadă: [PROSPECTING_EXECUTION_BATCH_05.json](evals/PROSPECTING_EXECUTION_BATCH_05.json).

Versiuni **jarvis-82 / tools 110**. Total **105/1000** cu dovezi locale și **0 certificări complete în producție**. Citirea ultimului rezultat este limitată la 5000 de înregistrări; un istoric incomplet sau fără date valide nu este certificat drept cel mai recent. Egalitățile sunt numărate și afișate în limita a 30 de rezultate, cu trunchiere explicită. Modificările nu sunt publicate în producție.

## Rezultatul contactului uman oprește apelul AI duplicat — 0262, parțial

Lansarea AI verifică acum și rezultatele de contact salvate pe celelalte prospecte ale agenției, inclusiv inactive. Un rezultat `negative` sau `follow_up`, cu dată validă și telefon corespunzător, anulează apelul AI pornit prin alt anunț. Un task planificat, numele comun sau un rezultat fără dată nu sunt considerate dovada unui contact efectuat.

Salvarea unui rezultat prin executor reține `contactOutcomePhone`, normalizat, pentru a nu muta istoricul pe alt număr atunci când telefonul curent este editat. Dacă prospectul nu are telefon, se folosește numai sursa canonică disponibilă; dacă telefonul rămâne necunoscut, snapshotul este explicit null. Pentru înregistrările vechi fără snapshot se folosește telefonul prospectului; identitatea istorică nu poate fi reconstruită dacă acesta a fost schimbat. Resetarea explicită a rezultatului șterge și snapshotul; editarea notelor îl păstrează.

Au trecut **38 teste unitare**, **20 teste Firestore**, TypeScript, lint, paritate, inventarul corpusului și buildul final cu 227 pagini. Proba de integrare execută actualizarea CRM reală, verifică snapshotul din sursa canonică, modifică telefonul și inactivează prospectul, apoi confirmă anularea apelului AI duplicat fără invocarea furnizorului simulat. Dovadă: [OWNER_HUMAN_CONTACT_PARTIAL_0262.json](evals/OWNER_HUMAN_CONTACT_PARTIAL_0262.json).

Versiuni **jarvis-81 / tools 109**. Scenariul rămâne parțial: apelurile externe neînregistrate, rezultatele șterse și diferențierea scopului mesajelor nu sunt acoperite; performanța pe istorice mari rămâne neverificată. Total **102/1000** cu dovezi locale, **0 certificări complete în producție**. Nu au fost inițiate apeluri reale și modificările nu sunt publicate în producție.

## Prevenirea apelurilor AI duplicate între anunțuri — 0262, parțial

Lansarea comună apelurilor AI imediate și programate folosește acum un document tranzacțional per telefon românesc normalizat, în agenție. Două anunțuri diferite nu mai pot porni simultan două apeluri la același număr. Istoricul vechi este verificat cu normalizarea +40/0040/spații, fără limitarea la ultimele 25 de ore: un apel în curs, un apel încheiat pentru alt anunț sau un refuz de contactare blochează lansarea duplicată.

Cererea duplicată este salvată ca anulată, cu motiv, iar starea prospectului este sincronizată dacă încă indică acel apel. Rezultatul consumat de Jarvis rămâne `cancelled`, nu succes extern. Telefonul curent este revalidat înaintea furnizorului; accesul agentului și opt-out-ul existent rămân obligatorii. Un apel eșuat definitiv poate fi reîncercat; un follow-up intenționat pe același anunț rămâne posibil după încheierea apelului anterior, în limitele existente.

Au trecut **25 teste unitare**, **19 teste Firestore**, TypeScript, lint, paritate, inventarul corpusului și buildul final cu 227 pagini. Proba prin două cereri HTTP concurente produce exact un apel la furnizorul simulat și o anulare. Verificarea a durat 6,1 secunde în emulator; timeoutul implicit de 5 secunde al testului a fost ajustat la 30 pentru reîncercările tranzacționale, fără modificarea limitelor aplicației. Dovadă: [OWNER_PHONE_DISPATCH_PARTIAL_0262.json](evals/OWNER_PHONE_DISPATCH_PARTIAL_0262.json).

Versiuni **jarvis-81 / tools 108**. Scenariul rămâne parțial pentru celelalte canale de contactare. Compatibilitatea cu apelurile vechi citește istoricul agenției în tranzacție; performanța la volume mari nu este certificată. Programările duplicate pot exista înaintea lansării, dar nu se trimit de două ori. Totalul rămâne **102/1000** cu dovezi locale și **0 certificări complete în producție**. Nu au fost inițiate apeluri reale și modificările nu sunt publicate în producție.

## Verificarea telefonului la alte anunțuri — 0261

Comanda originală „Verifică dacă numărul lui apare și la alte anunțuri.” activează acum citirea prospectelor agenției după telefonul complet normalizat. Serverul fixează anunțul selectat și cursorul paginii următoare; nu permite încheierea înainte de citirea tuturor paginilor. Rezultatul distinge celelalte anunțuri de cel selectat și include explicit potrivirile inactive. Nu citește inutil istoricul și nu efectuează contacte sau modificări CRM.

Probele inițiale au descoperit JSON imbricat incomplet la retranscrierea cursorului. `owner_prospects` are acum argumente native structurate, eliminând acea serializare suplimentară. Detectarea apelurilor repetitive folosește cursorul efectiv executat în acest flux, astfel încât trecerea la pagina a treia nu este considerată o buclă dacă modelul omite cursorul.

Proba finală cu model real și Firestore local citește trei pagini, cu 105 anunțuri neasociate între potriviri, găsește formatele +40/0040 și exclude același nume cu alt telefon. Verifică și telefonul lipsă, întrebarea salvată, reluarea după răspuns, repetarea idempotentă și cazul fără alte potriviri. Nu sunt apeluri de instrument eșuate sau modificări CRM. Dovadă: [PROSPECTING_EXECUTION_BATCH_04.json](evals/PROSPECTING_EXECUTION_BATCH_04.json).

Regresia 0260 a trecut cu model real pe noul contract, inclusiv clarificările de telefon și asociere; dovadă: [OWNER_PHONE_CONTRACT_REGRESSION_PARTIAL_0260.json](evals/OWNER_PHONE_CONTRACT_REGRESSION_PARTIAL_0260.json). Au trecut 58 teste unitare, TypeScript complet, lint, paritate, inventarul corpusului și buildul final cu 227 pagini.

Versiuni **jarvis-81 / tools 107**. Total **102/1000** cu dovezi locale, **0 certificări complete în producție**. Domeniul este prospectarea agenției, nu toate anunțurile globale; numărul comun nu garantează identitatea persoanei. Scenariul 0260 rămâne parțial. Modificările nu sunt publicate în producție.

## Orele taskurilor și rezultatele apelurilor recuperate — 0260

Istoricul asociat prin telefon păstrează acum ora și durata taskurilor, precum și rezultatul structurat, începutul, sfârșitul și durata apelurilor. Astfel, un apel al unui prospect șters nu pierde informația despre documentele disponibile sau rezultatul negocierii. Valorile explicite false și zero se păstrează; un task fără oră nu primește una inventată.

Prima probă cu model real a expus o conversie greșită: ora locală 07:30 a fost prezentată ca 10:30. Serverul furnizează acum `taskLocal` marcat explicit ca ora Bucureștiului, atât în `owner_prospects`, cât și în `timeline`; politica precizează că `startTime` este deja local și nu trebuie convertit. Verificările acoperă iarna, vara și ziua schimbării orei.

Proba finală cu model real păstrează **07:30**, **45 de minute** și certificatul energetic din rezultatul apelului, inclusiv după clarificarea telefonului în conversația salvată. Fluxul cu asociere ambiguă continuă să treacă, fără apeluri de instrument eșuate. Dovadă: [OWNER_INTERACTION_DETAILS_PARTIAL_0260.json](evals/OWNER_INTERACTION_DETAILS_PARTIAL_0260.json). Versiuni **jarvis-80 / tools 106**. Au trecut **49 teste unitare**, **17 teste Firestore**, TypeScript complet, lint, paritate, inventarul corpusului și buildul final cu 227 pagini.

Scenariul rămâne parțial pentru înregistrările fără asociere utilizabilă. Total **101/1000** cu dovezi locale și **0 certificări complete în producție**. Modificările nu sunt publicate în producție.

## Paginarea surselor și păstrarea ID-ului selectat — 0260

Resolverul importurilor citește toate paginile URL-ului, în ordine după ID, separat pentru `link` și `originSourceUrl`, în loc să abandoneze la 51 de documente. Sursele necanonice și ciornele sunt ignorate după citire; nu mai ascund surse valide aflate pe pagini ulterioare. ID-urile canonice se deduplică între câmpuri, iar verificarea prospectelor agenției se face în grupuri de maximum 20 pentru a evita lansarea simultană a tuturor citirilor.

Regresiile Firestore găsesc sursa validă după 101 documente necanonice, detectează contradicția adăugată după acestea și verifică 61 de surse canonice asociate aceluiași proprietar. Schimbarea telefonului ultimului candidat este detectată. Proba cu model real parcurge istoricul cu 110 ciorne pe același URL, inclusiv clarificarea telefonului și a asocierii contradictorii. Dovadă: [OWNER_SOURCE_PAGINATION_PARTIAL_0260.json](evals/OWNER_SOURCE_PAGINATION_PARTIAL_0260.json).

Prima probă reală a descoperit un ID de prospect transcris greșit de model. Pentru istoricul unui singur prospect selectat, serverul fixează acum ținta `owner_prospects` și `scope=agency_history` din selecția aplicației, cu revalidarea accesului. O listă anterioară nu înlocuiește cardul selectat; selecțiile contradictorii nu fixează arbitrar o țintă. Regresia trimite intenționat un ID greșit și confirmă citirea țintei corecte, fără eroare.

Au trecut **17 teste Firestore**, **43 teste unitare** și proba finală cu model real fără apeluri de instrument eșuate. TypeScript complet, lint, paritate, inventarul corpusului și buildul final cu 227 pagini au trecut. Versiuni **jarvis-79 / tools 105**. Scenariul rămâne parțial pentru înregistrările fără asociere utilizabilă; bugetele de timp și execuție rămân aplicabile. Total **101/1000** cu dovezi locale, fără certificare nouă în producție. Modificările nu sunt publicate în producție.

## Clarificarea asocierilor contradictorii — 0260

Dacă un URL de import indică surse cu proprietari diferiți sau fără prospect în agenție, Jarvis cere explicit dacă proprietatea CRM identificată prin titlu și ID aparține proprietarului selectat. Cererea și proprietatea în așteptare se păstrează în conversație. Răspunsul „da” include istoricul proprietății, „nu” îl exclude, iar „nu știu” păstrează întrebarea. O comandă nouă sau anularea nu aplică automat confirmarea.

Precizarea agentului este folosită doar pentru citirea curentă și este marcată `agent_confirmed_association`; nu modifică fișa CRM. Confirmarea este legată prin hash de proprietate, sursele candidate, asocierea lor cu telefonul selectat și datele proprietății. Reluarea recitește datele și accesul; o confirmare veche nu se aplică unei referințe schimbate. Confirmările deja rezolvate sunt păstrate când următoarea proprietate necesită clarificare.

Proba finală cu model real parcurge conversația salvată, întrebarea, răspunsul „da”, toate citirile și răspunsul final cu taskul importului ambiguu. Repetarea aceleiași cereri întoarce rezultatul salvat; proprietatea rămâne neschimbată. Verifică în continuare și lipsa telefonului, importurile duplicate concordante, apelurile și mesajele autorizate. Dovadă: [OWNER_CONFLICT_CONTINUATION_PARTIAL_0260.json](evals/OWNER_CONFLICT_CONTINUATION_PARTIAL_0260.json).

Prima probă a citit datele, dar a eșuat la validarea finală. Serverul furnizează acum explicit citatul cererii și ID-urile citirilor reușite după încheierea citirilor obligatorii, fără a elimina validatorul sau a mări bugetele. Proba finală nu are apeluri de instrument eșuate. Au trecut **42 teste unitare** și **15 teste Firestore**, inclusiv confirmare, refuz, revalidare și izolare între agenții. TypeScript complet, lint, paritate, inventarul corpusului și buildul final cu 227 pagini au trecut. Versiuni **jarvis-78 / tools 104**.

Scenariul rămâne parțial pentru înregistrări fără asociere utilizabilă și limitele de scanare a surselor. Totalul rămâne **101/1000** cu dovezi locale, fără certificare nouă în producție. Modificările nu sunt publicate în producție.

## Importuri cu surse duplicate și reluarea citirilor omise — 0260

Un URL de import care apare în mai multe anunțuri canonice este rezolvat automat dacă fiecare candidat este asociat proprietarului prin prospectele agenției și telefonul complet normalizat. Rezultatul păstrează toate ID-urile sursă verificate (`linkedListingIds`), fără alegerea arbitrară a unui anunț. Am eliminat scurtătura prin care URL-ul prospectului selectat ocolea verificarea duplicatelor: un candidat cu alt telefon sau fără prospect în agenție menține asocierea nerezolvată. Un ID explicit de import rămâne prioritar.

Prima probă cu model real a încercat să încheie după doar două timeline-uri. Mesajul serverului de reluare enumeră acum citirile lipsă și cursorii lor reali, precizând că `goal_coverage` devine disponibil după finalizarea lor. Regresia verifică reluarea paginii exacte, fără repetarea paginilor încheiate.

Proba finală cu model real citește taskul proprietății importate prin URL duplicat, împreună cu celelalte apeluri, taskuri și mesaje; verifică și conversația salvată cu telefon lipsă, răspuns incomplet, număr valid și reluare. Nu există apeluri de instrument eșuate în execuția finală. Dovadă: [OWNER_DUPLICATE_SOURCE_PARTIAL_0260.json](evals/OWNER_DUPLICATE_SOURCE_PARTIAL_0260.json). Au trecut **15 teste Firestore** și **40 teste unitare**, TypeScript complet, lint, paritate, inventarul corpusului și buildul final cu 227 pagini. Versiuni **jarvis-77 / tools 103**.

Scenariul rămâne parțial pentru identități contradictorii și înregistrări fără asociere utilizabilă. Total **101/1000** cu dovezi locale; fără certificare nouă în producție. Modificările nu sunt publicate în producție.

## Reluarea istoricului după clarificarea telefonului — 0260

Când prospectul nu are un telefon complet, Jarvis cere numărul și păstrează prospectul și cererea în conversație. Un răspuns cu un număr incomplet păstrează clarificarea; un număr românesc valid reia citirea tuturor surselor asociate. Telefonul furnizat este folosit pentru această citire, fără modificarea fișei CRM. Numărul deja salvat, dacă există între timp, are prioritate, iar accesul la prospect și conversații se verifică din nou. O comandă nouă, anularea sau selectarea altui obiect nu preiau automat cererea veche.

Proba cu model real parcurge `chatTurn`, clarificarea salvată, răspunsul incomplet, răspunsul valid, istoricul rezultat și repetarea aceleiași cereri. Verifică apelurile din prospecte active/inactive/șterse, taskul importului indirect și mesajul autorizat, cu fișele neschimbate și fără apeluri de instrument eșuate în execuția finală. Prima probă a expus contextul paginii goale care ascundea selecția anterioară; corecția este inclusă și are regresie dedicată. Dovadă: [OWNER_IDENTITY_CONTINUATION_PARTIAL_0260.json](evals/OWNER_IDENTITY_CONTINUATION_PARTIAL_0260.json).

Au trecut 39 teste unitare și 13 teste Firestore, TypeScript complet, lint, paritate, inventarul corpusului și buildul final cu 227 pagini. Versiuni **jarvis-76 / tools 102**. Scenariul rămâne parțial pentru identități ambigue și înregistrări fără nicio asociere utilizabilă. Total **101/1000** cu dovezi locale, fără certificare nouă în producție. Modificările nu sunt publicate în producție.

## Interacțiuni păstrate după ștergerea prospectului — 0260

Istoricul agenției caută acum și în `aiOutreachCalls` și `tasks`, după telefonul complet normalizat sau referința exactă la prospect. Astfel, apelurile și taskurile rămân vizibile în istoricul proprietarului chiar dacă prospectul la care trimiteau nu mai există. Rândurile `readMode=interaction` conțin direct rezultatul citit și se deduplică în răspuns după `source/id` față de timeline. Taskurile deschise și apelurile programate nu sunt prezentate drept convorbiri efectuate.

Planificatorul nu oferă `goal_coverage` până când toate paginile de asociere și toate timeline-urile cerute au fost citite complet. Verifică aceeași condiție și pe server; un răspuns fără citiri sau cu pagini omise nu este certificat ca succes. Aceasta elimină validarea prematură observată în prima probă, înainte de citirea datelor.

Au trecut 12 teste Firestore, 34 de teste ale planificatorului și proba finală cu model real, fără apeluri de instrument eșuate. Dovadă: [OWNER_ORPHAN_HISTORY_PARTIAL_0260.json](evals/OWNER_ORPHAN_HISTORY_PARTIAL_0260.json). Versiuni **jarvis-75 / tools 101**. Scenariul rămâne parțial pentru identități lipsă/ambigue și înregistrări fără nicio asociere utilizabilă. Totalul rămâne **101/1000**, fără certificare nouă în producție.

Verificări finale: TypeScript complet (`tsc --noEmit`), lint, paritate, inventarul corpusului și buildul cu 227 pagini trecute. Modificările nu sunt publicate în producție.

## Importuri fără telefon din alte prospecte asociate — 0260

Istoricul include acum proprietăți fără telefon care trimit prin `ownerListingId` sau URL exact la alt prospect al aceluiași proprietar. Resolverul verifică prospectul din agenția curentă și telefonul complet normalizat, inclusiv pentru prospecte inactive. Telefonul dintr-un anunț global, fără prospect în agenție, nu acordă asocierea. URL-urile sunt căutate exact în `link` și `originSourceUrl`; sursele canonice multiple sau limita de verificare produc referințe explicit nerezolvate, nu o asociere ghicită. `associationComplete` este separat de finalizarea paginării, iar referințele sunt recitite la fiecare cerere.

Proba cu model real a găsit taskul proprietății fără telefon importate din prospectul asociat și a încheiat răspunsul împreună cu apelurile și mesajul proprietarului. Dovadă: [OWNER_INDIRECT_IMPORT_HISTORY_PARTIAL_0260.json](evals/OWNER_INDIRECT_IMPORT_HISTORY_PARTIAL_0260.json). Au trecut 11 teste Firestore și 32 teste ale planificatorului, lint, paritate, inventarul corpusului și buildul final (TypeScript, 227 pagini). Cele 6 apeluri de instrument din proba cu model real au reușit fără erori. Modificările nu sunt publicate în producție. Versiuni **jarvis-74 / tools 100**.

Scenariul original rămâne parțial pentru înregistrări din afara prospectării agenției și identități lipsă/ambigue. Total **101/1000**, fără certificare nouă în producție. Limita importurilor indirecte menționată în secțiunea precedentă este rezolvată pentru referințele exacte testate.

## Proprietăți importate și conversații în istoricul proprietarului — 0260

`owner_prospects` cu `scope=agency_history` include acum prospectele, proprietățile CRM asociate prin ID/URL exact de import sau telefon complet și conversațiile autorizate cu telefonul proprietarului. O conversație a cumpărătorului nu este inclusă numai pentru că menționează aceeași proprietate. Telefonul lipsă nu împiedică citirea legăturilor exacte, dar rezultatul semnalează identitatea incompletă. Fiecare sursă are cursor independent; continuarea este refuzată dacă telefonul sau referința anunțului se schimbă. Accesul conversației se verifică din nou înainte de citirea mesajelor și referințele sunt păstrate pentru reautorizarea rezultatului.

Proba cu model real a prezentat apelurile din două prospecte, taskul proprietății importate și mesajul din conversația proprietarului, fără a expune conversația altui agent. Dovadă: [OWNER_CRM_HISTORY_PARTIAL_0260.json](evals/OWNER_CRM_HISTORY_PARTIAL_0260.json). Scenariul rămâne parțial pentru înregistrările fără telefon utilizabil/referință exactă, importurile fără telefon legate numai de alt anunț asociat (referințele exacte sunt rezolvate momentan pentru anunțul selectat) și anunțurile din afara prospectării agenției. Totalul rămâne **101/1000**, fără certificare integrală în producție. Versiuni **jarvis-73 / tools 99**.

Verificări trecute: 10 teste Firestore, 32 teste ale planificatorului, proba cu model real, lint, paritate, inventarul corpusului și buildul final cu TypeScript și 227 pagini. Modificările nu au fost publicate în producție.

## Istoricul prospectelor asociate prin telefon — continuare 0260

`owner_prospects` citește prospectele agenției cu paginare și compară telefonul românesc complet normalizat, inclusiv variantele +40/0040 și prospectele inactive. Nu asociază persoane numai după nume. Cursorul este legat de agenție, prospect și telefonul actual; dacă telefonul se schimbă, continuarea veche este refuzată. Lipsa telefonului valid este declarată explicit, fără un rezultat fals complet.

Planificatorul folosește instrumente și instrucțiuni compacte pentru cererile de istoric ale prospectului selectat, păstrând descoperirea altor instrumente. Contractele de citire și `goal_coverage` sunt explicite, eliminând opririle premature observate în probe din cauza bugetului și a confuziei dintre citiri și pași de scriere. Proba finală cu model real prezintă rezultatele apelurilor din ambele anunțuri și taskul planificat. Dovezi: [PROSPECT_PHONE_LINKED_HISTORY_PARTIAL_0260.json](evals/PROSPECT_PHONE_LINKED_HISTORY_PARTIAL_0260.json).

Au trecut 8 teste Firestore, 32 teste ale planificatorului, lint, paritatea instrumentelor, inventarul corpusului și buildul final (TypeScript, 227 pagini). Scenariul original rămâne parțial: proprietățile importate în CRM, anunțurile globale și conversațiile fără legătură înregistrată nu sunt acoperite de această probă. Total **101/1000**, fără certificare nouă în producție. Versiuni **jarvis-72 / tools 98**.

## Istoricul prospectului — progres parțial pentru 0260

Citirea `timeline` pentru prospect include acum apelurile AI și taskurile legate prin `ownerListingId`, pe lângă evenimentele CRM. Sursele sunt paginate independent; taskurile păstrează scadența și sunt prezentate ca activități planificate. Notițele și statusul curent sunt returnate separat de evenimentele datate. Evenimentele legate de conversații sau dosare inaccesibile sunt filtrate și din timeline.

Cererea originală 0260 a fost verificată cu model real și Firestore local pentru anunțul selectat: apelul, rezultatul și taskul sunt citite fără scrieri sau amestec cu alt prospect. Dovadă: [PROSPECT_TIMELINE_PARTIAL_0260.json](evals/PROSPECT_TIMELINE_PARTIAL_0260.json). `executionVerified` rămâne false: corelarea tuturor anunțurilor aceluiași proprietar și a interacțiunilor asociate nu este încă implementată. Totalul rămâne **101/1000**. Versiuni **jarvis-71 / tools 97**. Modificările nu sunt publicate în producție.

Verificări: 7/7 teste ale fluxului în Firestore local, o probă cu model real pentru istoricul anunțului selectat, lint, paritate, inventarul corpusului și buildul de producție (TypeScript și 227 pagini) trecute. Nu au fost contactați clienți.

## Lot prospectare — follow-up legat de prospect și condiții discutate

Scenariile **0257 și 0259** au dovezi locale noi. În 0257, modelul real calculează ziua la 14 zile calendaristice în București, iar executorul creează efectiv un task cu `ownerListingId`, participantul actual și scadența fără oră inventată. Prospectul apare pe cardul taskului și în confirmarea salvării. Nu se creează un cumpărător sau o proprietate CRM pentru această legătură. Datele inactive, apartenența la alt agent și combinarea cu relații CRM incompatibile sunt refuzate înainte de scriere.

În 0259, conversația cere condițiile lipsă și apoi salvează comisionul, lipsa exclusivității și restricția orară din răspuns ca notă, păstrând istoricul. Cuvântul „doar” dintr-o condiție factuală nu mai este tratat drept previzualizare. Cererea inițială și răspunsul la clarificare ajung împreună la planificare și validarea acoperirii, eliminând pierderea scopului cererii. Reluarea aceleiași cereri nu dublează taskul sau nota.

Versiuni **jarvis-70 / request-crm-13 / tools 96**. Au trecut **9 probe cu model real**, **2.190 teste locale** și **78 verificări țintite** după ajustările continuării. Dovezi: [PROSPECTING_EXECUTION_BATCH_03.json](evals/PROSPECTING_EXECUTION_BATCH_03.json). Total **101/1000 cu dovezi locale**, **899 fără rezultat local verificat**. Scenariul 0260 (istoricul complet al proprietarului) și limita semantică/manuală din 0246 rămân deschise. Nu este certificare integrală în producție; lotul nu a fost publicat în producție.

Verificare suplimentară: **289/289 regresii Firestore**, lint, paritate, inventarul reproductibil și buildul final (TypeScript, 227 pagini) trecute.

## Lot prospectare — continuare după clarificare și rezultat de apel

Scenariile **0254, 0255, 0256 și 0258** au dovezi locale noi. Pentru 0254 și 0255 proba trece prin `chatTurn`: comanda originală, clarificarea salvată, răspunsul agentului, tranzacția reală pe Firestore local și confirmarea finală din conversație. Nu se salvează nimic înainte ca agentul să precizeze statusul sau rezultatul lipsă. Răspunsul scurt continuă autorizarea solicitării numai pentru același prospect și în următorul schimb; anularea nu moștenește autorizarea.

Au fost corectate alegerea nejustificată a statusului „preluat”, oprirea la limita de tokenuri înainte de primul apel al continuării și pierderea autorizării din cererea inițială. Instrumentele inițiale ale continuării sunt limitate la fluxul prospectului, cu descoperirea altor instrumente disponibilă. Refuzul se salvează ca rezultat negativ și notă; colaborarea are statusul distinct. `appendNote` păstrează istoricul și refuză trunchierea; confirmarea descrie câmpurile salvate. Reluarea aceleiași cereri nu repetă modificarea.

Versiuni **jarvis-69 / request-crm-12 / tools 95**. Au trecut **7 probe cu model real** (4 originale noi și 3 regresii) și **2.189 teste locale**. Dovezi: [PROSPECTING_EXECUTION_BATCH_02.json](evals/PROSPECTING_EXECUTION_BATCH_02.json). Total **99/1000 cu dovezi locale**, **901 fără rezultat local verificat**. Scenariul 0257 (follow-up programat) și limita semantică/manuală din 0246 rămân deschise. Nu este certificare integrală în producție; lotul nu a fost publicat în producție.

Verificările Firestore au trecut: **288/288**, inclusiv salvarea concurentă și reluarea fără dublarea notei. Lint, paritate, inventarul reproductibil și buildul final (TypeScript, 227 pagini) au trecut.

## Lot prospectare — citire, recomandare și preluare

Scenariile originale **0251–0253** au rezultat verificat cu model real și Firestore local: afișarea prospectelor active fără rezultat de contact înregistrat, recomandarea justificată a primului prospect de sunat și preluarea prospectului selectat. Nu se deduce lipsa oricărui apel anterior din lipsa unui rezultat în CRM și nu se inițiază apeluri pentru o cerere de recomandare.

Citirea listei agenției completează titlul și telefonul din anunțul original publicabil, păstrând prioritatea datelor locale. Preluarea solicitată este executată fără activarea separată a autonomiei, cu protecțiile existente pentru alt agent și revizia înregistrării. Confirmarea vine din rezultatul tranzacției salvate. Reluarea aceleiași cereri nu repetă modificarea.

Versiuni: **jarvis-68 / request-crm-11 / tools 94**. Dovezi: [PROSPECTING_EXECUTION_BATCH_01.json](evals/PROSPECTING_EXECUTION_BATCH_01.json). Total: **95/1000 cu dovezi locale**, **905 fără rezultat local verificat**, fără certificare integrală în producție. Limitarea scenariului 0246 privind duplicatele semantice/manuale rămâne deschisă. Modificările acestui lot nu au fost publicate în producție.

Validare: **2.185 teste locale**, **3 scenarii cu model real**, lint și paritate trecute. Regresiile Firestore existente au trecut (286); testul nou de izolare/revizie a trecut la rerularea celor 4 teste de prospectare după corectarea unei date invalide din fixture. TypeScript și generarea celor 227 de pagini au trecut.

## Lot proprietari — listă de prospectare executată integral

Lotul **0246–0250** adaugă dovezi locale pentru **0247–0250**, în timp ce **0246 rămâne parțial**: eliminarea importurilor cu referințe exacte funcționează, dar duplicatele semantice/manuale fără referințe nu sunt acoperite. Nici probele 0247, 0248 și 0250 nu certifică acea detecție generală.

În **0249**, modelul real găsește șapte oferte și aplicația le adaugă efectiv în prospectare prin handlerul existent. Solicitarea explicită autorizează `owner_prospect:add` fără opțiune separată și fără oprirea după patru adăugări. Previzualizarea, negația, eliminarea și reîncercarea rămân distincte. Executorul recitește lista agenției și confirmă numai adăugările active; răspunsul final folosește aceste dovezi. Toate cele șapte ID-uri sunt salvate și confirmate, iar reluarea aceleiași cereri reutilizează rezultatele fără dubluri. Nu sunt trimise mesaje sau efectuate preluări externe de telefon în această probă.

Au fost eliminate apeluri redundante de contract pentru prospectare și filtrarea de an nesolicitată. Planurile validate care combină citiri confirmate cu acțiuni pregătite se păstrează când numai apelul final de formulare depășește bugetul; cerințele neacoperite nu devin succes. Versiuni: prompt **jarvis-67**, tools **94**, policy **request-crm-10**.

Validare: **2.183 teste locale**, **286 regresii Firestore**, **7 probe cu model real** (4 scenarii originale cu rezultat verificat, 1 original parțial declarat corect, 2 regresii pentru chirii), lint, paritate și build (TypeScript, 227 pagini) trecute. Dovezi: [OWNER_SEARCH_EXECUTION_BATCH_09.json](evals/OWNER_SEARCH_EXECUTION_BATCH_09.json). Total: **92/1000 scenarii originale cu dovezi locale**, **908 fără rezultat local verificat**; nu este certificare integrală în producție. Scenariul 0246 nu crește totalul. Nicio publicare în producție.

## Lot proprietari — ani lipsă separați și referințe de import CRM

Scenariile originale **0241–0245** au dovezi locale cu model real pentru separarea anilor lipsă, căutarea etichetei declarate „după 1977”, separarea anilor necunoscuți la buget și excluderea importurilor CRM prin referințe exacte. Pentru **0245**, acestea nu certifică eliminarea duplicatelor introduse manual sau semantice fără referințe sursă.

Primele probe 0241–0242 au arătat că modul larg `unknownYear=include` aducea și intervale declarate parțial suprapuse, deși cererea solicita doar potriviri confirmate și an lipsă. A fost implementat `include_missing`, care păstrează anii și intervalele compatibile plus lipsa dovezii de an; intervalele parțiale rămân excluse. Modurile `include` și `only` își păstrează sensul anterior. Schema, descrierea instrumentului și un test dedicat verifică diferența. Versiuni: prompt **jarvis-65**, tools **93**.

După corecție, 0241–0242 afișează separat patru potriviri și două anunțuri fără an. 0243 păstrează doar eticheta explicită, inclusiv normalizarea „după 1977”/`after_1977`; 0244 separă corect lipsa anului la plafon inclusiv de 150.000 EUR. 0245 exclude trei importuri prin ID, URL sursă și URL original, inclusiv un import CRM inactiv, și păstrează oferta nouă. Limitarea comparației exacte este explicată în răspuns.

Validare: **2.180 teste locale**, **7 probe cu model real** (5 originale și 2 regresii pentru chirii), lint, paritate și build (TypeScript, 227 pagini) trecute. Raportul păstrează primele execuții și cele corectate: [OWNER_SEARCH_EXECUTION_BATCH_08.json](evals/OWNER_SEARCH_EXECUTION_BATCH_08.json). Total: **88/1000 scenarii originale cu dovezi locale folosind model real**, **912 fără asemenea dovezi**; nu este acceptanță integrală a fiecărui scenariu în toate variantele. Cele 83 anterioare nu au fost rerulate. Nicio publicare în producție și niciun mesaj către clienți.

## Lot proprietari — alternative de camere și căutare indiferent de an

Scenariile originale **0236–0240** au trecut cu model real și Firestore local: apartamente cu două sau trei camere, proprietăți cu una/două ori trei/patru camere și două camere fără filtru de an, inclusiv cu buget. Au fost corectate două probleme reale: răspunsul enumera șapte oferte deși cardurile conțineau opt; o cerere generică de proprietăți era restrânsă la apartamente și omitea o casă eligibilă.

Căutarea transmite acum totalul explicit al paginii (`returnedCount`), iar instrucțiunile cer total și enumerare concordante. Probele verifică și numărul spus și fiecare titlu din enumerare, nu doar cardurile. Descrierea parametrului de tip și a instrumentului păstrează toate tipurile pentru „proprietăți”, chiar când se cere număr de camere. Comparația importurilor CRM poate fi descrisă ca executată numai în prezența dovezii `crmComparison`. Versiuni: prompt **jarvis-64**, tools **92**.

Validare: **7 probe cu model real** (5 originale, 2 regresii pentru chirii), **2.179 teste locale**, **64 teste țintite finale**, lint, paritate și build (TypeScript, 227 pagini) trecute. Suita completă precedă ultima clarificare a descrierii tipului; probele reale și testele țintite folosesc versiunea finală. Dovezi și execuții inițiale: [OWNER_SEARCH_EXECUTION_BATCH_07.json](evals/OWNER_SEARCH_EXECUTION_BATCH_07.json). Total: **83/1000 scenarii originale cu dovezi locale folosind model real**, **917 fără asemenea dovezi**. Cele 78 anterioare nu au fost rerulate în acest lot. Nu este certificare în producție sau verificare a actualității portalurilor externe. Nicio publicare în producție și niciun mesaj către clienți.

## Lot proprietari — prag de construcție versus etichetă declarată

Scenariile originale **0231–0235** verifică două/trei camere în Titan, Cișmigiu, Floreasca și Pipera, cu bugete și construcție după 1977/2000/2010. Prima probă 0231 a detectat o eroare reală: modelul adăuga filtrul de etichetă `after_1977` la o cerere obișnuită „după 1977” și omitea cinci oferte eligibile cu ani exacți sau intervale închise. Instrucțiunile de planificare, descrierea instrumentului și descrierea parametrului precizează acum diferența: pragul folosește `yearMin=1978`, iar filtrul de etichetă se aplică numai dacă eticheta este cerută explicit. Numărul de camere nu reprezintă numărul ofertelor solicitate. Versiuni: prompt **jarvis-62**, tools **90**.

După corecție, toate cele **15 comenzi originale 0221–0235** și **2 regresii pentru chirii** au trecut. Sunt verificate rezultatele exacte, normalizarea Cișmigiu/Cismigiu, ambele limite ale bugetului, anii structurați și intervalele, paginarea după 250 de înregistrări și lipsa modificărilor în date. Dovezile păstrează și execuția inițială eșuată: [OWNER_SEARCH_EXECUTION_BATCH_06.json](evals/OWNER_SEARCH_EXECUTION_BATCH_06.json). O observație de redactare rămâne în raport: un răspuns a menționat generic comparația importurilor CRM fără să o execute; acest lot nu certifică acea comparație.

Validare: **2.179 teste locale**, **17 probe cu model real**, lint, paritate și build (TypeScript, 227 pagini) trecute. Total: **78/1000 scenarii originale cu dovezi locale folosind model real**, **922 fără asemenea dovezi**. Nu este certificare integrală în producție sau verificare a actualității portalurilor externe. Nicio publicare în producție și niciun mesaj către clienți.

## Lot proprietari — intervale de ani și filtre combinate

Scenariile originale **0226–0230** au trecut cu model real și Firestore local: trei camere după 2000 în Floreasca, apartamente din 1980–1990 în Titan, proprietăți înainte de 1990 în Drumul Taberei și două camere în Titan cu buget și prag de construcție. Implementarea existentă satisface acest lot; modificările adaugă probe executabile și dovezi, fără schimbări ale comportamentului aplicației.

Intervalul 1980–1990 include ambele capete; „înainte de 1990” exclude anul 1990. Anii necunoscuți, renovarea și intervalele doar parțial compatibile sunt excluse. Prețul-limită rămâne inclus, iar regulile finale pentru chirii sunt păstrate. Probele verifică setul exact de rezultate după peste 250 de înregistrări, linkurile sursă, dovezile de an și lipsa modificărilor în date. Răspunsurile finale au fost inspectate și disting intervalele declarate de anii exacți.

Validare: **7 probe cu model real** (5 originale și 2 regresii pentru chirii), **36 teste ale căutării**, lint și verificarea inventarului. Buildul nu a fost rerulat: s-au schimbat doar probele și documentarea. Dovezi: [OWNER_SEARCH_EXECUTION_BATCH_05.json](evals/OWNER_SEARCH_EXECUTION_BATCH_05.json). Total: **73/1000 scenarii originale cu dovezi locale folosind model real**, **927 fără asemenea dovezi**. Cele 68 anterioare nu au fost rerulate în acest lot. Nu este certificare în producție sau verificare a actualității portalurilor. Nicio publicare în producție și niciun mesaj către clienți.

## Lot proprietari — anul construcției și regula finală pentru chirii

Clarificarea utilizatorului din 11 octombrie înlocuiește regula anterioară pentru cererile fără tranzacție: **fără buget și fără cerere explicită de chirie, se afișează numai vânzări**. Închirierile sunt eligibile când agentul cere explicit chirie/închiriere sau bugetul este de cel mult 10.000 EUR (pragul inclusiv stabilit anterior). Oricare limită de buget peste 10.000 selectează numai vânzări. Anul construcției nu reprezintă buget. Regula serverului este comună căutării și relevanței alertelor salvate; prețul-limită rămâne inclus.

Scenariile originale **0221–0225** au trecut cu model real: apartamente după 1977/1990/2000, inclusiv filtre de două/trei camere și zonele Titan, Drumul Taberei, Pipera. Câmpurile textuale goale nu mai ascund anul numeric structurat. Intervalele declarate au prioritate față de numere derivate și nu devin ani exacți. Anii prea vechi, anul exact de la prag, intervalele parțial suprapuse, necunoscutele și anul renovării sunt excluse din rezultatele cerute. Răspunsurile finale disting anii exacți de intervalele declarate.

Au fost rerulate **toate cele 25 de comenzi originale 0201–0225** după clarificarea regulii de tranzacție; toate au trecut. Două probe suplimentare au confirmat chiria explicită și cererea cu buget de 900 EUR. Aceste variante nu cresc numărul scenariilor originale. Dovezi: [OWNER_SEARCH_EXECUTION_BATCH_04.json](evals/OWNER_SEARCH_EXECUTION_BATCH_04.json), prompt jarvis-61 / tools 89. Rapoartele anterioare păstrează istoricul regulilor de la momentul respectiv; rezultatele actuale sunt cele din acest lot.

Validare: **2.179 teste locale**, **27 probe cu model real**, lint, paritate și build (TypeScript, 227 pagini) trecute. Nicio trimitere de mesaje sau modificare a datelor reale ale agențiilor. Total: **68/1000 scenarii originale cu dovezi locale folosind model real**, **932 fără asemenea dovezi**. Nu este certificare integrală în producție și nu verifică actualitatea portalurilor externe. Lotul nu este publicat în producție.

## Lot proprietari — intervale de preț și garsoniere

Scenariile originale **0216–0220** au trecut cu model real și Firestore local, prompt jarvis-58 / tools 87: proprietăți în Aviației între 150.000–250.000 EUR, două camere în Drumul Taberei între 80.000–120.000, trei camere în Berceni, patru camere în Titan și garsoniere în Titan până la 80.000. Raport: [OWNER_SEARCH_EXECUTION_BATCH_03.json](evals/OWNER_SEARCH_EXECUTION_BATCH_03.json).

Ambele limite ale intervalului sunt incluse; rezultatele cu un cent în afara intervalului, închirierile la aceste bugete, monedele necunoscute și anunțurile cu alt număr de camere sunt excluse. Garsonierele declarate în câmpurile structurate prin „garsonieră” sau „o cameră” sunt interpretate ca o cameră; mențiunea din titlu nu schimbă două camere în una. Intervalele ambigue precum „1–2” rămân necunoscute, nu devin un număr exact. Același parser furnizează filtrul, numărul afișat și proiecția indexată.

Proiecția de căutare trece la versiunea 3. Până când toate anunțurile eligibile au noua proiecție, serverul folosește scanarea paginată a datelor actuale, cu limitele și cursorul existente, în loc să omită anunțurile din indexul vechi. Testele acoperă atât căutarea indexată, cât și revenirea la scanare. La publicare, scriptul existent `scripts/backfill-owner-search-index.mjs` poate actualiza proiecțiile la versiunea 3 (dry-run implicit, apoi `--apply`, cu protecție pentru modificări concurente). Nu a fost executat pe producție în acest lot.

Validare: **2.177 teste locale trecute**, **5 comenzi originale cu model real**, lint, paritate și build final (TypeScript, 227 pagini) trecute. Probele verifică exact rezultatele, linkurile sursă, răspunsul final și lipsa modificărilor în anunțuri. Nu au fost trimise mesaje sau folosite datele reale ale agențiilor. Total: **63/1000 scenarii originale cu dovezi locale folosind model real**, **937 fără asemenea dovezi**; cele 58 anterioare nu au fost rerulate cu model real în acest lot. Nu este certificare de producție sau a colectării de pe portalurile externe. Lotul nu este publicat în producție.

## Lot proprietari — zone și bugete, regula comercială din 11 octombrie 2026

Scenariile originale **0206–0215** au trecut cu model real și Firestore local; **0201–0205** au fost rerulate ca regresie. Raport: [OWNER_SEARCH_EXECUTION_BATCH_02.json](evals/OWNER_SEARCH_EXECUTION_BATCH_02.json), prompt jarvis-57 / tools 86. Sunt acoperite Pipera, Aviației, Drumul Taberei, Berceni, Militari și cererile cu buget din Titan, Cișmigiu, Floreasca și Pipera.

Conform regulii explicite a utilizatorului, **prețul-limită este inclus**, chiar pentru formularea „sub”. Dacă oricare dintre limitele bugetului cerut depășește **10.000 EUR**, căutarea returnează **doar vânzări**. Închirierile sunt eligibile numai cu preț cunoscut în EUR de cel mult 10.000. Fără buget sau la un buget de cel mult 10.000, tranzacția explicită este respectată; în lipsa ei sunt eligibile ambele. Regula se aplică pe server atât scanării, cât și căutării indexate, precum și relevanței alertelor salvate, inclusiv dacă modelul propune greșit închiriere pentru un buget mare. Rezultatul indică tranzacția efectiv aplicată.

Prima rulare a returnat corect cardurile, dar răspunsurile text pentru 0211/0212/0214 eliminau oferta de la limita exactă. Aceste încercări sunt respinse în raport, chiar dacă vechile aserțiuni trecuseră. Instrucțiunile comerciale și verificarea textului final au fost întărite. Rularea finală a trecut toate cele 15 comenzi și include prețul exact în răspuns, fără declarații contradictorii de excludere.

Verificare: 193 teste țintite; suita completă a avut 2.173 trecute și un timeout de încărcare în planner, urmat de rerularea reușită a tuturor celor 28 de teste din acel fișier. Lint, verificarea parității și buildul final (TypeScript, 227 pagini) au trecut. Nu au fost trimise mesaje sau modificate date reale ale agențiilor. Totalul este **58/1000 scenarii originale cu dovezi locale folosind model real**, **942 fără asemenea dovezi**, fără certificare integrală de producție sau a portalurilor externe. Acest lot nu este publicat în producție.

## Lot proprietari — căutări în Titan, Cișmigiu și Floreasca

Scenariile originale **0201–0205** au trecut cu model real, planificatorul aplicației și Firestore local (prompt jarvis-55 / tools 85). Dovezi: [OWNER_SEARCH_EXECUTION_BATCH_01.json](evals/OWNER_SEARCH_EXECUTION_BATCH_01.json). Jarvis găsește anunțurile de proprietari în zona cerută, aplică numărul de camere și tipul apartament numai când sunt cerute și returnează linkurile sursă.

Căutarea nu mai presupune vânzarea când cererea nu precizează tranzacția. Atât scanarea, cât și căutarea indexată includ vânzări și închirieri; un filtru explicit rămâne respectat. Tipul tranzacției este păstrat în rezultatele oferite modelului. Potrivirea zonelor folosește cuvinte întregi normalizate: Cișmigiu/Cismigiu sunt echivalente, Titan/Titanium nu. Anunțurile care menționează zona doar în titlu, cele nepublicate/necanonice și cele din alt oraș nu sunt rezultate eligibile.

Fiecare probă cu model real plasează rezultatele după peste 260 de anunțuri nepotrivite, verifică exact ID-urile și linkurile returnate și recitește datele pentru a confirma că nu au fost modificate. Scenariile pentru două/trei camere includ și anunțuri cu număr de camere sau tip greșit. Nu sunt trimise mesaje și nu este accesat CRM-ul de producție.

Validare finală: **2.158 teste locale**, **286 regresii pe emulator**, **5 comenzi originale cu model real**, lint, inventare și build cu TypeScript/227 pagini trecute.

Total: **48 de scenarii originale cu dovezi locale folosind model real**, **952 fără această dovadă**. Cele 43 de scenarii live anterioare nu au fost rerulate. Aceste probe nu certifică actualitatea portalurilor externe sau identitatea reală a autorului anunțului: folosesc anunțuri locale eligibile conform fluxului existent de colectare. Lotul nu este încă publicat în producție.

## Lot calendar — ordinea activităților de mâine, fără schimbarea programărilor

Scenariul original **0200**, „Optimizează-mi ordinea activităților de mâine fără să schimbi programările existente.”, a trecut cu model real și Firestore local, prompt jarvis-54 / tools 84. Dovezi: [CALENDAR_EXECUTION_BATCH_17.json](evals/CALENDAR_EXECUTION_BATCH_17.json). Jarvis recitește calendarul agentului și propune o ordine cronologică, separând programările fixe de sarcinile fără oră. Orele existente, inclusiv cele din afara ferestrei orientative sau începute în seara precedentă, sunt păstrate. Nu se fac scrieri și nu se trimit mesaje.

Pentru sarcinile fără oră este folosită explicit o fereastră orientativă 09:00–18:00 București. Duratele lipsă sunt declarate: 30 minute pentru sarcini, 60 pentru vizionări. Se rezervă orientativ 15 minute înainte și după vizionări; sarcinile mai scurte sunt încercate întâi în primul interval suficient, fără fragmentare. Suprapunerile existente și activitățile care nu încap sunt raportate. Aceasta este o recomandare de organizare, nu un optim matematic, rezervare de interval sau calcul al deplasărilor. Datele invalide și depășirea limitelor de citire/afișare nu produc un plan declarat complet.

Proba reală a păstrat vizionarea de la 10:00 și apelul de la 12:00, a propus două sarcini la 09:00 și 13:00 și a explicat de ce un raport de 10 ore nu încape. Numele și titlul proprietății sunt recitite; testul compară integral calendarul înainte și după. Prima încercare a omis eticheta București în text și a fost respinsă; raportul păstrează încercarea și proba finală trecută.

Validare: **2.149 teste locale**, **286 regresii Firestore**, apoi **comanda originală cu model real trecută** după corecția prezentării. Ulterior, **21 de teste țintite** au verificat și cardul final: ore locale lizibile, fără afișarea marcajelor numerice interne. Lint și paritatea au trecut. Cele 42 de scenarii live anterioare nu au fost rerulate. Total: **43 de scenarii originale cu dovezi locale folosind model real**, **957 fără această dovadă**. Acest lot este ulterior publicării din 8 octombrie și nu este încă în producție.

Buildul final, după corecția cardului, a trecut cu TypeScript și generarea celor 227 de pagini. Inventarul reproductibil confirmă 43 de legături de evaluare locală, fără certificări integrale de producție.

## Lot calendar — bilanțul activităților de azi

Scenariul original **0199**, „Ce am ratat astăzi?”, a trecut cu model real și Firestore local, prompt jarvis-53 / tools 83. Dovezi: [CALENDAR_EXECUTION_BATCH_16.json](evals/CALENDAR_EXECUTION_BATCH_16.json). Instrumentul recitește calendarul agentului și separă sarcinile deschise cu ora depășită, sarcinile de azi fără oră și vizionările al căror interval s-a încheiat fără rezultat înregistrat. Nu declară neexecutarea sau neprezentarea pe baza acestor stări; confirmarea WhatsApp nu dovedește efectuarea vizionării. Activitățile viitoare, în desfășurare, anulate/finalizate, din alte zile sau ale altui agent sunt excluse. Întrebarea nu modifică statusuri, nu creează taskuri și nu trimite mesaje.

Bilanțul este limitat explicit la calendarul CRM. Citirea este paginată și semnalează datele invalide sau scanarea incompletă, fără a prezenta un calendar gol ca rezultat certificat. Numele clientului și titlul proprietății sunt recitite. Orele activităților și momentul verificării sunt calculate în București. O sarcină fără oră nu este tratată drept întârziată; o oră locală ambiguă necesită clarificare, iar un moment ISO explicit este păstrat inclusiv în ora repetată la trecerea la ora de iarnă.

Prima probă a selectat corect activitățile, dar examinarea răspunsului a descoperit ora internă prezentată greșit ca oră București. Raportul păstrează încercarea respinsă; implementarea oferă acum separat momentul local, iar proba finală verifică și ora afișată, nu doar existența cuvântului București.

Validare: **2.140 teste în suita locală**, apoi **8 teste țintite** pentru clasificare și ore; **286 probe Firestore/model real** în prima rulare, urmate de **70 probe finale** pentru calendar și comanda originală după corecția orei. Lint și inventarele au trecut. Cele 41 de scenarii live anterioare nu au fost rerulate. Total: **42 de scenarii originale cu dovezi locale folosind model real**, **958 fără această dovadă**. Nu este certificare integrală în producție și nu a existat trimitere reală WhatsApp.

Buildul final a trecut, inclusiv TypeScript și cele 227 de pagini. Acest lot nu a fost publicat în producție.

## Lot calendar — prioritizarea vizionărilor după răspunsurile participanților

Scenariul original **0198**, „Spune-mi care dintre ele au risc mai mare de no-show.”, a trecut cu model real și Firestore local, prompt jarvis-52 / tools 82. Dovezi: [CALENDAR_EXECUTION_BATCH_15.json](evals/CALENDAR_EXECUTION_BATCH_15.json). Jarvis compară exclusiv ultima listă afișată în conversație (maximum 100 de vizionări), inclusiv din contextul compactat, și recitește programările și răspunsurile WhatsApp actuale. Fără listă cere clarificare; instrumentul nu acceptă ID-uri alese de model. O listă goală mai nouă invalidează selecția veche.

Refuzul explicit sau cererea de reprogramare au prioritate de intervenție. Problemele semnalate de proprietar privesc accesul, separat de participarea cumpărătorului. Confirmarea lipsă, neclară sau devenită veche cere verificare și nu este tratată ca refuz. Confirmarea ambilor participanți nu garantează prezența. Rezultatul explică motivele și orele din București, fără procente inventate. Programările anulate, trecute sau inaccesibile sunt excluse explicit; o eroare de infrastructură nu este convertită în „confirmare lipsă”. Evaluarea nu modifică CRM și nu trimite mesaje.

Proba cu model real folosește intenționat un istoric cu stări vechi: rezultatul recunoaște refuzul actual, confirmarea nouă și dovada invalidată prin reprogramare, fără includerea altor programări. Proba fără context cere clarificare. Verificări: **2.133 teste locale**, **285 probe Firestore și model real**, lint pentru fișierele modificate și verificările inventarului/parității. Cele 40 de scenarii live anterioare nu au fost rerulate. Total: **41 de scenarii originale cu dovezi locale folosind model real**, **959 fără această dovadă**, zero certificări integrale în producție. Aprobarea Meta și proba cu WhatsApp real rămân necesare.

Buildul final a trecut, inclusiv TypeScript și generarea celor 227 de pagini. Modificările din acest lot nu au fost publicate în producție.

## Lot calendar — confirmarea participanților prin WhatsApp

Cerință explicitată de utilizator: clientul și proprietarul confirmă prin răspuns la șablonul WhatsApp, după aprobarea aplicației Meta. Declarația agentului și stările trimis/livrat/citit nu confirmă participarea. Implementarea de confirmare manuală începută în acest lot a fost eliminată.

Scenariul **0197** a trecut cu model real și Firestore local: lista conține exact patru programări fără confirmarea actuală a ambilor participanți, inclusiv un refuz și o confirmare devenită veche. Cele complet confirmate, anulate, efectuate, ale altui agent sau din altă zi sunt excluse. Cinci formulări libere au fost interpretate cu modelul real: acceptare, refuz, altă oră, condiție și simplu mulțumesc. Dovezi: [CALENDAR_EXECUTION_BATCH_14.json](evals/CALENDAR_EXECUTION_BATCH_14.json).

Trimiterea păstrează legătura dintre șablon, vizionare și participant; verifică telefonul și datele actuale înaintea punerii în coadă și înaintea apelului Meta. Webhookul păstrează referința mesajului la care s-a răspuns. Workerul salvează separat pentru client și proprietar confirmat/refuzat/solicită reprogramare/neclar, cu identificatorii mesajelor sursă. Reprogramarea nu se execută automat. Răspunsurile duplicate sunt idempotente, cele mai vechi nu suprascriu răspunsuri noi, iar răspunsurile contradictorii cu același timestamp rămân neclare. Reprogramarea prin executor invalidează confirmările și șabloanele anterioare, inclusiv după revenirea la ora inițială.

Un răspuns fără citat poate fi legat numai de o singură programare activă identificabilă în conversație. La mai multe programări sau la scanarea incompletă a istoricului, Inbox afișează necesitatea clarificării. Pentru text liber se folosește modelul fără instrumente de execuție; indisponibilitatea lui nu păstrează fals o confirmare anterioară, ci lasă starea necunoscută și reîncearcă. Fișierele audio/imagine nu sunt interpretate în acest lot. Nicio trimitere reală nu a fost efectuată.

Inbox afișează rezultatul lângă mesaj, pe mobil și desktop. Regulile Firestore păstrează citirea vizionărilor pentru agenție, dar scrierile trec prin executorul CRM existent; browserul nu poate falsifica dovada WhatsApp. Nu sunt necesare acțiuni de acordare a permisiunilor CRM din partea agenților.

Validare: **2.125 teste locale**, **280 probe Firestore și model real** în rularea combinată; ulterior **17 probe țintite** (8 WhatsApp și 9 reguli Firestore) au trecut cu cazurile suplimentare și protecția finală. Lint, inventarele și buildul cu TypeScript/227 pagini au trecut. Cele 39 de scenarii live anterioare nu au fost rerulate. Total: **40 de scenarii originale cu dovezi locale folosind model real**, **960 fără această dovadă**. Nu este certificare în producție, pe voce sau cu Meta real; aprobarea și proba reală WhatsApp rămân necesare.

Configurarea șablonului: corpul trebuie să solicite confirmarea și să conțină titlul proprietății, data DD.MM.YYYY sau YYYY-MM-DD și ora HH:mm din București. Exemplu: „Confirmați vizionarea {{1}}, {{2}}, ora {{3}}, București.” Butoanele pot fi „Confirm vizionarea”, „Nu pot veni”, „Reprogramează”. Trimiterea prin message_send include viewingConfirmation={viewingId, participant:client|owner}; fără această legătură, un mesaj generic nu constituie solicitare de confirmare urmărită. Aprobarea Meta și verificările existente de canal/șablon/destinatar rămân active.

## Lot calendar — mesaje de confirmare pentru client și proprietar

Scenariile originale **0195–0196** au trecut cu model real și Firestore local (prompt jarvis-50 / tools 80), fără opt-in separat. Dovezi: [CALENDAR_EXECUTION_BATCH_13.json](evals/CALENDAR_EXECUTION_BATCH_13.json). Rezultatul cerut este mesajul integral pregătit și netrimis, pentru vizionarea selectată în conversație. Nu reprezintă trimiterea mesajului sau confirmarea participării.

Instrumentul recitește vizionarea, clientul și proprietatea. Probele folosesc intenționat un istoric vechi: mesajele finale conțin ora actuală **18:00, București**, numele actuale și adresa Strada Teiului 10. Proprietarul folosește identitatea și telefonul proprietarului, fără substituirea cumpărătorului. Datele lipsă sunt semnalate; o vizionare anulată, efectuată, trecută, cu relații lipsă sau proprietate inactivă nu produce mesaj de confirmare.

Proba fără selecție a expus o alegere arbitrară a modelului pentru 0196. Verificarea este acum în aplicație: ID-ul trebuie să provină din ultima selecție neambiguă anterioară comenzii sau să fie indicat explicit în cerere. O listă nouă cu mai multe rezultate invalidează o selecție mai veche; rezultatele căutării din turul curent nu autorizează alegerea automată. Încercarea nereușită este păstrată în raport. Ambele probe fără selecție cer acum clarificare.

Verificările compară integral colecțiile de vizionări, clienți și proprietăți înainte și după. Nu apar taskuri, execuții, joburi sau mesaje în communicationOutboundJobs. Regresia Firestore verifică datele actuale, anularea și izolarea agenției. Testele locale acoperă separat selecția ambiguă, contextul compactat și blocarea efectivă în dispatcher.

Validare: **2.106 teste în suita locală completă**, plus **două teste noi de dispatcher** (fișierul cu toate cele 11 teste a trecut separat); 322 teste condiționate de alte medii nu sunt numărate ca trecute. **272 regresii Firestore și două comenzi originale cu model real** au trecut împreună. Cele 37 de scenarii live anterioare nu au fost rerulate.

Lint, inventarele și buildul final cu TypeScript și 227 de pagini au trecut.

Total curent: **39 de scenarii originale cu dovezi locale folosind modelul real**, **961 fără această dovadă**. Nu este certificare integrală, în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — disponibilitate și primul interval potrivit

Scenariile originale **0192–0193** au trecut cu model real și Firestore local (prompt jarvis-49 / tools 79), fără opt-in separat. Dovezi: [CALENDAR_EXECUTION_BATCH_12.json](evals/CALENDAR_EXECUTION_BATCH_12.json). 0192 găsește exact golurile 17:00–17:30 și 18:30–00:00 din calendarul agentului pentru mâine după 16:00. Textul și cardurile afișează orele din București și precizează că limita implicită este sfârșitul zilei, nu programul de lucru.

Pentru 0193 contextul furnizează explicit clientul, proprietatea, ziua de mâine, fereastra 16:00–20:00 și durata de 60 de minute. Taskul agentului și vizionarea existentă blochează prima parte; o vizionare a proprietății cu alt agent blochează 18:30–19:00. Jarvis salvează vizionarea la **19:00**, confirmă ora din receipt și păstrează toate înregistrările anterioare. Replay-ul aceleiași cereri nu creează încă o vizionare.

`calendar_availability` calculează intervalele pe server, unind suprapunerile și comparând instanții reali, inclusiv date cu offset diferit. Pentru o întrebare personală verifică agentul; pentru programare verifică suplimentar clientul și proprietatea. Taskurile open cu oră și vizionările scheduled ocupă calendarul; taskurile fără oră sunt numărate separat, fără a bloca artificial întreaga zi. Clientul și proprietatea sunt citite și autorizate în același instrument; o proprietate inactivă nu produce suggestedViewing.

`schedule_viewing.firstAvailable` păstrează fereastra autorizată, ale cărei două limite sunt verificate de politica temporală. Executorul recalculează primul interval în tranzacția de salvare și folosește blocarea existentă a calendarului. Două cereri concurente au salvat intervale distincte, la 18:00 și 19:00, fără suprapunere; reluarea aceleiași cereri păstrează un singur efect. Marcajul nu se persistă în vizionare. O cerere pentru o oră fixă nu autorizează automat alegerea altei ore.

Limite explicite: disponibilitate în CRM, fără calendare externe, confirmarea participanților sau timp de deplasare. Fereastra are maximum 25 de ore pentru ziua cu schimbare de oră. Citirea este limitată la 5.000 de documente din fiecare colecție; la depășire sau date calendaristice invalide pentru înregistrări active relevante, nu sunt propuse intervale ca fiind confirmate. Lipsa unui interval potrivit nu permite extinderea ferestrei fără o nouă cerere. 0194 nu este numărat separat doar pentru că protecția suprapunerilor există.

Încercările anterioare 0193 sunt păstrate: prima a repetat citiri și contracte deja verificate, atingând bugetul înainte de goal_coverage. Instrumentul returnează acum identitățile și sugestia completă, iar instrucțiunile folosesc direct acest rezultat, fără relaxarea bugetelor. A doua a salvat corect vizionarea, dar testul aștepta greșit cinci înregistrări în loc de patru; aserțiunea verifică acum totalul anterior plus unu și păstrarea fiecărei vizionări anterioare. Rularea combinată și cea finală cu afișarea cardurilor au trecut.

Validare: **2.094 teste locale**, **271 regresii Firestore și două comenzi cu model real** (273 trecute împreună), inclusiv concurență, replay, ziua de 25 de ore, scanare parțială și limite temporale neverificate. Cele 319 teste locale condiționate de alte medii nu sunt incluse în numărul de teste trecute. Lint, inventarele și buildul final cu TypeScript și 227 de pagini au trecut.

Total curent: **37 de scenarii originale cu dovezi locale folosind modelul real**, **963 fără această dovadă**. Cele 35 de scenarii live anterioare nu au fost rerulate. Nu este certificare integrală, în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — participantul și proprietatea taskului

Scenariile originale **0189–0191** au trecut cu model real și Firestore local (prompt jarvis-48 / tools 78 / request-crm-8), fără document `assistantPolicies`: task pentru proprietarul proprietății deschise, task pentru clientul deschis și corectarea proprietății asociate unui task selectat. Probe: [CALENDAR_EXECUTION_BATCH_11.json](evals/CALENDAR_EXECUTION_BATCH_11.json). Contextul precizează explicit descrierea, scadența mâine la 10:00 și durata de 30 de minute pentru creări; nu sunt presupuneri despre cererile originale. Probele suplimentare fără aceste detalii cer clarificare și verifică absența scrierilor.

Selecțiile istorice indică intenționat alte înregistrări. Referința paginii curente este verificată pe server și prevalează; taskurile se salvează pentru clientul/proprietatea curentă. `create_task.participantSource` cere executorului să recitească participantul în tranzacție: `property_owner` folosește ownerName/ownerPhone și interzice legarea unui cumpărător; `contact` folosește numele/telefonul clientului CRM. Datele vechi furnizate în acțiune nu suprascriu aceste valori. Telefonul lipsă rămâne nul, iar lipsa completă a identității necesită completarea datelor. Marcajul participantSource nu se persistă.

Crearea cu participant CRM identificat și modificarea exclusivă a `propertyId` sunt autorizate prin cererea agentului, fără opt-in pentru taskurile generale. Negația și cererile de previzualizare nu autorizează execuția; o asociere nu permite automat și schimbarea descrierii sau a scadenței. Rolul, agenția și revizia rămân verificate. Taskurile generale păstrează politica existentă.

0189 salvează proprietarul, fără a crea un client; 0190 salvează clientul curent; 0191 schimbă numai propertyId/propertyTitle și revizia taskului. Confirmările includ relația efectiv salvată. Replay-ul aceleiași cereri produce un singur task/efect. Regresia Firestore verifică și datele actuale ale participantului, păstrarea celorlalte câmpuri la asociere și refuzul relațiilor lipsă sau contradictorii.

Primele două încercări 0189 sunt păstrate în raport: prima a avut goal_coverage invalid și a atins bugetul; a doua a tratat verificarea proprietarului ca rezultat answered separat, apoi a atins bugetul înaintea finalizării. Instrucțiunile leagă acum precondițiile de unica cerință de creare, cu citatul din comanda curentă. Bugetele și validarea acoperirii nu au fost relaxate. Cele trei comenzi au trecut ulterior, apoi au fost reverificate fără opt-in.

Validare finală: **2.088 teste locale** trecute din 186 fișiere (`vitest run --maxWorkers=2`), **270 regresii Firestore și 3 comenzi cu model real** trecute împreună, lint, inventare și build cu TypeScript/227 pagini. Cele 316 teste locale sărite au condiții separate de mediu; nu sunt incluse în numărul de teste trecute. O rulare locală cu paralelism implicit, simultan cu buildul și emulatorul, a avut două timeouturi și zece eșecuri ulterioare în planner; cele două fișiere afectate au trecut separat, apoi suita integrală a trecut cu doi workers, fără relaxarea aserțiunilor sau timeouturilor.

Total curent: **35 de scenarii originale cu dovezi locale folosind modelul real**, **965 fără această dovadă**. Cele 32 de scenarii live anterioare nu au fost rerulate. 0188 rămâne necertificat separat. Nu este certificare integrală, în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — mutarea taskurilor neurgente

Scenariul original **0187**, «Mută taskurile neurgente pentru mâine», a trecut din prima cu model real și Firestore local (prompt jarvis-47 / tools 77). Executorul a mutat toate cele cinci taskuri eligibile, a păstrat ora și durata și a confirmat fiecare salvare. Cele șase taskuri excluse au rămas identice: urgent, scadent azi, deja pentru mâine, asociat unei vizionări de azi, finalizat și atribuit altui agent. Replay-ul nu produce efecte suplimentare. Dovezi: [CALENDAR_EXECUTION_BATCH_10.json](evals/CALENDAR_EXECUTION_BATCH_10.json).

`task_deferral` pregătește toate mutările într-un singur plan. Politica opțională de execuție a taskurilor rămâne necesară și a fost activă în probă. Numai mutările marcate pentru această operațiune pot continua peste limita de patru taskuri, până la plafonul existent de 100 de acțiuni. Executorul recitește în tranzacție taskul și relațiile sale: verifică agentul, starea, revizia, urgența actuală și vizionarea asociată, apoi permite exclusiv scadența de mâine, cu aceeași oră. Marcajul de verificare nu este persistat în task. Proba concurentă confirmă că schimbarea priorității clientului sau mutarea vizionării pentru azi împiedică salvarea unui plan devenit invalid.

Urgența folosește regula explicită din lotul anterior: scadență azi/depășită sau client activ cu prioritate Ridicată. Protecția vizionărilor folosește legătura explicită `viewingId`. Datele/relațiile lipsă ori invalide și orele ambigue la schimbarea orei sunt excluse. Instrumentul cere un clasament complet: peste 100 de rezultate, sau la atingerea plafonului de scanare de 5.000 documente/12 secunde, returnează parțial și nu propune mutări. Aceste limite nu sunt prezentate drept execuție integrală. Protecția cerută de 0188 este implementată, dar comanda originală 0188 nu primește certificare live în acest lot.

Validare: **1.868 teste unitare**, **269 regresii Firestore**, **o comandă originală cu model real**; verificările țintite au fost repetate după întărirea tratării datei invalide. Lint, TypeScript, inventarele și compilarea aplicației (227 pagini) au trecut.

Total curent: **32 de scenarii originale cu dovezi locale folosind modelul real**, **968 fără această dovadă**. Cele 31 de scenarii live anterioare nu au fost rerulate. Nu este certificare integrală, în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — urgență și impact comercial

Scenariile originale **0185–0186** au trecut cu model real și Firestore local, fără erori de instrument (prompt jarvis-46 / tools 76). Dovezi: [CALENDAR_EXECUTION_BATCH_09.json](evals/CALENDAR_EXECUTION_BATCH_09.json). 0185 returnează cele trei taskuri urgente din fixture; 0186 ordonează toate cele opt taskuri deschise proprii și explică motivele. Înregistrările CRM rămân neschimbate: Task nu are câmp de prioritate, iar aceste două cereri produc recomandări ordonate, nu mutații ale unui câmp inventat.

`task_priorities` citește datele actuale ale clienților, proprietăților și vizionărilor asociate, fără folosirea numelor denormalizate vechi. Urgența recomandată înseamnă scadență azi/depășită sau client activ cu prioritate Ridicată. Ordinea comercială este o regulă explicită: ofertă acceptată pentru proprietatea taskului > ofertă în așteptare pentru aceeași proprietate > client în negociere > follow-up legat de vizionare efectuată > client cu prioritate Ridicată > lipsa unui semnal confirmat dintre aceste criterii. Egalitățile folosesc scadența și ID-ul. Nu este model predictiv, scor calibrat, calcul al venitului sau probabilitate de vânzare. Taskurile fără semnale rămân în listă, iar relațiile lipsă sunt indicate.

Ofertele refuzate, ofertele pentru alte proprietăți și clienții pierduți/arhivați nu ridică scorul comercial. Pentru semnalul de ofertă proprietatea trebuie să fie Activ/Rezervat. Legătura unui follow-up trebuie să corespundă clientului/proprietății vizionării efectuate. Termenul depășit poate face urgent un task fără impact comercial dovedit. Datele sunt interpretate în București.

Clasamentul se calculează înainte de paginare (100 rezultate/pagină); proba Firestore folosește 102 taskuri, cu taskul important la finalul ordinii ID-urilor, verifică date actualizate și izolarea agenției. Citirea are plafon de 5.000 documente și buget de 12 secunde verificat între citiri; la depășire returnează explicit parțial, fără clasament global certificat. Ordinea este live și se poate schimba dacă CRM-ul se modifică între pagini.

Validare: **1.866 teste unitare**, **268 regresii Firestore** și cele **două comenzi originale cu model real** trecute. Lint, TypeScript, inventarele și compilarea aplicației (227 pagini) au trecut.

Total curent: **31 de scenarii originale cu dovezi locale folosind modelul real**, **969 fără această dovadă**. Cele 29 de scenarii live anterioare nu au fost rerulate în acest lot. Nu este certificare în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — duplicatul și agenda taskurilor

Scenariile originale **0182–0184** au trecut cu model real și Firestore local, fără erori de instrument (prompt jarvis-45 / tools 75). Dovezi: [CALENDAR_EXECUTION_BATCH_08.json](evals/CALENDAR_EXECUTION_BATCH_08.json). 0182 primește în context ID-ul duplicatului selectat, șterge numai acel task, păstrează originalul cu aceeași descriere, înregistrează copia anterioară în audit și confirmă din receipt «Task șters». Replay-ul aceleiași cereri păstrează un singur efect și un singur audit. Nu se presupune că două descrieri identice autorizează ștergerea ambelor înregistrări.

`delete_task` este disponibil în execuția opțională a sarcinilor, numai la o cerere explicită de ștergere și cu politica de taskuri activată. Nu a fost extinsă autorizarea CRM implicită la toate taskurile generale. Rolul, agenția și revizia înregistrării rămân verificate de executor; selecția/cererea agentului nu autorizează o altă înregistrare.

`task_agenda` citește taskurile open ale agentului. `today` compară ziua locală cu azi; `overdue` include zilele anterioare, inclusiv taskuri mai vechi de 30 zile. Definiția este calendaristică: o oră depășită azi nu mută taskul în categoria zilelor restante. Datele simple YYYY-MM-DD nu se transformă în ziua precedentă, iar ISO cu offset este convertit în București. Datele invalide sunt numărate separat. Citirea continuă prin cursor pe pagini de 100, cu scanare limitată la 5.000 documente/12 secunde între pagini per apel; nu declară lista completă la atingerea plafonului. Proba Firestore verifică 102 taskuri pe două pagini, finalizări, alt agent, date invalide și izolarea agenției.

Validare: **1.863 teste unitare**, **267 regresii Firestore** și cele **3 comenzi cu model real** trecute. Lint, TypeScript, inventarele și compilarea aplicației (227 pagini) au trecut.

Total curent: **29 de scenarii originale cu dovezi locale folosind modelul real**, **971 fără această dovadă**. Cele 26 de scenarii live anterioare nu au fost rerulate în acest lot. Nu este certificare în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — follow-up după vizionare

Scenariile originale **0176–0177**: identificarea vizionărilor efectuate fără sarcină asociată și crearea follow-up-urilor pentru ieri. `viewing_followups` compară vizionările completed ale agentului cu taskurile open/completed legate explicit prin `viewingId`, folosind ziua Bucureștiului. Citește contactul și proprietatea actuale și propune scadența azi fără oră când nu se cere alta. Nu presupune că o sarcină veche fără legătură sau contactarea manuală nu există. Scanarea fiecărei colecții este limitată la 5.000 documente/12 secunde între pagini; rezultatul incomplet nu certifică lista. Relațiile CRM lipsă necesită remediere; nu sunt inventate.

`create_task.viewingId` leagă follow-up-ul de vizionarea efectuată și verifică din nou clientul, proprietatea și agentul în tranzacție. ID-ul determinist și citirea taskurilor asociate împiedică duplicarea pentru două cereri concurente sau pentru o cerere nouă. Un task deja existent produce receipt distinct și confirmarea «deja existent», fără suprascriere. Numai taskurile legate de vizionări primesc autorizarea CRM implicită; taskurile generale păstrează politica existentă.

Proba originală 0177 include șase vizionări efectuate ieri, una cu follow-up deja existent, plus o anulare. Executorul salvează toate cele cinci sarcini lipsă, fără politică assistantPolicies, confirmă fiecare rezultat și păstrează totalul de șase taskuri la reluarea cu alt requestId. 0176 verifică exact cele cinci vizionări fără task asociat. Dovezi și încercări anterioare: [CALENDAR_EXECUTION_BATCH_07.json](evals/CALENDAR_EXECUTION_BATCH_07.json).

Prima rulare 0177 s-a oprit fără execuție la limita de tokens: data serverului nu era inclusă între datele verificate. Plannerul recunoaște acum data calculată de instrument, iar instrucțiunile pregătesc toate sarcinile printr-un singur `propose_actions`, fără creșterea bugetului. Testul concurent inițial depășea timeoutul implicit de 5 secunde; are acum 20 secunde pentru tranzacțiile reale ale emulatorului. Rularea combinată ulterioară a trecut 268/268 (266 regresii + două comenzi cu model real). Inspecția răspunsului 0176 a găsit afișare UTC; instrumentul oferă acum `viewingLocal`, iar proba finală verifică toate cele cinci ore locale și absența UTC/GMT.

Ultima verificare a lotului a trecut **2/2**, fără erori de instrument (prompt jarvis-44 / tools 74). Orele 10:00–14:00 sunt verificate în răspuns, fără UTC/GMT. O încercare intermediară a necesitat repararea goal_coverage; rezultatul pregătirii include acum lista explicită `preparedSteps`, pentru ca modelul să lege toate cele cinci acțiuni de cerere. Nu s-a slăbit validarea acoperirii. Au trecut 1.860 teste unitare; după ultima corecție au fost rerulate cele 39 de teste relevante pentru planner/acoperire și cele două comenzi cu model real. Regresiile Firestore au trecut pe versiunea 72; ultimele schimbări sunt în prezentare și planner. Compilarea finală (227 pagini), TypeScript, lint și inventarele au trecut.

Total curent: **26 de scenarii originale cu dovezi locale folosind modelul real**, **974 fără această dovadă**. Cele 24 de scenarii live anterioare nu au fost rerulate în acest lot. Nu este certificare în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — istoricul unei proprietăți

Scenariile originale **0172–0175** au fost executate cu modelul real și Firestore local: toate vizionările proprietății selectate, cine a vizionat apartamentul din Cișmigiu, numărul vizitelor efectuate și ultima vizită efectuată. [CALENDAR_EXECUTION_BATCH_06.json](evals/CALENDAR_EXECUTION_BATCH_06.json) păstrează prima încercare și rulările finale. Proprietatea este selectată explicit în context pentru 0172/0174/0175; 0173 o identifică prin căutare normalizată, cu titlul CRM fără diacritice. Nu sunt efectuate mutații.

Prima încercare a trecut 3/4: 0173 folosea căutarea de oferte, al cărei filtru obligatoriu de tranzacție excludea înregistrarea. Instrucțiunile și descrierile instrumentelor separă acum identificarea CRM prin `read properties search` de căutarea comercială `search_properties`. Rerularea a trecut **4/4**, fără erori de instrument, cu toate orele răspunsurilor finale în București (prompt jarvis-40 / tools 70).

`property_viewings` citește proprietatea autorizată și vizionările sale pentru toți agenții. `all` păstrează toate stările; modurile istorice folosesc numai `completed`, cu dată validă cel târziu acum. Programările trecute neconfirmate nu constituie dovadă că vizita s-a efectuat. Totalul numără vizionări, nu clienți unici. Ultimul instant este comparat cronologic și păstrează egalitățile. Numele clienților se citesc din contactele actuale, fără reutilizarea numelor copiate vechi. Listele au pagini de 100 și cursor; proba Firestore verifică 102 înregistrări pe două pagini. Scanarea este plafonată la 5.000 de documente/12 secunde între pagini; la depășire nu se confirmă un total sau o ultimă vizită. Acest plafon rămâne o limită de implementare.

Validare: **1.858 teste unitare** și **269 probe combinate** (265 regresii Firestore + cele patru comenzi cu model real) trecute. Lint, inventarele, TypeScript și compilarea aplicației (227 pagini) au trecut.

Total curent: **24 scenarii originale cu dovezi locale folosind modelul real**, **976 fără această dovadă**. Cele 20 de scenarii live anterioare nu au fost rerulate în acest lot. Nu este certificare în producție sau pe voce; nu s-a publicat în producție.

## Lot calendar — identificarea vizionării și telefoanele asociate

Scenariile originale **0168–0171** au trecut cu modelul real și date Firestore locale: cine vine la ora 17, ce proprietate se vizionează la ora 17, telefonul clientului următoarei vizionări și telefonul proprietarului vizionării selectate. Dovezi: [CALENDAR_EXECUTION_BATCH_05.json](evals/CALENDAR_EXECUTION_BATCH_05.json). Toate cele patru rulări au folosit `viewing_details` și `goal_coverage`, fără erori de instrument și fără mutații CRM. Datele includ nume denormalizate vechi, o programare ulterioară, o programare anulată și o programare a altui agent. Pentru 0171, selecția este furnizată explicit prin contextul conversației.

Instrumentul selectează ora în Europe/Bucharest sau următorul instant real, apoi citește contactul și proprietatea asociate. Telefonul cumpărătorului și cel al proprietarului provin din câmpuri distincte. Egalitățile, inclusiv ora repetată la schimbarea orei, cer alegerea vizionării. O relație lipsă nu este înlocuită cu date vechi. Citirea este limitată la agenția curentă; scanarea are plafon de 5.000 înregistrări / 12 secunde între pagini și raportează explicit rezultatul parțial dacă nu poate încheia. Nu reprezintă încă o soluție pentru orice volum al agendei.

Validare: **1.855 teste unitare** și **264 regresii Firestore** trecute; TypeScript, lint, verificarea interfeței și inventarele au trecut. Compilarea aplicației a trecut (227 pagini). Cele 16 scenarii live anterioare nu au fost rerulate în acest lot. Nu s-a publicat în producție.

Total curent: **20 scenarii originale cu dovezi locale folosind modelul real**, **980 fără acest tip de dovadă**. Aceste probe nu certifică producția, interfața vocală sau toate variantele corpusului. Autorizarea implicită prin cererea agentului pentru operațiile CRM rămâne activă.

## Lot calendar următor — ștergere și note

Scenariile originale **0166–0167** au dovezi locale cu model real în [CALENDAR_EXECUTION_BATCH_04.json](evals/CALENDAR_EXECUTION_BATCH_04.json). 0166 șterge vizionarea selectată, păstrează auditul și confirmă ștergerea din receipt; repetarea cererii nu produce un al doilea efect. 0167 folosește textul notei oferit explicit într-un mesaj anterior și adaugă numai acel text, atomic, fără înlocuirea notelor existente. Nu se inventează conținutul lipsă din cererea originală.

`update_viewing.appendNotes` păstrează notele existente în tranzacție. Dacă nu se schimbă calendarul, o vizionare trecută la o proprietate inactivă poate primi nota; se scriu numai notes/updatedAt, fără completarea unor câmpuri legacy de atribuire/durată. Verificarea reviziei și ledgerul rămân active. Conflictul dintre înlocuirea și adăugarea notelor este respins.

Validare finală: **1.846 teste unitare și 263 regresii Firestore** trecute. Prima rulare live combinată a trecut 15/16; 0165 salva corect anularea și nota, dar confirma numai nota. Mesajul confirmă acum ambele efecte. Rularea live completă ulterioară a trecut **16/16** (tools 66), cu o reîncercare pentru `id` în loc de `viewingId`. Parserul acceptă acum discriminatorul `kind` redundant numai dacă se potrivește instrumentului și aliasul `id` numai când există un singur identificator obligatoriu; parametrii contradictorii, ambigui și câmpurile necunoscute rămân respinse. Instrumentele afișează câmpurile obligatorii. Cele două scenarii noi au trecut din nou fără erori de instrument pe tools 67. Lotul întreg nu a fost rerulat după această ultimă normalizare; încercările anterioare sunt păstrate. Compilarea (227 pagini) a trecut; nu s-a publicat în producție.

Total curent: **16 scenarii originale cu dovezi locale folosind modelul real**, 984 fără acest tip de dovadă. Nu este certificare în producție sau acoperire integrală a variantelor celor 1.000 de scenarii. Autorizarea prin cererea agentului rămâne implicită pentru operațiile CRM.

## Actualizare 8 octombrie — autorizare prin cerere și modificarea vizionărilor

Conform cererii explicite a utilizatorului, operațiile CRM native pentru proprietăți, cumpărători și vizionări se execută pe baza comenzii agentului, fără activare UI sau document assistantPolicies. Aceasta înlocuiește cerința anterioară de opt-in pentru cumpărători/vizionări. Rămân verificările de rol, agenție, înregistrare, revizie, conflicte calendaristice și idempotență. Mesajele externe, publicările și alte domenii păstrează fluxurile existente. Cererile de previzualizare și negațiile nu autorizează scrieri.

Lot nou: **0160–0165**, șase cereri originale executate cu modelul real și executorii aplicației într-un emulator Firestore izolat, fără politică salvată pentru vizionări. Reprogramarea modifică aceeași înregistrare; decalarea relativă folosește un calculator server-side de minute; anularea de către client păstrează motivul în note. Confirmarea folosește starea și ora din receipt-ul tranzacției. Sunt verificate păstrarea relațiilor/duratei/notelor, absența duplicatelor și replay-ul aceleiași cereri.

Dovada: [CALENDAR_EXECUTION_BATCH_03.json](evals/CALENDAR_EXECUTION_BATCH_03.json). Pentru 0162, contextul anterior precizează că mutarea este mai târziu; pentru 0162/0164/0165 există o vizionare selectată. Nu sunt inventate direcția sau înregistrarea selectată din comanda izolată. Primele șase rulări nu au avut erori de instrument. Regresia combinată ulterioară a găsit un eșec la 0160: potrivirea pe fragmente de cuvinte putea exclude update_viewing și modelul epuiza bugetul după un instrument greșit. Selecția folosește acum cuvinte întregi și aliasuri pentru mutare/anulare. Încercarea nereușită este păstrată în raport. O altă regresie a găsit la 0179 o acțiune update_task fără câmpuri modificate și o acoperire invalidă; acum plannerul și executorul resping editările goale, iar contractul instrumentului precizează dueDate/startTime pentru reprogramare. Rerularea izolată 0179 a trecut, apoi regresia combinată finală a trecut **14/14**, fără erori de instrument (prompt jarvis-36, tools 64).

Validare finală: 1.841 teste unitare; 276 probe Firestore + model real în 19 fișiere; compilare 227 pagini; TypeScript, interfață și inventare verificate. Nu s-a publicat în producție în această etapă.

Total: **14 ID-uri originale cu dovadă de execuție locală folosind modelul real**, 986 fără acest tip de dovadă. Nu reprezintă acceptanță în producție, validarea vocală sau certificarea tuturor variantelor celor 1.000 de scenarii.

## Lot 17 — continuarea plannerului

Implementat: răspunsul final după încercarea instrumentelor, inclusiv când primul instrument eșuează, nu mai încheie cu succes o execuție principală fără goal_coverage valid. Serverul cere continuarea cerințelor rămase, păstrează rezultatele existente și admite cel mult două reveniri pentru verificarea acoperirii, în același buget. Nu repropune automat acțiuni și nu execută mutații din evaluator. O cerință declarată nesuportată produce rezultat parțial, iar una ce necesită clarificare produce starea aferentă. Subplanificatorii limitați la citire și răspunsurile explicite de clarificare/refuz păstrează comportamentul lor.

| ID | Probă deterministă adăugată | Limită |
|---|---|---|
| 0806 | După o citire și o încheiere prematură, plannerul continuă până la pregătirea follow-up-ului și acoperirea validată | Provider scriptat; nu certifică încă rezolvarea datei relative, verificarea tuturor taskurilor existente sau execuția reală a follow-up-ului |
| 0801 | Modelul care insistă să se oprească după căutare nu primește stare de succes | Nu certifică încă matching și pregătirea tuturor mesajelor |
| 0849 | Cerința cu context anterior lipsă cere clarificare, fără succes inventat | Conversația completă cu obiectiv anterior rămâne de testat |
| 0850 | Cererea de urmărire completă nu devine succes după o singură citire fără acoperire | Continuarea autonomă durabilă a întregului scenariu rămâne de acceptat |

Stare: **lot parțial, nu 50/50 și nu 1.000/1.000**. Inventarul nu certifică end-to-end niciun scenariu prin aceste probe. Verificarea deterministă a plannerului nu certifică fiabilitatea modelului real în limbaj natural.

### Reluarea execuției — mecanism necesar pentru 0850

Corectat blocajul dintre terminarea workerului și eșecul planului: un job cu `status=completed` și `planStatus=failed` poate fi pus din nou în coadă la reîncercarea autorizată, dacă planul este încă `failed` și aprobarea este validă. Înainte, răspunsul anunța `pending` fără să schimbe jobul. Pentru joburile care nu sunt repuse în coadă, API-ul returnează acum starea reală.

Probele din `jobs.test.ts` parcurg coada → worker → plan eșuat → reîncercare → worker → plan terminat și verifică protecțiile pentru joburi în curs, rezultate incerte, planuri anulate/terminate/în pauză și aprobări expirate. Proba nouă din `recovery.test.ts` execută runnerul real cu un executor simulat: primul pas confirmat, al doilea eșuat înainte de confirmare, apoi reluare doar pentru pașii rămași, cu aceeași cheie de idempotență. Dovada primului pas rămâne identică. Sunt 11 probe noi; fixture-ul de coadă simulează Firestore și runnerul, iar cel de recuperare simulează Firestore și executorul.

Aceste probe verifică mecanismul de recuperare, nu certifică întregul scenariu 0850. Reîncercarea după eșec este explicită; rezultatele externe incerte nu se repetă automat. Execuția reală în Firestore, limbajul natural și întregul obiectiv din conversație rămân de verificat separat.

## Criteriul de promovare a unui scenariu

Fiecare ID necesită fixtures și aserțiuni proprii, contextul conversației dacă este o continuare, variante de limbaj, actor/rol, timp controlat în București, pașii autorizați, dovezi ale rezultatului final și efecte interzise. Se testează eroare, întrerupere, reluare și lipsa duplicatelor. Raportul identifică versiunea codului/modelului, sursele și mediul: determinist, emulator, model real pe fixtures, furnizor de test sau producție. Straturile nu sunt substituibile și nu se însumează ca scenarii distincte.

## Pilot practic — exemplul utilizatorului cu Matei Alin

Prioritatea precizată ulterior: comanda trebuie să salveze cumpărătorul și vizionarea, apoi să confirme rezultatul. Nu este suficientă pregătirea planului sau înregistrarea erorilor. [Dovada pilotului](evals/VIEWING_EXECUTION_PILOT.json) păstrează o rulare cu modelul real, selecția normală a uneltelor native/core și Firestore local. Catalogul operațiilor externe este exclus din acest pilot; nu sunt apelate canale externe și nu sunt modificate înregistrări de producție.

Rezultat recitit din baza de date: Matei Alin / 0123123123 / Cumparator; proprietatea Apartament – Cișmigiu; vizionare scheduled la 2026-10-09T04:30:00Z, adică 09.10.2026 07:30 Europe/Bucharest. Confirmarea este generată din rezultatul tranzacției. Politica locală de execuție a fost activată explicit în fixture. Proba separată cu executorul real verifică și reluarea aceleiași comenzi fără duplicate.

Modificări de produs:
- Căutare comună CRM/globală/read/query_records, tolerantă la diacritice românești, punctuație, spații și ordinea cuvintelor; telefoanele formatate și formele românești 0/+40/0040 sunt comparate în interiorul aceluiași câmp. Valorile stocate nu se rescriu. Nu este un sistem de transcriere vocală sau sinonimizare fonetică.
- Opțiune distinctă „Autorizează cumpărători și vizionări”, valabilă 30 zile pentru actor/rol, în limita configurației serverului. După activare, comanda poate crea contactul și vizionarea în aceeași execuție. Politicile existente nu primesc implicit noul scop.
- Confirmare cu proprietate, cumpărător, dată și ora Bucureștiului din rezultatele salvate; referința noului contact este păstrată pentru verificarea accesului la istoricul conversației. Vizionările păstrează accesul la nivel de agenție definit în CRM.
- Plannerul respinge o referință către un pas viitor înainte de a o adăuga în plan și poate pregăti apoi ordinea corectă, fără pasul invalid rămas în listă.

Defecte găsite prin modelul real, apoi corectate: prima încercare a creat tipul Client în loc de Cumparator; a doua a propus vizionarea înaintea contactului și a consumat bugetul încercând acoperirea unui plan greșit. După corectarea instrucțiunii și validarea dependențelor, pilotul a trecut întâi cu unelte restrânse și apoi cu selecția obișnuită de unelte core/native (8 apeluri model, cost estimat 0,00195629 USD la ultima rulare). Rezultatele anterioare nu sunt rescrise drept succese.

Acesta este un exemplu suplimentar al utilizatorului, nu 1.000/1.000 și nici acceptanță integrală a lotului calendar. Rămân verificările pe conversațiile originale, variantele de formulare și voce, proprietăți ambigue, contacte deja existente și mediul de producție. Nu s-a publicat în producție.

## Verificări curente

### Lot calendar contextual — 0155, 0158, 0159

[Dovada lotului contextual](evals/CALENDAR_EXECUTION_BATCH_02.json) păstrează trei comenzi originale, contextul necesar, apelurile modelului și înregistrările recitite. Ultima rulare: **3/3**, fără apeluri de instrument eșuate, cost estimat 0,005578045 USD. Vizionările au fost salvate și confirmate; repetarea aceleiași comenzi păstrează rezultatele fără duplicate. Prima încercare este inclusă: 0158 pregătea acțiunea, dar consuma bugetul înaintea verificării acoperirii. Instrucțiunile disting acum contractul unei acțiuni native de descoperirea handler-elor externe și evită căutările redundante pentru o referință cunoscută.

Implementări de produs, prompt 34 / unelte 61:

- `resolve_datetime` acceptă `weekday` pentru zile numite și calculează următoarea apariție la ora cerută în Europe/Bucharest. Dacă ora de azi a trecut, folosește săptămâna următoare. Păstrează verificarea ambiguității și a orelor inexistente la schimbarea orei de vară; `date`, `dayOffset` și `weekday` se exclud reciproc.
- Panoul Jarvis preia referința din pagina `/leads/:id` sau `/properties/:id` la trimiterea comenzii, atât prin voce cât și prin câmpul său text. API-ul acceptă numai resursa și ID-ul, iar serverul citește înregistrarea din agenția autentificată. Valorile și numele nu sunt preluate din browser. Referința este păstrată prin coadă și verificată din nou la execuția workerului.
- La navigarea pe o pagină fără înregistrare deschisă, panoul trimite explicit absența selecției. Plannerul nu trebuie să substituie o pagină vizitată anterior. Contextul autorizat și referințele de acces sunt păstrate în istoricul conversației. Selecțiile din tabele/modale care nu modifică URL-ul nu sunt acoperite de acest mecanism.

0155 folosește proprietatea selectată din conversație; 0158 folosește proprietatea și clientul selectați; 0159 folosește proprietatea și ora stabilite anterior, iar clientul curent trece prin resolverul de pagină și citirea Firestore. Aceste contexte sunt explicit documentate, nu informații inventate pentru cereri incomplete.

Verificare separată în browser: cererea conține clientul deschis, navigarea înlocuiește referința cu proprietatea curentă, iar revenirea în listă elimină selecția. Suita UI utilizează microfon și răspunsuri API simulate; nu reprezintă acceptanță vocală pe dispozitiv real. Modelul real și executorul sunt verificați în proba locală, iar transportul API/worker/istoric în regresii distincte. Nu revendicăm un singur test integrat browser → model → workspace → producție.

Regresia generală cu modulul Voice: 1819/1819 în 144 fișiere; Firestore/Storage: 261/261 în 18 fișiere. Browser: 18 verificări, inclusiv cele trei verificări noi de context. Buildul a trecut cu 227 pagini; verificarea TypeScript inclusiv fișierele de test și ESLint pentru fișierele schimbate au trecut. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone.

Rularea comună finală cu modelul real a trecut **8/8**, zero apeluri de instrument eșuate, cost estimat 0,015195455 USD. Dovezile acestei reluări pe prompt 34/unelte 61 sunt păstrate în `combinedRegression` din raportul lotului 02; probele anterioare nu au fost înlocuite.

Inventarul are acum **8 ID-uri originale cu dovezi de execuție locală**, nu acceptanță integrală a 1.000 de scenarii. Mai sunt 992 fără această probă, precum și variantele de formulare/context/voce și acceptanța în producție pentru cele opt. Nu s-a publicat în producție.

### Lot calendar — execuție practică pentru cinci scenarii originale (08.10.2026)

[Dovada completă](evals/CALENDAR_EXECUTION_BATCH_01.json) leagă comenzile originale 0156, 0178, 0179, 0180 și 0181 de apelurile modelului real, acțiunile executorului CRM, documentele recitite și confirmările generate din tranzacții. Ultima rulare: **5/5**, zero apeluri de instrument eșuate, cost model estimat total 0,008527335 USD. Repetarea aceleiași comenzi produce aceleași rezultate fără documente suplimentare. Contextul pentru „taskul acesta” este furnizat explicit; prompturile originale nu sunt rescrise.

Rezultatele salvate: vizionare Titan/Andrei pe 09.10.2026 la 17:00; task Andrei la 10:00; mutare la 11:00; finalizare; redeschidere cu păstrarea contactului. Toate orele sunt Europe/Bucharest. Modelul și executorul sunt reale, iar Firestore este emulatorul local cu agenții izolate. Catalogul extern este exclus; căutarea globală folosește ruta de produs cu autentificare de fixture. Proba nu certifică traseul complet browser/voce/producție.

Corecții rezultate din execuții, aplicate produsului:

- Parametrii acțiunilor păstrează distincția dintre câmp omis și `null` explicit; schimbarea statusului nu mai șterge accidental contactul sau revizia taskului.
- Instantul ISO al taskului este salvat și în câmpul de oră folosit de calendar; actualizările fără dată păstrează ora existentă. Confirmarea include starea și ora salvate.
- Formele românești „taskul”, „sarcinile”, „vizionările” sunt recunoscute la selectarea instrumentelor. Redeschiderea, mutarea și replanificarea intră în execuția taskurilor deja autorizată; negațiile rămân respectate.
- Identificarea proprietății pentru o vizionare caută CRM-ul, fără a cere inutil orașul sursei externe de proprietari. ID-urile contextuale se verifică prin citire, nu după aspectul șirului.
- Limitele numerice ale instrumentelor sunt comunicate modelului. Contractul citirilor paralele precizează operațiile și structura acceptată.
- Reviziile ISO care reprezintă același instant sunt echivalate; reviziile realmente vechi și `null` explicit nu sunt înlocuite cu starea nouă.
- Un plan cu acoperirea integrală a mutațiilor deja verificată nu se pierde când numai apelul următor pentru formularea previzualizării depășește bugetul. Această închidere se aplică înainte de apel, nu după răspunsuri neprocesate, expirare sau contabilizare invalidă. Execuția și confirmarea efectelor rămân separate.
- Citirile delegate primesc instrucțiuni specifice citirii, pentru a încăpea în bugetul existent; permisiunile și limitele nu sunt mărite.

Șase încercări anterioare sunt păstrate în dovadă, inclusiv eșecurile și recuperările parțiale. Nu există acceptanță de fiabilitate 100% dintr-o singură rulare. Inventarul marchează lotul 04 în lucru și adaugă cinci legături de execuție locală; nu transformă acestea în 1.000 de scenarii certificate. Rămân 995 de scenarii originale fără această probă practică, plus variantele și traseele externe/voce/producție ale celor cinci.

Versiune: prompt 33, unelte 60. Regresia generală a trecut 1769/1769 în 137 fișiere; ulterior, verificarea suplimentară a limitei înainte/după răspuns a trecut împreună cu toate cele 28 de probe ale plannerului. Suita Firestore/Storage a trecut 260/260 în 18 fișiere. Buildul a trecut cu 227/227 pagini; ESLint nu are erori în fișierele de produs modificate. Paritatea și inventarul au trecut. Rămân avertismentul Jaeger și omiterea cunoscută a copierii Playwright în standalone. Bugetele de producție au rămas neschimbate. Nu s-a publicat în producție.

1757/1757 teste de regresie în 136 de fișiere au trecut pentru versiunea 59 a uneltelor / prompt 32. Suita Firestore/Storage a trecut 260/260 verificări în 18 fișiere, inclusiv salvarea cumpărătorului și vizionării în emulator. Pilotul separat cu model real a trecut după remedierea celor două defecte documentate mai sus. UI Text a trecut inclusiv activarea/dezactivarea noii autorizări; captura viewing-autonomy.png a fost inspectată. ESLint nu are erori; rămâne avertismentul preexistent useEffect/openSession. Paritatea și inventarul loturilor au trecut. Nu s-au trimis mesaje sau lansat campanii reale.

Buildul versiunii 59 a trecut cu TypeScript și 227/227 pagini, după corectarea unei referințe de istoric incompatibile cu schema TypeScript. Rămân avertismentele cunoscute Jaeger/Tailwind și omiterea copierii Playwright în standalone. git diff --check a trecut. Nu s-a publicat în producție.
