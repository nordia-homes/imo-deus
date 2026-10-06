import { normalized } from './contracts';

const aliases: Record<string, string> = {
  create: 'creeaza adauga nou noua', update: 'modifica schimba actualizeaza editeaza',
  delete: 'sterge elimina', remove: 'sterge elimina retrage', start: 'porneste initiaza incepe',
  schedule: 'programeaza calendar', activate: 'activeaza', archive: 'arhiveaza dezarhiveaza reactiveaza',
  read: 'citeste consulta arata', pause: 'opreste pauza suspenda', featured: 'promovata evidentiata recomandata site',
  owner: 'proprietar anunt prospectare prospect colaborare preluare telefon pipera titan',
  prospect: 'proprietar anunt preluare colaborare refuz follow up',
  contact: 'client cumparator lead persoana', preferences: 'preferinte cerinte buget',
  offer: 'oferta acceptata refuzata negociere', interaction: 'interactiune nota discutie istoric',
  property: 'proprietate apartament casa teren etaj constructie suprafata pret portofoliu',
  viewing: 'vizionare calendar programare intalnire reprogramare', task: 'sarcina task follow up termen',
  sale: 'vanzare dosar notar tranzactie documente', portal: 'portal recomandare feedback link client',
  notification: 'notificare citit necitit alerta', automation: 'automatizare recurent monitorizare urmareste',
  outreach: 'apel suna telefoneaza convorbire vapi', email: 'email gmail mesaj notar',
  social: 'facebook instagram postare comentariu raspunde like', facebook: 'grup promovare facebook helper cloud',
  video: 'video film randare tur voce', tiktok: 'tiktok studio reclama campanie', meta: 'meta facebook instagram campanie reclama',
  billing: 'abonament factura plata locuri seats plan', agency: 'agent agentie echipa invitatie grupuri facebook tema aspect culoare branding sigla',
  profile: 'profil nume telefon avatar poza', domain: 'domeniu site dns', contract: 'contract template sablon document',
};
const ignored = new Set(['si', 'sa', 'de', 'in', 'din', 'pentru', 'care', 'cum', 'vreau', 'arata', 'toate', 'mi', 'un', 'o', 'the', 'a']);
export function capabilityScore(query: string, id: string, description = '') {
  const tokens = normalized(query).split(/[^a-z0-9]+/).filter(token => token.length > 2 && !ignored.has(token));
  const words = id.split('_');
  const haystack = normalized([id.replaceAll('_', ' '), description, ...words.map(word => aliases[word] || '')].join(' '));
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? (id.includes(token) ? 3 : 1) : 0), 0);
}
export function selectActionTools(query: string, names: string[], limit = 4) {
  return names.map(name => ({ name, score: capabilityScore(query, name) })).filter(row => row.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit).map(row => row.name);
}
