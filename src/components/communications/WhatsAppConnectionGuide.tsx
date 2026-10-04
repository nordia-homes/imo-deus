import Link from 'next/link';
import { ArrowUpRight, BookOpen, Check, FileText, Phone, ShieldCheck, Wallet } from 'lucide-react';

type Props = { admin: boolean; pilot: boolean; onConnect: () => void; onTemplates: () => void; onBudget: () => void };
type Step = { place: string; title: string; actions: string[]; result: string; note?: string };
const steps: Step[] = [
  {
    place: 'PREGĂTIRE', title: 'Pregătește accesul și datele firmei',
    actions: [
      'Dacă nu ai un profil Facebook, creează unul pe facebook.com cu datele tale reale. Deschide ImoDeus în browser și intră în agenția pentru care vrei să conectezi numărul. Conectarea, bugetul și crearea șabloanelor se fac dintr-un cont de administrator CRM.',
      'Pregătește denumirea firmei, adresa, site-ul și adresa de e-mail de business. Pentru o verificare cerută ulterior de Meta, vei avea nevoie de documentele firmei.',
      'Ține la îndemână telefonul numărului de conectat, datele de autentificare Facebook și un al doilea telefon cu WhatsApp pentru test.',
    ],
    result: 'Ai acces la agenția corectă și la telefon. Dacă ești agent fără rol de administrator, cere administratorului agenției să facă configurarea.',
  },
  {
    place: 'META · BUSINESS SUITE', title: 'Creează sau selectează portofoliul de business',
    actions: [
      'Deschide Meta Business Suite din butonul de la începutul ghidului și autentifică-te cu propriul profil Facebook care administrează firma.',
      'Deschide selectorul de business din partea stângă sus și alege portofoliul agenției. Portofoliul este spațiul Meta care deține conturile firmei, inclusiv contul WhatsApp Business.',
      'Dacă nu există un portofoliu pentru agenție, folosește „Creează un portofoliu de business” / „Create a business portfolio”, când este disponibil în selector, sau creează-l în fereastra de conectare de la pasul 6. Completează numele agenției, numele tău și e-mailul de business; confirmă e-mailul dacă Meta cere acest lucru.',
    ],
    result: 'Poți identifica portofoliul agenției. Dacă firma are deja unul, folosește-l; cere acces proprietarului înainte de a crea un duplicat.',
    note: 'Denumirile din Meta pot apărea în română sau engleză. Aspectul și ordinea ecranelor variază între conturi.',
  },
  {
    place: 'META · SETĂRI', title: 'Verifică informațiile și drepturile de acces',
    actions: [
      'În portofoliul selectat, deschide „Setări” / „Settings”. În „Informații despre portofoliul de business” / „Business info”, verifică denumirea legală, adresa, telefonul și site-ul; salvează corecțiile necesare.',
      'În „Persoane” / „People” (uneori sub „Utilizatori” / „Users”), selectează profilul tău și verifică dacă ai „Control deplin” / „Full control” asupra portofoliului.',
      'Dacă vei folosi un cont WhatsApp Business deja existent, verifică în „Conturi” → „Conturi WhatsApp” / „Accounts” → „WhatsApp accounts” că ai acces și la acel cont. Dacă nu, cere proprietarului portofoliului să îți acorde acces.',
    ],
    result: 'Profilul Meta cu care vei autoriza conectarea are acces la firma și contul potrivit.',
    note: 'Rolul de administrator CRM și accesul Meta se acordă separat. Accesul la o pagină Facebook nu confirmă automat accesul la portofoliu sau la contul WhatsApp.',
  },
  {
    place: 'PREGĂTIRE · NUMĂRUL', title: 'Alege varianta potrivită pentru telefonul tău',
    actions: [
      'Număr dedicat: folosește un număr al agenției care poate primi SMS sau apel de verificare și care nu este deja înregistrat în WhatsApp personal, WhatsApp Business App sau la alt furnizor. Acest număr va fi folosit în CRM.',
      'Număr existent în WhatsApp Business App: păstrează aplicația pe telefonul principal, actualizeaz-o și folosește varianta pentru număr existent. Meta decide dacă numărul poate fi conectat păstrând și aplicația (Coexistence).',
      'Dacă numărul este în WhatsApp personal sau la alt furnizor, oprește configurarea acestui număr și clarifică mutarea cu suportul. Pentru a începe fără transfer, folosește un alt număr dedicat.',
    ],
    result: 'Știi ce opțiune vei selecta în CRM: „Număr dedicat Cloud API” sau „Număr existent în WhatsApp Business App”.',
    note: 'Nu șterge contul WhatsApp existent pentru a forța conectarea. Conectarea cu Business App nu garantează importul întregului istoric în CRM.',
  },
  {
    place: 'CRM · MARKETING → WHATSAPP', title: 'Pornește conectarea din ImoDeus',
    actions: [
      'Deschide pagina WhatsApp din Marketing și apasă „Conectează număr”, deasupra cardurilor, sau butonul din acest ghid. Formularul apare în secțiunea numerelor.',
      'Alege opțiunea stabilită la pasul 4. Pentru „Număr dedicat Cloud API”, introdu în câmpul de securitate un PIN din exact 6 cifre și păstrează-l în siguranță.',
      'Apasă „Conectează WhatsApp”. Când apare al doilea buton, apasă „Deschide fereastra Meta”. Dacă nu apare fereastra, permite pop-up-urile pentru ImoDeus și apasă din nou butonul.',
    ],
    result: 'Ai în față fereastra de autorizare Meta. Pentru varianta Business App, CRM-ul nu îți cere PIN-ul numărului dedicat.',
    note: 'Dacă butonul de conectare este dezactivat, verifică rolul CRM și mesajul afișat. Accesul pilot sau configurația platformei se rezolvă cu suportul ImoDeus.',
  },
  {
    place: 'META · FEREASTRA DE CONECTARE', title: 'Autorizează agenția și contul WhatsApp Business',
    actions: [
      'Autentifică-te cu profilul verificat la pasul 3. Citește accesul solicitat și termenii afișați, apoi continuă autorizarea.',
      'Când Meta cere portofoliul de business, selectează agenția pregătită la pasul 2. Dacă îl creezi aici, completează datele reale ale firmei în câmpurile solicitate.',
      'Selectează contul WhatsApp Business al agenției sau alege crearea unui cont nou dacă nu există. Completează profilul solicitat: denumirea afișată, categoria și datele de contact. Folosește o denumire care identifică agenția.',
    ],
    result: 'Portofoliul, contul WhatsApp Business și profilul aparțin aceleiași agenții. Urmărește denumirile înainte să continui.',
    note: 'Contul WhatsApp Business din Meta grupează numerele firmei; este diferit de profilul Facebook cu care te autentifici. Nu ai nevoie să creezi o aplicație în Meta for Developers sau să copiezi tokenuri în CRM.',
  },
  {
    place: 'META + TELEFON', title: 'Verifică numărul și finalizează toate ecranele',
    actions: [
      'Pentru număr dedicat: selectează țara/prefixul (+40 pentru România), introdu numărul și alege SMS sau apel, conform opțiunilor Meta. Introdu codul primit pe acel număr. Dacă Meta afișează deja un număr existent în cont, selectează-l numai dacă este cel pregătit pentru această conectare.',
      'Pentru Business App: introdu sau selectează numărul existent când Meta îl solicită. Deschide WhatsApp Business pe telefonul principal și urmează solicitarea de conectare afișată de Meta; dacă apare un QR, folosește instrucțiunile din acel ecran pentru a-l scana. Confirmă pe telefon accesul și opțiunile de partajare afișate.',
      'Continuă până la ecranul final de confirmare și încheie fluxul. Lasă pagina CRM deschisă până când primești confirmarea conectării.',
    ],
    result: 'În ImoDeus apare mesajul că numărul a fost conectat și cardul numărului este afișat.',
    note: 'Codul SMS/apel confirmă accesul la număr; PIN-ul din CRM securizează numărul dedicat. Dacă Meta refuză eligibilitatea Business App, revino la pasul 4 și folosește un număr dedicat. Nu folosi un QR obișnuit de WhatsApp Web în locul fluxului Meta.',
  },
  {
    place: 'CRM · PRIVIRE DE ANSAMBLU', title: 'Verifică rezultatul conectării',
    actions: [
      'Apasă „Actualizează” și verifică numele agenției, numărul și indicatorul „Conectat la Meta” din card.',
      'Citește separat „Primire mesaje”, „Trimitere mesaje” și „Șabloane”, inclusiv explicația de sub fiecare stare. Primirea poate rămâne „De configurat” până când trimiți mesajul de test de la pasul 13.',
      'Verifică moneda afișată în subsolul cardului. Dacă lipsește și cardul cere configurarea facturării, fă pasul 10, apoi reia „Conectează număr” pentru același cont și același număr. Nu apăsa „Deconectează” ca pas de rutină.',
    ],
    result: 'Contul este conectat, iar pentru orice stare încă neactivă ai identificat explicația exactă.',
    note: '„Actualizează” reîncarcă stările salvate în CRM; nu recitește moneda de facturare din Meta. Moneda este reverificată la reconectare.',
  },
  {
    place: 'META · WHATSAPP MANAGER + SETĂRI', title: 'Rezolvă alertele Meta și verificarea firmei',
    actions: [
      'Revino în Meta Business Suite, cu același portofoliu selectat. Deschide „Toate instrumentele” / „All tools” → „WhatsApp Manager”. Alternativ, în Setări → Conturi → Conturi WhatsApp, selectează contul și deschide-l în WhatsApp Manager.',
      'În contul potrivit, deschide „Numere de telefon” / „Phone numbers” și verifică numărul conectat, numele afișat și eventualele mesaje de eroare. Deschide alerta și urmează remedierea indicată de Meta.',
      'Dacă Meta solicită verificarea firmei, mergi la Setări → „Centrul de securitate” / „Security Centre”, pornește verificarea disponibilă și completează datele/documentele cerute. Urmărește rezultatul în Meta.',
    ],
    result: 'Ai verificat numărul și alertele contului. Dacă o verificare sau revizuire este în curs, știi ce solicită Meta înainte de a continua.',
    note: 'Verificarea firmei, verificarea numărului, revizuirea numelui afișat și abonamentul Meta Verified sunt procese diferite. Nu presupune că trebuie cumpărat Meta Verified pentru această conectare.',
  },
  {
    place: 'META · FACTURARE ȘI PLĂȚI', title: 'Configurează plata contului WhatsApp',
    actions: [
      'În Business Suite, deschide „Facturare și plăți” / „Billing & payments” și selectează contul WhatsApp Business conectat. Dacă ai intrat din WhatsApp Manager, folosește setările de plată ale acelui cont.',
      'Verifică numele și tipul contului selectat înainte de a adăuga metoda de plată. Folosește acțiunea de adăugare disponibilă, completează datele cerute de Meta și finalizează orice confirmare afișată.',
      'Verifică în același cont moneda de facturare și eventualele alerte de plată. Reține moneda pentru pasul 11. Dacă nu vezi secțiunea de plată, cere acces persoanei care gestionează finanțele portofoliului.',
    ],
    result: 'Contul WhatsApp are configurația de plată cerută de Meta și ai identificat moneda lui. Dacă lipsea în CRM, fă reconectarea explicată la pasul 8.',
    note: 'Verifică plata pentru WhatsApp, nu doar cardul unui cont de reclame. Bugetul CRM nu adaugă bani în Meta și nu schimbă moneda contului.',
  },
  {
    place: 'CRM · CONSUM ȘI BUGET', title: 'Salvează plafonul în moneda contului',
    actions: [
      'În pagina WhatsApp, deschide fila „Consum și buget”. Introdu limita acceptată de agenție în câmpul „Plafon lunar”.',
      'În „Monedă”, alege exact moneda contului confirmată în Meta și afișată în cardul numărului. Apasă „Salvează plafonul”. Dacă moneda nu este disponibilă în selector, cere suportului configurarea ei; nu selecta o monedă diferită.',
      'Verifică mesajul de confirmare și cardul de buget pentru moneda aleasă. Plafonul salvat este pentru luna curentă; verifică bugetul și la începutul lunii următoare.',
    ],
    result: 'Vezi limita salvată și moneda corectă în CRM. Un plafon zero sau epuizat poate bloca mesajele care au cost.',
    note: 'Sumele din CRM sunt estimări. Tarifele indisponibile sau expirate necesită intervenția suportului ImoDeus; schimbarea plafonului nu rezolvă lipsa tarifului.',
  },
  {
    place: 'CRM · ȘABLOANE', title: 'Creează primul șablon și așteaptă aprobarea',
    actions: [
      'Deschide „Șabloane”. La „Cont WhatsApp”, alege numărul agenției. Dacă există deja un șablon potrivit cu starea „Aprobat”, îl poți folosi fără să creezi unul nou.',
      'În „Creează un șablon”, completează „Nume intern” (de exemplu confirmare_vizionare), „Limba”, „Categorie” și „Mesaj”. Alege „Utilitar” pentru o solicitare/tranzacție existentă sau „Marketing” pentru oferte și promovare. Un exemplu utilitar, doar pentru o vizionare convenită: „Bună! Îți confirmăm vizionarea stabilită cu agenția noastră. Dacă ai nevoie de ajutor, răspunde aici.”',
      'Pentru primul test folosește text simplu, fără variabile sau atașamente; butoanele sunt opționale. Verifică previzualizarea, apoi apasă „Trimite șablonul spre aprobare”. Revino și apasă „Actualizează” în această filă până când rezultatul revizuirii este disponibil.',
    ],
    result: 'Șablonul apare în bibliotecă. Folosește-l numai cu starea „Aprobat”; „În verificare”, „Respins”, „În pauză” sau „Dezactivat” nu permit trimiterea.',
    note: 'Meta poate modifica încadrarea categoriei. Crearea șablonului nu trimite mesaje și nu garantează aprobarea; pentru un șablon respins verifică motivul în WhatsApp Manager.',
  },
  {
    place: 'TELEFON DE TEST + CRM · INBOX', title: 'Testează primirea și răspunsul din CRM',
    actions: [
      'De pe al doilea telefon, salvează numărul agenției cu prefix internațional și trimite-i un mesaj WhatsApp, de exemplu „Test conectare agenție”. Dacă pagina arată modul pilot, folosește un destinatar de test autorizat de suport.',
      'Deschide „Inbox” în CRM și selectează conversația de test. Ca administrator vezi conversațiile agenției; pentru un agent, administratorul trebuie să îi atribuie conversația sau să îi acorde acces la ea.',
      'Alege „Răspuns către client” și „Mesaj liber”, scrie răspunsul și apasă „Verifică trimiterea”. Dacă verificarea reușește, trimite mesajul și confirmă pe telefon că a ajuns. Revino în pagina WhatsApp și apasă „Actualizează” pentru a verifica primirea.',
    ],
    result: 'Mesajul primit apare în Inbox, răspunsul ajunge pe telefon, iar „Primire mesaje” devine „Activ” după procesarea mesajului.',
    note: 'Răspunsul liber se trimite în intervalul de 24 de ore de la ultimul mesaj al clientului. După acest interval folosește un șablon aprobat. Starea „Trimis către Meta” nu confirmă singură livrarea.',
  },
  {
    place: 'CRM · INBOX → DETALII CLIENT', title: 'Înregistrează acordul și testează șablonul',
    actions: [
      'Cu acordul real al persoanei de test, deschide conversația pe desktop, apasă „Detalii client” și extinde „Consimțământ WhatsApp”. Ca administrator, selectează „Comunicare de serviciu” pentru șabloane utilitare sau „Oferte / marketing” pentru șabloane de marketing.',
      'În „Dovada și data acordului sau retragerii”, descrie când, cum și pentru ce a fost dat acordul (minimum 10 caractere). Apasă „Înregistrează”. Nu înregistra acordul dacă persoana nu l-a dat.',
      'În „Răspuns către client”, selectează șablonul aprobat din „Șablon WhatsApp”. Pentru un șablon text simplu creat la pasul 12, lasă parametrii goi. Apasă „Verifică trimiterea”, verifică textul și costul estimat, apoi trimite și confirmă primirea pe telefon.',
    ],
    result: 'Ai verificat și trimiterea prin șablon, cu acordul pentru scopul potrivit și bugetul disponibil. Pentru un agent, înregistrarea acordului se face de administrator.',
    note: 'Pentru un contact CRM existent, butonul „+” din Inbox deschide o conversație nouă: introdu „ID contact CRM”, alege numărul agenției și apasă „Deschide conversația”; acest lucru nu trimite automat un mesaj. Retragerea acordului se înregistrează din aceeași secțiune de consimțământ.',
  },
];
const phases = [
  { id: 'wa-guide-prepare', title: 'Pregătește agenția', range: 'Pașii 01–04', from: 0, to: 4 },
  { id: 'wa-guide-connect', title: 'Conectează numărul', range: 'Pașii 05–08', from: 4, to: 8 },
  { id: 'wa-guide-activate', title: 'Configurează trimiterea', range: 'Pașii 09–12', from: 8, to: 12 },
  { id: 'wa-guide-test', title: 'Testează în CRM', range: 'Pașii 13–14', from: 12, to: 14 },
];
const problems = [
  ['Butonul CRM este dezactivat', 'Verifică rolul de administrator și mesajul din formular. Pentru pilot, autorizarea utilizatorului CRM, accesul Meta și destinatarul de test se verifică împreună cu suportul ImoDeus. Crearea unui alt portofoliu nu activează pilotul.'],
  ['Fereastra Meta nu apare sau sesiunea a expirat', 'Permite pop-up-urile pentru ImoDeus și apasă explicit „Deschide fereastra Meta”. Dacă sesiunea a expirat, apasă „Anulează conectarea”, apoi reia pașii 5–7.'],
  ['Portofoliul sau contul nu apare', 'Verifică profilul Facebook conectat, portofoliul ales și accesul din Setări → Persoane / Conturi WhatsApp. Cere proprietarului acces; nu crea un cont duplicat doar pentru a ocoli lipsa drepturilor.'],
  ['Codul SMS/apel nu ajunge', 'Verifică prefixul, numărul și posibilitatea de a primi SMS/apel. Respectă intervalul de reîncercare afișat de Meta și încearcă metoda alternativă, dacă este disponibilă. Pentru un număr deja folosit, revino la pasul 4.'],
  ['Business App nu este eligibil sau numărul este la alt furnizor', 'Pentru un Business App neeligibil, folosește un număr dedicat diferit. Pentru un număr la alt furnizor, cere instrucțiunile de transfer acelui furnizor și suportului ImoDeus înainte să îl modifici.'],
  ['Lipsește moneda sau apare „Reconectare necesară”', 'Pentru moneda lipsă, configurează facturarea în Meta și reautorizează același cont și număr prin „Conectează număr”. Pentru autorizare expirată, reia conectarea cu profilul Meta care are acces. „Actualizează” nu repară autorizarea.'],
  ['Mesajul de test nu apare în Inbox', 'Verifică numărul destinatar și că mesajul a fost trimis de pe alt telefon. Administratorul verifică Inbox; agentul verifică atribuirea conversației. Dacă tot lipsește, trimite suportului numărul, ora testului și eroarea din card, fără PIN sau coduri SMS.'],
  ['Verificarea sau trimiterea eșuează', 'Urmează eroarea afișată: destinatar pilot → suport; acord lipsă → pasul 14; șablon neaprobat → pasul 12; fereastră expirată → șablon aprobat; buget → pasul 11; plată → pasul 10; tarif lipsă/expirat → suport ImoDeus.'],
];

