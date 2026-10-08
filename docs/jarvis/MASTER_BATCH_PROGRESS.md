# Corpus Jarvis — implementare pe loturi

Ținta solicitată: fiecare dintre cele 1.000 de scenarii originale îndeplinit până la rezultatul cerut, fără oprire nejustificată după primul pas. Aprobările, clarificările necesare și accesul autorizat fac parte din scenariul complet; nu se elimină pentru a declara succes.

Inventarul reproductibil este [MASTER_BATCHES.json](evals/MASTER_BATCHES.json): 20 de loturi a câte 50 de ID-uri, textul original și hash per cerere. Se verifică prin `node scripts/jarvis-corpus-batches.mjs --check`. Inventarul nu este un raport de acceptanță; regenerarea lui nu certifică scenariile. Ordinea de lucru începe cu loturile 17 și 18 (801–900), apoi loturile de domeniu 1–16 și 19–20.

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
