# Corpus Jarvis — implementare pe loturi

Ținta solicitată: fiecare dintre cele 1.000 de scenarii originale îndeplinit până la rezultatul cerut, fără oprire nejustificată după primul pas. Aprobările, clarificările necesare și accesul autorizat fac parte din scenariul complet; nu se elimină pentru a declara succes.

Inventarul reproductibil este [MASTER_BATCHES.json](evals/MASTER_BATCHES.json): 20 de loturi a câte 50 de ID-uri, textul original și hash per cerere. Se verifică prin `node scripts/jarvis-corpus-batches.mjs --check`. Inventarul nu este un raport de acceptanță; regenerarea lui nu certifică scenariile. Ordinea de lucru începe cu loturile 17 și 18 (801–900), apoi loturile de domeniu 1–16 și 19–20.

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

## Verificări curente

109/109 teste de coadă și recuperare și 1732/1732 teste de regresie în 134 de fișiere au trecut pentru versiunea 58 a uneltelor. ESLint, paritatea și inventarul loturilor au trecut. Providerii au fost simulați; nu s-au trimis mesaje sau lansat campanii reale. Numărul scenariilor originale certificate nu a crescut prin testele mecanismelor de recuperare.

Buildul complet a trecut cu TypeScript și 227/227 pagini pentru versiunea 58. Rămân avertismentul cunoscut Jaeger și omiterea copierii Playwright în standalone. git diff --check a trecut. Nu s-au relansat UI sau emulatorul pentru modificarea cozii. Nu s-a publicat în producție.
