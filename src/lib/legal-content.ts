import type { Agency } from '@/lib/types';

export const defaultTermsAndConditions = `Acest website are scop exclusiv informativ si prezinta proprietati si servicii oferite de agentie.

Informatiile afisate pe site pot fi actualizate, completate sau retrase fara notificare prealabila, in functie de disponibilitatea proprietatilor si de modificarile aparute in piata.

Descrierile, preturile, imaginile si alte materiale publicate au caracter orientativ si nu reprezinta o oferta contractuala ferma.

Utilizarea website-ului presupune folosirea informatiilor in mod legal, responsabil si fara a afecta functionarea platformei sau drepturile altor persoane.

Orice decizie de colaborare, rezervare, vizionare sau tranzactie se stabileste ulterior, prin comunicare directa cu agentia si prin documentele specifice fiecarei etape.

Continutul publicat pe site, inclusiv textele, imaginile, elementele grafice si structura platformei, nu poate fi copiat, distribuit sau reutilizat fara acordul prealabil al agentiei.`;

function safeValue(value?: string | null, fallback = 'Nespecificat') {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

export function getAgencyLegalIdentity(agency?: Agency | null) {
  return {
    displayName: safeValue(agency?.name, 'Agentia'),
    legalCompanyName: safeValue(agency?.legalCompanyName || agency?.name),
    companyTaxId: safeValue(agency?.companyTaxId),
    registeredOffice: safeValue(agency?.registeredOffice || agency?.address),
    legalRepresentative: safeValue(agency?.legalRepresentative),
    phone: safeValue(agency?.phone),
    email: safeValue(agency?.email),
  };
}

export function buildPrivacySections(agency?: Agency | null) {
  const identity = getAgencyLegalIdentity(agency);
  const extraClauses = agency?.privacyPolicy?.trim();

  return [
    {
      title: '1. Identitatea operatorului de date',
      paragraphs: [
        `${identity.legalCompanyName}, denumita in continuare si "Agentia", actioneaza in calitate de operator de date cu caracter personal pentru datele colectate prin intermediul acestui website public.`,
        `Datele de identificare comunicate de Agentie pentru aceasta pagina sunt urmatoarele: denumire legala ${identity.legalCompanyName}, CUI ${identity.companyTaxId}, sediu social ${identity.registeredOffice}, reprezentant legal ${identity.legalRepresentative}, telefon ${identity.phone}, email ${identity.email}.`,
        `Aceasta pagina se aplica interactiunilor initiate prin website-ul public al Agentiei, inclusiv formulare de contact, solicitari de vizionare, cereri de informatii si orice alta corespondenta transmisa prin intermediul paginilor publice.`,
      ],
    },
    {
      title: '2. Ce date putem colecta',
      paragraphs: [
        'In functie de formularul utilizat si de modul in care interactionezi cu site-ul, putem colecta numele si prenumele, numarul de telefon, adresa de email, continutul mesajului transmis, preferintele tale privind proprietatile cautate, istoricul solicitarilor trimise, precum si informatii tehnice minime necesare pentru securitatea si functionarea formularului.',
        'Atunci cand soliciti informatii despre o proprietate sau doresti programarea unei vizionari, putem asocia cererea ta cu proprietatea vizualizata, agentia responsabila si data la care ai trimis formularul.',
      ],
    },
    {
      title: '3. In ce scop folosim datele',
      paragraphs: [
        'Datele sunt utilizate pentru a raspunde solicitarilor transmise, pentru a lua legatura cu tine in legatura cu o proprietate sau cu serviciile Agentiei, pentru a organiza vizionari, pentru a formula oferte si pentru a desfasura comunicari comerciale strict legate de interesul exprimat de tine.',
        'De asemenea, datele pot fi folosite pentru administrarea relatiei cu clientii, pentru documentarea discutiilor avute, pentru prevenirea mesajelor spam sau abuzive si pentru protejarea website-ului si a sistemelor interne asociate.',
      ],
    },
    {
      title: '4. Temeiul legal al prelucrarii',
      paragraphs: [
        'Prelucrarea datelor se bazeaza, dupa caz, pe demersurile facute de persoana vizata inainte de incheierea unui contract, pe executarea unui contract, pe interesul legitim al Agentiei de a administra solicitarile primite si de a proteja infrastructura digitala, precum si pe obligatiile legale aplicabile activitatii sale.',
        'In situatiile in care este necesar, Agentia poate solicita consimtamantul tau expres pentru anumite comunicari sau prelucrari suplimentare.',
      ],
    },
    {
      title: '5. Cui pot fi divulgate datele',
      paragraphs: [
        'Datele tale pot fi accesate doar de catre persoanele autorizate din cadrul Agentiei si, daca este necesar, de catre colaboratori sau furnizori care asigura servicii tehnice, gazduire, email, CRM, programare vizionari sau asistenta operationala, exclusiv in masura necesara pentru furnizarea serviciilor.',
        'Datele nu sunt vandute si nu sunt transferate catre terti in scopuri incompatibile cu relatia initiata prin website. Orice transmitere se face numai in conditiile impuse de lege si cu masuri rezonabile de confidentialitate si securitate.',
      ],
    },
    {
      title: '6. Cat timp pastram datele',
      paragraphs: [
        'Datele sunt pastrate pe durata necesara solutionarii solicitarii tale, continuarii relatiei comerciale si indeplinirii obligatiilor legale sau de evidenta aplicabile Agentiei.',
        'Daca discutia nu se concretizeaza, Agentia poate pastra datele pentru o perioada rezonabila necesara documentarii interactiunilor si protejarii intereselor sale legitime, dupa care acestea sunt sterse, anonimizate sau arhivate conform politicilor interne si cerintelor legale.',
      ],
    },
    {
      title: '7. Drepturile persoanei vizate',
      paragraphs: [
        'In conditiile prevazute de legislatia aplicabila, ai dreptul de a solicita accesul la datele tale, rectificarea acestora, stergerea, restrictionarea prelucrarii, opozitia la prelucrare, precum si portabilitatea datelor atunci cand aceasta este aplicabila.',
        'De asemenea, ai dreptul de a depune o plangere la autoritatea competenta pentru protectia datelor daca apreciezi ca drepturile tale au fost incalcate.',
      ],
    },
    {
      title: '8. Cum ne poti contacta',
      paragraphs: [
        `Pentru orice solicitare privind datele tale personale, actualizarea sau stergerea acestora, poti contacta Agentia folosind urmatoarele date: telefon ${identity.phone}, email ${identity.email}, sediu social ${identity.registeredOffice}.`,
        `Solicitarile vor fi analizate in mod rezonabil si tratate in functie de natura lor, de obligatiile legale aplicabile si de relatia existenta cu Agentia.`,
      ],
    },
    {
      title: '9. Masuri de securitate si actualizari',
      paragraphs: [
        'Agentia aplica masuri rezonabile pentru a proteja datele cu caracter personal impotriva accesului neautorizat, pierderii, distrugerii sau divulgarii nepermise. Totusi, nicio transmitere de date prin internet nu poate fi garantata ca fiind complet lipsita de riscuri.',
        'Aceasta pagina poate fi actualizata periodic pentru a reflecta modificari legislative, operationale sau tehnice. Versiunea publicata pe website este versiunea aplicabila la momentul consultarii.',
      ],
    },
    ...(extraClauses
      ? [
          {
            title: '10. Informatii suplimentare comunicate de Agentie',
            paragraphs: [extraClauses],
          },
        ]
      : []),
  ];
}
