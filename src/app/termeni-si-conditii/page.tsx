import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ScrollText } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termeni si conditii | ImoDeus.ai CRM',
  description:
    'Termenii si conditiile de utilizare pentru website-ul si serviciile ImoDeus.ai CRM operate de NORDIA HOMES SRL.',
};

const sections = [
  {
    title: '1. Identificarea operatorului',
    paragraphs: [
      'Website-ul de prezentare si serviciile ImoDeus.ai CRM sunt operate de NORDIA HOMES SRL, persoana juridica romana, cu CUI 53091883, nr. de inregistrare la Registrul Comertului J2025096401003 si sediul social in Str. Nerva Traian 27-33, Sc. B, Et. 1, Ap. BIR. 6, Sector 3, Bucuresti, cod postal 031044, denumita in continuare "Operatorul" sau "ImoDeus".',
      'Prezenta pagina reglementeaza accesarea website-ului de prezentare, folosirea demo-ului, interactiunea cu formularele publice si, dupa caz, utilizarea serviciilor software ImoDeus.ai CRM.',
    ],
  },
  {
    title: '2. Acceptarea termenilor',
    paragraphs: [
      'Prin accesarea website-ului, navigarea in paginile sale, solicitarea unui demo, transmiterea unui mesaj sau utilizarea oricarei functionalitati puse la dispozitie de ImoDeus, confirmi ca ai citit, inteles si acceptat acesti termeni si conditii.',
      'Daca nu esti de acord cu acesti termeni, te rugam sa nu utilizezi website-ul sau serviciile oferite prin intermediul acestuia.',
      'Operatorul poate actualiza oricand continutul acestor termeni pentru a reflecta modificari comerciale, tehnice sau legale. Versiunea publicata pe site la momentul utilizarii este versiunea aplicabila.',
    ],
  },
  {
    title: '3. Descrierea serviciilor',
    paragraphs: [
      'ImoDeus.ai CRM este o platforma software orientata catre activitatea imobiliara si poate include, fara a se limita la acestea, module de gestionare a proprietatilor, lead-urilor, task-urilor, vizionarilor, rapoartelor, continutului comercial, website-ului public si functionalitati asistate de inteligenta artificiala.',
      'Informatiile prezentate pe website au rol de prezentare comerciala si orientativa. Afisarea unor functionalitati, capturi de ecran, exemple de fluxuri, descrieri tehnice sau materiale video nu reprezinta prin ele insele o obligatie contractuala ferma privind livrarea unei anumite configuratii, integrari sau performante, in lipsa unui acord separat.',
      'Operatorul isi rezerva dreptul de a modifica, extinde, restrange, suspenda sau intrerupe anumite functii, module sau componente ale serviciului, temporar sau definitiv, fara o notificare prealabila generala, in masura permisa de lege.',
    ],
  },
  {
    title: '4. Accesul la website si la demo',
    paragraphs: [
      'Accesul la paginile publice poate fi facut in scop informativ si pentru evaluarea produsului. Anumite functionalitati, precum solicitarea unui demo, crearea unui cont sau accesarea unor zone private, pot necesita furnizarea unor date reale si complete.',
      'Mediul demo are exclusiv rol de prezentare si simulare a experientei de utilizare. Datele, exemplele, proprietatile, lead-urile, task-urile si celelalte elemente afisate intr-un demo pot fi fictive, generate automat sau reutilizate strict pentru scop demonstrativ.',
      'Operatorul poate limita sau bloca accesul la demo ori la orice alta functionalitate daca identifica folosire abuziva, tentativa de extragere automatizata a continutului, comportament de testare agresiva, incercari de compromitere a securitatii sau utilizare contrara scopului legitim al platformei.',
    ],
  },
  {
    title: '5. Crearea contului si responsabilitatea utilizatorului',
    paragraphs: [
      'Atunci cand creezi un cont sau transmiti date pentru activarea unor servicii, te obligi sa furnizezi informatii corecte, actuale si complete. Esti responsabil pentru pastrarea confidentialitatii credentialelor de acces si pentru toate actiunile efectuate din contul tau.',
      'Nu este permisa folosirea contului de catre persoane neautorizate, impersonarea unei alte persoane, folosirea unei identitati false sau transmiterea de informatii care pot induce in eroare Operatorul, alti clienti sau terti.',
      'Utilizatorul trebuie sa anunte fara intarziere orice suspiciune de acces neautorizat, compromitere a contului sau incident de securitate observat in legatura cu utilizarea platformei.',
    ],
  },
  {
    title: '6. Reguli de utilizare si interdictii',
    paragraphs: [
      'Este interzisa utilizarea website-ului sau a serviciilor ImoDeus intr-un mod care incalca legea, bunele moravuri, drepturile altor persoane ori securitatea si functionarea normala a sistemelor tehnice utilizate de Operator.',
      'Fara a limita caracterul general al celor de mai sus, este interzis sa copiezi masiv continutul site-ului, sa scanezi automatizat aplicatia, sa incerci decompilarea, ingineria inversa, extragerea de baze de date, ocolirea mecanismelor de autentificare, introducerea de cod malitios, trimiterea de spam sau utilizarea platformei pentru continut ilegal, defaimator, inselator, discriminatoriu ori care incalca drepturi de proprietate intelectuala.',
      'Utilizatorul raspunde integral pentru continutul, fisierele, datele si mesajele pe care le incarca, le genereaza, le transmite sau le administreaza prin intermediul serviciilor contractate.',
    ],
  },
  {
    title: '7. Proprietate intelectuala',
    paragraphs: [
      'Intregul continut al website-ului si al platformei, incluzand fara limitare textele, structura, designul, logo-urile, elementele grafice, bazele de date, fluxurile functionale, capturile de ecran, denumirile comerciale, codul sursa, codul obiect si documentatia, apartine Operatorului si/sau partenerilor sai licentiatori si este protejat de legislatia aplicabila.',
      'Nicio prevedere din prezenta pagina nu poate fi interpretata ca transferand catre utilizator drepturi de proprietate intelectuala asupra produsului sau continutului. Este permisa numai utilizarea strict necesara scopului legitim pentru care serviciul este oferit.',
      'Reproducerea, republicarea, transmiterea, distribuirea, modificarea, crearea de opere derivate sau exploatarea comerciala a continutului si a elementelor software fara acordul prealabil scris al Operatorului este interzisa.',
    ],
  },
  {
    title: '8. Datele si continutul utilizatorului',
    paragraphs: [
      'In masura in care platforma iti permite sa introduci date despre clienti, proprietati, documente, imagini, texte, cereri sau alte materiale, ramai responsabil pentru legalitatea colectarii si folosirii acestora si pentru existenta oricaror consimtaminte, notificari sau temeiuri legale necesare.',
      'Prin utilizarea serviciilor confirmi ca ai dreptul sa incarci si sa prelucrezi datele respective si ca acestea nu incalca drepturile unor terti. Operatorul nu devine titularul datelor comerciale ale clientului doar prin simpla gazduire sau procesare tehnica a acestora in cadrul serviciului.',
      'Operatorul poate folosi informatii agregate, anonimizate sau statistice despre utilizarea serviciului pentru analiza, imbunatatirea produsului, securitate, raportare interna si dezvoltare, fara identificarea unei persoane sau a unui client anume.',
    ],
  },
  {
    title: '9. Inteligenta artificiala si materiale generate automat',
    paragraphs: [
      'Anumite functionalitati ImoDeus pot utiliza modele de inteligenta artificiala pentru generare de texte, sumarizari, recomandari, clasificari, scoring, sugestii comerciale sau alte rezultate asistate automat.',
      'Rezultatele generate de AI au caracter orientativ si necesita verificare umana inainte de a fi folosite pentru decizii comerciale, juridice, financiare sau operationale. Operatorul nu garanteaza ca rezultatele generate automat sunt complete, exacte, lipsite de erori sau adecvate unui scop particular.',
      'Utilizatorul ramane responsabil pentru modul in care foloseste sau comunica mai departe continutul generat cu ajutorul acestor functionalitati.',
    ],
  },
  {
    title: '10. Disponibilitate, mentenanta si securitate',
    paragraphs: [
      'Operatorul depune eforturi rezonabile pentru a mentine website-ul si serviciile functionale, insa nu garanteaza functionarea neintrerupta, lipsa erorilor, compatibilitatea cu orice dispozitiv, browser, integrare externa sau infrastructura a utilizatorului.',
      'Pot exista perioade de mentenanta, actualizari, limitari de performanta, intreruperi ale unor furnizori terti, incidente de securitate, defectiuni tehnice sau alte situatii care afecteaza temporar disponibilitatea serviciului.',
      'Operatorul adopta masuri tehnice si organizatorice rezonabile pentru protejarea infrastructurii sale, dar transmiterea datelor prin internet nu poate fi garantata ca fiind complet lipsita de riscuri.',
    ],
  },
  {
    title: '11. Preturi, abonamente si relatia contractuala',
    paragraphs: [
      'In situatia in care anumite servicii ImoDeus sunt oferite contra cost, conditiile comerciale aplicabile, inclusiv pretul, durata, limitele de utilizare, serviciile incluse, conditiile de facturare si eventualele perioade minime contractuale, vor fi stabilite prin oferta comerciala, comanda, contract, anexa sau alta documentatie acceptata intre parti.',
      'Prezenta pagina nu inlocuieste clauzele negociate individual cu un client platitor. In caz de neconcordanta intre acesti termeni generali si un contract semnat separat, contractul separat va prevala pentru aspectele reglementate expres in acesta.',
      'Neplata la scadenta, folosirea neautorizata a serviciului sau incalcarea grava a obligatiilor contractuale poate conduce la suspendarea sau incetarea accesului, conform documentelor comerciale aplicabile si legislatiei in vigoare.',
    ],
  },
  {
    title: '12. Limitarea raspunderii',
    paragraphs: [
      'In limita permisa de lege, Operatorul nu raspunde pentru prejudicii indirecte, pierderi de profit, pierderi de oportunitate, afectarea imaginii, pierderi de date, intreruperi comerciale sau alte consecinte rezultate din utilizarea sau imposibilitatea utilizarii website-ului, demo-ului ori serviciilor software.',
      'Operatorul nu garanteaza obtinerea unor rezultate comerciale specifice prin simpla utilizare a platformei, inclusiv cresterea vanzarilor, generarea de lead-uri, inchiderea tranzactiilor sau conformarea juridica automata a activitatii utilizatorului.',
      'Utilizatorul intelege ca orice decizie luata pe baza informatiilor afisate pe site, a rapoartelor, a recomandarilor AI sau a fluxurilor din aplicatie trebuie validata in contextul propriei activitati, al procedurilor interne si, cand este cazul, cu ajutor de specialitate.',
    ],
  },
  {
    title: '13. Protectia datelor si confidentialitatea',
    paragraphs: [
      'Prelucrarea datelor cu caracter personal realizata prin intermediul website-ului de prezentare se efectueaza in conformitate cu regulile descrise in paginile si informarile de confidentialitate publicate de Operator.',
      'In cazul relatiei comerciale dintre Operator si un client business, rolurile partilor privind protectia datelor pot fi detaliate suplimentar prin contract, anexe sau instructiuni operationale distincte.',
      'Transmiterea de informatii confidentiale prin formulare publice trebuie facuta cu prudenta. Utilizatorul va evita trimiterea de date excesive, categorii speciale de date sau documente sensibile in lipsa unei necesitati clare si a unui canal adecvat.',
    ],
  },
  {
    title: '14. Linkuri si servicii ale tertilor',
    paragraphs: [
      'Website-ul sau platforma poate integra ori trimite catre servicii, API-uri, portaluri, furnizori cloud, instrumente de analiza, harti, servicii de autentificare, retele sociale sau alte platforme operate de terti.',
      'Operatorul nu controleaza in totalitate continutul, disponibilitatea, politicile comerciale ori practicile de confidentialitate ale acestor terti si nu raspunde pentru functionarea lor, pentru continutul publicat de acestia sau pentru modificarile aduse de acestia propriilor servicii.',
      'Utilizarea unor servicii terte poate fi supusa unor termeni separati, pe care utilizatorul are obligatia sa ii consulte si sa ii respecte.',
    ],
  },
  {
    title: '15. Suspendare si incetare',
    paragraphs: [
      'Operatorul poate suspenda temporar sau definitiv accesul la website, demo, cont ori servicii daca exista indicii rezonabile de frauda, abuz, acces neautorizat, utilizare contrara acestor termeni, nerespectarea obligatiilor contractuale sau riscuri de securitate pentru platforma ori pentru alti utilizatori.',
      'Incetarea accesului nu inlatura raspunderea utilizatorului pentru incalcarile anterioare si nici dreptul Operatorului de a-si proteja interesele legitime sau de a solicita repararea prejudiciilor cauzate.',
      'Clauzele privind proprietatea intelectuala, raspunderea, confidentialitatea, protectia datelor si legea aplicabila raman valabile si dupa incetarea raporturilor dintre parti, in masura in care natura lor o impune.',
    ],
  },
  {
    title: '16. Legea aplicabila si solutionarea litigiilor',
    paragraphs: [
      'Acesti termeni si conditii sunt guvernati de legea romana.',
      'Orice litigiu aparut in legatura cu accesarea website-ului sau utilizarea serviciilor va fi solutionat mai intai pe cale amiabila, iar in cazul in care aceasta nu este posibila, de instantele competente din Romania, potrivit regulilor de competenta aplicabile.',
      'Daca o anumita clauza din prezenta pagina este considerata nula sau inaplicabila, aceasta nu va afecta valabilitatea celorlalte dispozitii.',
    ],
  },
  {
    title: '17. Contact si versiunea aplicabila',
    paragraphs: [
      'Pentru solicitari privind acesti termeni si conditii sau pentru corespondenta privind serviciile ImoDeus, poti utiliza canalele de contact comunicate de Operator prin website, formularul de contact, oferta comerciala sau documentele contractuale aplicabile.',
      'Prezenta versiune a termenilor si conditiilor este actualizata la data de 27.04.2026 si se aplica de la momentul publicarii pe website.',
    ],
  },
];

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(186,230,253,0.35),transparent_30%),linear-gradient(180deg,#f8fbff_0%,#eef6ff_48%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-sky-200 hover:text-sky-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Inapoi la prezentare
          </Link>
        </div>

        <section className="mt-6 rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_32px_100px_rgba(37,55,88,0.12)] backdrop-blur sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-1.5 text-sm font-semibold text-sky-800">
              <ScrollText className="h-4 w-4" />
              Termeni si conditii
            </div>
            <h1 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Termenii de utilizare pentru ImoDeus.ai CRM
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              Aceasta pagina stabileste conditiile in care poate fi accesat website-ul de
              prezentare, mediul demo si, dupa caz, serviciul software ImoDeus.ai CRM.
            </p>
          </div>

          <div className="mt-8 rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Operator
            </p>
            <p className="mt-3 text-base leading-7 text-emerald-950">
              NORDIA HOMES SRL, CUI 53091883, J2025096401003, sediu social in Str. Nerva
              Traian 27-33, Sc. B, Et. 1, Ap. BIR. 6, Sector 3, Bucuresti, cod 031044.
            </p>
          </div>

          <article className="mt-8 space-y-5">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[26px] border border-slate-200/80 bg-slate-50/80 p-5 sm:p-6"
              >
                <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold tracking-[-0.04em] text-slate-950">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.paragraphs.map((paragraph, index) => (
                    <p
                      key={`${section.title}-${index}`}
                      className="text-sm leading-7 text-slate-700 sm:text-[15px]"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </article>
        </section>
      </div>
    </main>
  );
}
