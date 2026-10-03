import Link from 'next/link';
import { ArrowUpRight, BookOpen, Check, FileText, Phone, ShieldCheck, Wallet } from 'lucide-react';

type Props = { admin: boolean; onConnect: () => void; onTemplates: () => void; onBudget: () => void };
const steps = [
  {
    place: 'META BUSINESS SUITE', title: 'Pregătește contul agenției',
    body: <>Intră în Meta Business Suite cu profilul care are <strong>control deplin asupra portofoliului de business</strong> al agenției. În Setări, verifică datele firmei: denumire, adresă și site. Dacă nu ai un portofoliu, îl poți crea în timpul conectării.</>,
    hint: 'Ai nevoie și de rol de administrator în ImoDeus pentru a conecta numărul.',
  },
  {
    place: 'IMODEUS · ACEASTĂ PAGINĂ', title: 'Alege cum conectezi numărul',
    body: <>Apasă <strong>Conectează număr</strong> și alege tipul de conectare. Pentru <strong>Număr dedicat Cloud API</strong>, setează un PIN de securitate din 6 cifre și păstrează-l în siguranță. Pentru un număr folosit deja în <strong>WhatsApp Business App</strong>, alege opțiunea pentru număr existent.</>,
    hint: 'Conectarea cu aplicația existentă depinde de eligibilitatea Meta. Dacă nu este disponibilă, folosește un număr dedicat; nu șterge contul existent pentru a continua.',
  },
  {
    place: 'FEREASTRA META', title: 'Autorizează conectarea',
    body: <>Apasă <strong>Conectează WhatsApp</strong>, apoi <strong>Deschide fereastra Meta</strong>. Autentifică-te, citește permisiunile și continuă. Selectează portofoliul agenției, apoi contul WhatsApp Business potrivit sau creează unul nou când Meta îți oferă această opțiune.</>,
    hint: 'Alege activele agenției pe care vrei să le folosești în ImoDeus.',
  },
  {
    place: 'FEREASTRA META', title: 'Confirmă identitatea și numărul',
    body: <>Completează profilul WhatsApp și numele afișat al agenției, dacă sunt solicitate. Pentru numărul dedicat, introdu prefixul țării și numărul, apoi codul primit prin <strong>SMS sau apel</strong>. Pentru WhatsApp Business App, urmează instrucțiunile afișate de Meta pe telefon, inclusiv scanarea codului QR dacă este cerută. Finalizează toate ecranele.</>,
    hint: 'Codul primit prin SMS sau apel este diferit de PIN-ul setat în ImoDeus. Ordinea ecranelor poate varia în Meta.',
  },
  {
    place: 'META · WHATSAPP MANAGER', title: 'Verifică plata și cerințele Meta',
    body: <>Din Meta Business Suite, deschide <strong>Toate instrumentele → WhatsApp Manager</strong> și selectează contul conectat. În setările de plată sau în <strong>Facturare și plăți</strong>, verifică metoda de plată pentru acel cont WhatsApp și moneda de facturare. În Setări → Centrul de securitate, finalizează verificarea firmei <strong>dacă Meta o solicită</strong>.</>,
    hint: 'Verifică eventualele alerte despre cont, număr sau numele afișat. Denumirile meniurilor pot varia în funcție de limba și versiunea Meta.',
  },
  {
    place: 'ÎNAPOI ÎN IMODEUS', title: 'Pregătește trimiterea mesajelor',
    body: <>Apasă <strong>Actualizează</strong> și verifică numărul și stările din card. În <strong>Consum și buget</strong>, salvează un plafon în moneda contului WhatsApp. În <strong>Șabloane</strong>, creează mesajul cu care vrei să începi o conversație și așteaptă aprobarea Meta înainte să îl folosești.</>,
    hint: 'Plafonul din ImoDeus controlează trimiterile; metoda de plată și factura se gestionează separat în Meta.',
  },
  {
    place: 'IMODEUS · INBOX', title: 'Testează prima conversație',
    body: <>De pe alt telefon, trimite un mesaj către numărul conectat. Deschide <strong>Inbox</strong>, verifică apariția mesajului și răspunde. Revino aici și apasă <strong>Actualizează</strong> pentru a verifica recepția. Pentru a iniția ulterior o conversație, folosește un șablon aprobat și asigură-te că persoana a acceptat să primească mesaje.</>,
    hint: '„Conectat la Meta” confirmă legătura contului. Verifică separat Primire mesaje, Trimitere mesaje și Șabloane.',
  },
];

