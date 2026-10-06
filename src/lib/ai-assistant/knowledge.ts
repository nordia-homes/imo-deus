import { normalized } from './contracts';

const playbooks = [
  ['prospecting', 'prospectare proprietar exclusivitate colaborare', 'Verifică istoricul, eligibilitatea și contactările recente. Clarifică motivația, termenul și așteptările proprietarului. Pregătește un argument bazat pe servicii reale și următorul pas concret. Nu inventa cumpărători, oferte sau consimțământ.'],
  ['qualification', 'client cumparator buget credit calificare', 'Clarifică bugetul, finanțarea, termenul, zonele și criteriile obligatorii. Compară cu preferințele CRM și confirmă schimbările. Folosește matching-ul existent; separă nepotrivirea de lipsa datelor.'],
  ['positioning', 'pret pozitionare evaluare comparabile', 'Folosește analiza de preț existentă și comparabilele disponibile, cu dată și limitări. Separă prețul cerut de cel tranzacționat. Nu prezenta o estimare drept evaluare certificată și nu modifica prețul fără aprobarea necesară.'],
  ['presentation', 'fotografie descriere prezentare video marketing', 'Verifică fotografiile, caracteristicile și lipsurile fișei. Prezintă beneficiile susținute de fapte; nu inventa suprafețe sau facilități. Adaptează materialul canalului și așteaptă randarea înainte de utilizare.'],
  ['followup', 'followup raspuns reactivare referral', 'Citește ultima conversație și promisiunile existente. Oferă un motiv concret pentru contact. Verifică răspunsul recent, opt-out și sarcinile existente. Pregătește mesajul înainte de approval; oprește secvența la răspuns.'],
  ['viewing', 'vizionare feedback confirmare programare', 'Verifică disponibilitatea proprietății, persoanelor și calendarului. Confirmă data și durata. După vizionare, cere feedback specific și stabilește pasul următor fără a duplica follow-up-ul.'],
  ['negotiation', 'oferta negociere contraoferta obiectii', 'Separă pozițiile declarate de interesele reale și de estimări. Verifică oferta existentă, finanțarea și termenii. Pregătește alternative argumentate. Nu transmite o contraofertă și nu inventa urgență fără instrucțiune și aprobare.'],
  ['transaction', 'closing vanzare notar documente tranzactie', 'Verifică etapa, checklistul și documentele existente în Sales. Identifică blocajul, responsabilul și termenul. Creează numai acțiunile operaționale permise. Generarea contractului nu dovedește semnarea lui. Aspectele juridice cer surse actuale și validare adecvată.'],
  ['campaign', 'campanie meta tiktok cpl buget performanta', 'Compară perioade comparabile, costul și calitatea leadurilor. Separă lipsa datelor de performanța slabă. Propune un test cu plafon și criteriu de oprire. Nu redistribui bugete fără aprobarea politicii.'],
  ['reporting', 'raport proprietar pipeline prioritati inchiriere chirias', 'Prezintă activitatea verificată, feedbackul și următoarea acțiune cu motiv. Marchează datele incomplete și impactul estimat. La închiriere verifică cerințele părților și pașii contractuali, fără promisiuni juridice nesusținute.'],
] as const;
export function searchPlaybooks(query: string, limit = 3) {
  const terms = normalized(query).split(/[^a-z0-9]+/).filter(term => term.length > 2);
  const scored = playbooks.map(([id, tags, text]) => ({ id, tags, text, score: terms.filter(term => tags.includes(term)).length })).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { rows: scored.slice(0, limit).map(({ id, text }) => ({ id, text, version: '2026-10-06', category: 'INTERNAL_PLAYBOOK', source: 'imoDeus editorial playbook', legalAuthority: false })), complete: true, note: 'Playbook-uri de lucru, nu fapte despre CRM și nu surse de drept.' };
}
