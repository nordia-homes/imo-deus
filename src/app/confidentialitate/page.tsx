import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Politica de confidentialitate | ImoDeus.ai CRM',
  description:
    'Politica de confidentialitate pentru website-ul si serviciile ImoDeus.ai CRM operate de NORDIA HOMES SRL.',
};

const sections = [
  {
    title: '1. Cine este operatorul datelor',
    paragraphs: [
      'Prezenta politica de confidentialitate descrie modul in care NORDIA HOMES SRL, cu CUI 53091883, nr. de inregistrare la Registrul Comertului J2025096401003 si sediul social in Str. Nerva Traian 27-33, Sc. B, Et. 1, Ap. BIR. 6, Sector 3, Bucuresti, cod postal 031044, in calitate de operator de date, prelucreaza datele cu caracter personal colectate prin intermediul website-ului de prezentare ImoDeus.ai CRM.',
      'Aceasta politica se aplica datelor transmise atunci cand vizitezi website-ul, completezi formulare, soliciti un demo, creezi un cont, ne contactezi sau interactionezi cu serviciile noastre in orice alt mod prin canalele publice puse la dispozitie.',
    ],
  },
  {
    title: '2. Ce date putem colecta',
    paragraphs: [
      'In functie de interactiunea pe care o ai cu website-ul, putem colecta date precum numele si prenumele, adresa de email, numarul de telefon, numele companiei sau agentiei, rolul profesional, continutul mesajelor transmise, informatii legate de interesul tau pentru produs si orice alte date pe care alegi sa ni le comunici.',
      'De asemenea, putem colecta date tehnice si de utilizare, cum ar fi adresa IP, tipul dispozitivului, browserul utilizat, paginile accesate, durata vizitei, sursa traficului, evenimentele de interactiune si alte date similare necesare pentru securitate, diagnostic si analiza functionarii website-ului.',
      'In cazul accesarii unor zone demo sau al folosirii unor formulare avansate, putem asocia cererea ta cu sesiunea initiata, momentul interactiunii si istoricul comunicarilor purtate cu noi.',
    ],
  },
  {
    title: '3. Cum colectam datele',
    paragraphs: [
      'Datele pot fi colectate direct de la tine, atunci cand completezi un formular, trimiti un mesaj, soliciti o prezentare, te inregistrezi sau ne contactezi.',
      'Unele date sunt colectate automat prin interactiunea cu website-ul, prin jurnale tehnice, fisiere de tip cookie sau tehnologii similare, in masura in care acestea sunt utilizate pentru functionarea, securitatea si imbunatatirea experientei de utilizare.',
      'Putem primi informatii si din surse externe legitime, cum ar fi parteneri tehnici, platforme de autentificare sau instrumente de analiza, in masura in care acest lucru este necesar pentru furnizarea serviciilor sau pentru administrarea relatiei comerciale.',
    ],
  },
  {
    title: '4. Scopurile prelucrarii',
    paragraphs: [
      'Prelucram datele pentru a raspunde solicitarilor trimise, pentru a programa discutii sau demo-uri, pentru a furniza acces la anumite functionalitati, pentru a administra conturi de utilizator si pentru a comunica in legatura cu serviciile noastre.',
      'Datele pot fi utilizate si pentru gestionarea relatiei comerciale, emiterea ofertelor, pregatirea documentatiei contractuale, suport tehnic, imbunatatirea produsului, analiza utilizarii website-ului, prevenirea fraudelor si asigurarea securitatii sistemelor informatice.',
      'In anumite situatii, putem utiliza datele pentru transmiterea de comunicari comerciale relevante despre produs sau serviciile noastre, in masura permisa de lege sau in baza consimtamantului tau, atunci cand acesta este necesar.',
    ],
  },
  {
    title: '5. Temeiurile legale',
    paragraphs: [
      'Prelucrarea datelor se poate baza, dupa caz, pe executarea demersurilor precontractuale initiate de tine, pe executarea unui contract, pe obligatii legale aplicabile Operatorului, pe interesul legitim al acestuia de a-si promova si securiza serviciile sau pe consimtamantul tau expres.',
      'Atunci cand prelucrarea este intemeiata pe consimtamant, acesta poate fi retras in orice moment, fara a afecta legalitatea prelucrarii efectuate anterior retragerii.',
    ],
  },
  {
    title: '6. Cui putem divulga datele',
    paragraphs: [
      'Datele pot fi accesate de personalul autorizat al Operatorului si, atunci cand este necesar, de furnizori sau parteneri care presteaza servicii pentru noi, precum servicii de hosting, infrastructura cloud, email, suport tehnic, analiza, securitate, procesare software sau alte servicii operationale necesare.',
      'Transmiterea datelor catre astfel de terti se face numai in masura necesara pentru indeplinirea scopurilor descrise in aceasta politica si cu aplicarea unor masuri rezonabile de confidentialitate si securitate.',
      'De asemenea, putem divulga date atunci cand avem o obligatie legala, cand este necesar pentru apararea unui drept in justitie sau pentru protejarea drepturilor, proprietatii ori sigurantei Operatorului, a utilizatorilor sau a altor persoane.',
    ],
  },
  {
    title: '7. Transferuri de date',
    paragraphs: [
      'In functie de infrastructura tehnica utilizata, anumite date pot fi stocate sau prelucrate si prin furnizori care opereaza in afara Romaniei sau a Spatiului Economic European.',
      'In astfel de cazuri, Operatorul va lua masuri rezonabile pentru a se asigura ca transferurile sunt efectuate in conformitate cu legislatia aplicabila si ca datele beneficiaza de un nivel adecvat de protectie, inclusiv prin mecanisme contractuale sau garantii recunoscute de lege.',
    ],
  },
  {
    title: '8. Cat timp pastram datele',
    paragraphs: [
      'Datele sunt pastrate pe durata necesara pentru atingerea scopurilor pentru care au fost colectate, pentru administrarea relatiei cu tine, pentru respectarea obligatiilor legale si pentru protejarea intereselor legitime ale Operatorului.',
      'Durata concreta de pastrare poate varia in functie de natura solicitarii, de existenta unei relatii contractuale, de cerintele fiscale sau contabile, de necesitatea apararii unor drepturi si de politicile interne aplicabile.',
      'La expirarea perioadelor relevante, datele vor fi sterse, anonimizate sau arhivate conform cerintelor legale si procedurilor interne aplicabile.',
    ],
  },
  {
    title: '9. Drepturile tale',
    paragraphs: [
      'In conditiile prevazute de legislatia aplicabila, beneficiezi de dreptul de acces la datele tale, de rectificare a acestora, de stergere, de restrictionare a prelucrarii, de opozitie la prelucrare, precum si de dreptul la portabilitatea datelor, atunci cand acesta este aplicabil.',
      'Daca prelucrarea se bazeaza pe consimtamant, ai dreptul sa il retragi in orice moment. Ai, de asemenea, dreptul de a depune o plangere la autoritatea competenta in materie de protectie a datelor daca consideri ca drepturile tale au fost incalcate.',
    ],
  },
  {
    title: '10. Securitatea datelor',
    paragraphs: [
      'Operatorul aplica masuri tehnice si organizatorice rezonabile pentru a proteja datele cu caracter personal impotriva accesului neautorizat, pierderii, distrugerii, alterarii sau divulgarii nepermise.',
      'Cu toate acestea, niciun sistem informatic si nicio transmisie de date prin internet nu poate fi garantata ca fiind complet lipsita de riscuri. Din acest motiv, te incurajam sa transmiti numai datele necesare si sa utilizezi canale adecvate pentru documente sau informatii sensibile.',
    ],
  },
  {
    title: '11. Cookie-uri si tehnologii similare',
    paragraphs: [
      'Website-ul poate utiliza cookie-uri sau tehnologii similare pentru asigurarea functionarii tehnice, memorarea preferintelor, analiza traficului si imbunatatirea experientei de utilizare.',
      'In masura in care anumite cookie-uri nu sunt strict necesare, acestea vor fi utilizate in conformitate cu regulile legale aplicabile si, dupa caz, pe baza optiunilor exprimate de utilizator.',
    ],
  },
  {
    title: '12. Linkuri catre alte website-uri',
    paragraphs: [
      'Website-ul nostru poate contine linkuri catre website-uri, platforme sau servicii operate de terti. Operatorul nu raspunde pentru continutul acestora si nici pentru practicile lor privind protectia datelor.',
      'Te incurajam sa consulti politicile de confidentialitate ale fiecarui tert inainte de a furniza date personale prin intermediul unor astfel de servicii externe.',
    ],
  },
  {
    title: '13. Actualizarea politicii',
    paragraphs: [
      'Aceasta politica poate fi modificata sau actualizata periodic pentru a reflecta schimbari legislative, tehnice sau operationale. Versiunea publicata pe website este versiunea aplicabila la momentul consultarii.',
      'In cazul unor modificari importante, vom putea afisa informari suplimentare in cadrul website-ului sau prin alte canale adecvate, daca acest lucru este necesar.',
    ],
  },
  {
    title: '14. Contact',
    paragraphs: [
      'Pentru intrebari privind aceasta politica de confidentialitate sau pentru exercitarea drepturilor tale, ne poti contacta prin canalele comunicate pe website-ul ImoDeus.ai CRM sau prin corespondenta adresata Operatorului la sediul social mentionat in prezenta pagina.',
      'Prezenta politica de confidentialitate este actualizata la data de 27.04.2026.',
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(167,243,208,0.32),transparent_28%),linear-gradient(180deg,#f6fffb_0%,#eefbf7_48%,#ffffff_100%)] text-slate-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 pb-14 pt-6 sm:px-6 lg:px-8 lg:pb-20 lg:pt-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Inapoi la prezentare
          </Link>
        </div>

        <section className="mt-6 rounded-[32px] border border-slate-200/80 bg-white/88 p-6 shadow-[0_32px_100px_rgba(37,55,88,0.12)] backdrop-blur sm:p-8 lg:p-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
              Politica de confidentialitate
            </div>
            <h1 className="mt-5 font-[family-name:var(--font-space-grotesk)] text-4xl font-bold tracking-[-0.06em] text-slate-950 sm:text-5xl">
              Cum prelucram datele tale
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">
              Aceasta pagina explica ce date putem colecta prin website-ul ImoDeus.ai CRM,
              in ce scopuri le folosim si care sunt drepturile tale.
            </p>
          </div>

          <div className="mt-8 rounded-[24px] border border-emerald-200/70 bg-emerald-50/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Operator de date
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