export default function WhatsAppConnectionGuide({ admin, onConnect, onTemplates, onBudget }: Props) {
  return <section className="wa-panel wa-connection-guide" aria-labelledby="wa-connection-guide-title">
    <header className="wa-connection-guide-header">
      <span className="wa-icon"><BookOpen size={22} aria-hidden="true" /></span>
      <div><span className="wa-eyebrow">GHID DE CONECTARE · PAS CU PAS</span>
        <h2 id="wa-connection-guide-title">De la cont la prima conversație.</h2>
        <p>Urmează pașii în ordine. Dacă ai conectat deja numărul, continuă cu verificările de la pasul 5.</p>
      </div>
    </header>
    <div className="wa-connection-checklist"><strong>Înainte să începi</strong>
      <span><ShieldCheck size={16} aria-hidden="true" /> Acces de administrator</span>
      <span><Phone size={16} aria-hidden="true" /> Telefonul și numărul la îndemână</span>
      <span><FileText size={16} aria-hidden="true" /> Datele agenției</span>
    </div>
    <ol className="wa-connection-steps">{steps.map((step, index) => <li key={step.title}>
      <span className="wa-connection-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      <div><span className="wa-connection-step-place">{step.place}</span><h3>{step.title}</h3>
        <p>{step.body}</p><p className="wa-connection-step-hint">{step.hint}</p>
      </div>
    </li>)}</ol>
    <div className="wa-connection-shortcuts" aria-label="Acțiuni pentru conectarea WhatsApp">
      {admin && <button className="wa-btn wa-primary" onClick={onConnect}><Phone size={16} aria-hidden="true" /> Conectează număr</button>}
      <a className="wa-btn" href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer">Meta Business Suite <ArrowUpRight size={16} aria-hidden="true" /><span className="wa-visually-hidden"> (se deschide într-o filă nouă)</span></a>
      <button className="wa-btn" onClick={onBudget}><Wallet size={16} aria-hidden="true" /> Consum și buget</button>
      <button className="wa-btn" onClick={onTemplates}><FileText size={16} aria-hidden="true" /> Șabloane</button>
      <Link className="wa-btn" href="/inbox"><Check size={16} aria-hidden="true" /> Testează în Inbox</Link>
    </div>
    <details className="wa-connection-help"><summary>Te-ai blocat la un pas?</summary><ul>
      <li><strong>Fereastra Meta nu apare:</strong> permite ferestrele pop-up pentru ImoDeus și apasă „Deschide fereastra Meta”. Dacă sesiunea a expirat, reia conectarea.</li>
      <li><strong>Nu vezi portofoliul sau contul WhatsApp:</strong> verifică profilul cu care ești autentificat în Meta și cere administratorului firmei acces la activele potrivite.</li>
      <li><strong>Numărul este deja folosit:</strong> pentru WhatsApp Business App încearcă opțiunea de număr existent, dacă este eligibil. Pentru un număr conectat la alt furnizor, clarifică mai întâi transferul cu acel furnizor.</li>
      <li><strong>Contul este conectat, dar trimiterea nu este activă:</strong> citește motivul din card și verifică plata în Meta, moneda și plafonul din ImoDeus, apoi starea șablonului.</li>
    </ul></details>
  </section>;
}