export default function WhatsAppConnectionGuide({ admin, pilot, onConnect, onTemplates, onBudget }: Props) {
  return <section className="wa-panel wa-connection-guide" aria-labelledby="wa-connection-guide-title">
    <header className="wa-connection-guide-header">
      <span className="wa-icon"><BookOpen size={22} aria-hidden="true" /></span>
      <div><span className="wa-eyebrow">DE LA ZERO · META + CRM</span>
        <h2 id="wa-connection-guide-title">Conectează WhatsApp, pas cu pas.</h2>
        <p>14 pași, în ordinea în care îi faci. Fiecare etapă îți arată unde intri, ce completezi și ce trebuie să vezi înainte să continui.</p>
      </div>
    </header>
    <div className="wa-connection-checklist"><strong>Ai nevoie de</strong>
      <span><ShieldCheck size={16} aria-hidden="true" /> Administrator CRM + acces Meta</span>
      <span><Phone size={16} aria-hidden="true" /> Numărul agenției + telefon de test</span>
      <span><FileText size={16} aria-hidden="true" /> Datele firmei + e-mail de business</span>
    </div>
    {pilot && <p className="wa-connection-access-note"><strong>Acest spațiu este în modul pilot.</strong> Conectarea și testele sunt disponibile conturilor și destinatarilor autorizați. Dacă accesul este blocat, cere suportului ImoDeus autorizarea înainte de a modifica setările Meta.</p>}
    {!admin && <p className="wa-connection-access-note"><strong>Configurarea necesită un administrator CRM.</strong> Poți parcurge ghidul; cere administratorului agenției să conecteze numărul, să configureze bugetul și să înregistreze acordul clientului.</p>}
    <div className="wa-connection-shortcuts" aria-label="Acțiuni pentru conectarea WhatsApp">
      {admin && <button className="wa-btn wa-primary" onClick={onConnect}><Phone size={16} aria-hidden="true" /> Conectează număr</button>}
      <a className="wa-btn" href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer">Meta Business Suite <ArrowUpRight size={16} aria-hidden="true" /><span className="wa-visually-hidden"> (filă nouă)</span></a>
      <a className="wa-btn" href="https://business.facebook.com/wa/manage/" target="_blank" rel="noopener noreferrer">WhatsApp Manager <ArrowUpRight size={16} aria-hidden="true" /><span className="wa-visually-hidden"> (filă nouă)</span></a>
      <button className="wa-btn" onClick={onBudget}><Wallet size={16} aria-hidden="true" /> Consum și buget</button>
      <button className="wa-btn" onClick={onTemplates}><FileText size={16} aria-hidden="true" /> Șabloane</button>
      <Link className="wa-btn" href="/inbox"><Check size={16} aria-hidden="true" /> Testează în Inbox</Link>
    </div>
    <nav className="wa-connection-phase-nav" aria-label="Etapele ghidului WhatsApp">{phases.map((phase, index) =>
      <a key={phase.id} href={'#' + phase.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{phase.title}</strong><small>{phase.range}</small></div></a>
    )}</nav>
    <p className="wa-connection-resume">Ai deja numărul conectat? Verifică întâi rezultatul la <a href="#wa-guide-step-8">pasul 8</a>, apoi continuă configurarea. Urmează pașii Meta după funcția și denumirea meniului; poziția lor poate varia între conturi.</p>
    {phases.map(phase => <section className="wa-connection-phase" key={phase.id} aria-labelledby={phase.id}>
      <h3 id={phase.id}><span>{phase.range}</span>{phase.title}</h3>
      <ol className="wa-connection-steps" start={phase.from + 1}>{steps.slice(phase.from, phase.to).map((step, offset) => {
        const number = phase.from + offset + 1;
        return <li key={step.title} id={'wa-guide-step-' + number}>
          <span className="wa-connection-step-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
          <div className="wa-connection-step-content"><span className="wa-connection-step-place">{step.place}</span><h4>{step.title}</h4>
            <div className="wa-connection-step-layout"><ol className="wa-connection-actions">{step.actions.map(action => <li key={action}>{action}</li>)}</ol>
              <aside className="wa-connection-result"><strong><Check size={16} aria-hidden="true" /> Înainte să continui</strong><p>{step.result}</p>{step.note && <p className="wa-connection-step-hint">{step.note}</p>}</aside>
            </div>
          </div>
        </li>;
      })}</ol>
    </section>)}

    <section className="wa-connection-troubleshooting" aria-labelledby="wa-guide-help-title"><h3 id="wa-guide-help-title">Dacă te blochezi, începe de aici.</h3>
      <div>{problems.map(([title, body]) => <details className="wa-connection-help" key={title}><summary>{title}</summary><p>{body}</p></details>)}</div>
    </section>
    <p className="wa-connection-source">Regulile pentru acordul clientului, șabloane și intervalul de răspuns: <a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">Politica oficială WhatsApp Business<span className="wa-visually-hidden"> (filă nouă)</span></a>.</p>
  </section>;
}
