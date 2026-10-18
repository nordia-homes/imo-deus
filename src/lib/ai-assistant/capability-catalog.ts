import { capabilityScore } from './capability-discovery';
import { normalized } from './contracts';
export const CAPABILITY_VERSION = '2';
// Workflow hints expose existing authorized tools; they never grant execution rights.
export const FACEBOOK_PUBLICATION_TOOLS = ['facebook_publication_preflight'] as const;
export const capabilityCatalog = [
    { id: 'properties', description: 'Căutare și gestionare proprietăți, anunțuri, preț, camere, zonă', terms: 'propriet apartament garsonier casa case teren oferta oferte pret buget chirie inchiri vanzar camere titan pipera', dependencies: [] },
    { id: 'contacts', description: 'Cumpărători, clienți, persoane și cerințe', terms: 'cumparator client contact persoan telefon nume', dependencies: [] },
    { id: 'calendar', description: 'Vizionări, sarcini, calendar, disponibilitate și reprogramare', terms: 'vizion task sarcin calendar programe reprogram ora maine astazi ieri intalnir urgent follow-up', dependencies: ['properties', 'contacts'] },
    { id: 'prospecting', description: 'Prospecte, proprietari, preluare, colaborare și apeluri AI', terms: 'prospect proprietar prelu colabor refuz outreach apel suna sunat telefonic', dependencies: ['properties'] },
    { id: 'communications', description: 'WhatsApp, mesaje, conversații, șabloane și confirmări', terms: 'whatsapp mesaj conversat inbox template sablon contacteaza trimite confirm', dependencies: ['contacts'] },
    { id: 'matching', description: 'Matching, recomandări și portalul clientului', terms: 'matching potrivit potrivire recomand portal', dependencies: ['properties', 'contacts'] },
    { id: 'marketing', description: 'Facebook, Meta Ads, TikTok, social media și materiale video', terms: 'facebook meta tiktok instagram campani reclama public postare grup social video film imagine fotograf poza', dependencies: ['properties'] },
    { id: 'sales', description: 'Vânzări finalizate, dosare, oferte de negociere, contracte și documente', terms: 'sales dosar notar contract document negocier oferta acceptata comision', dependencies: ['properties', 'contacts'] },
    { id: 'knowledge', description: 'Cunoștințe imobiliare, juridic și surse oficiale', terms: 'juridic legal lege legisl fiscal impozit strategie invata sursa oficial', dependencies: [] },
    { id: 'automation', description: 'Automatizări, monitorizare, rapoarte și notificări', terms: 'automat monitor recurent brief raport statist insight notific alerta zilnic', dependencies: [] },
    { id: 'settings', description: 'Agenție, profil, cont, abonament și integrări', terms: 'agentie profil cont abonament factura billing setari configur integra conexiune domeniu', dependencies: [] },
] as const;
export type CapabilityId = typeof capabilityCatalog[number]['id'];
export const capabilityIds = capabilityCatalog.map(row => row.id);
export function expandCapabilities(ids: readonly string[]): CapabilityId[] {
    const selected = new Set<CapabilityId>();
    const add = (id: string) => { const entry = capabilityCatalog.find(row => row.id === id); if (!entry)
        throw new Error('Capabilitate necunoscută.'); if (selected.has(entry.id))
        return; selected.add(entry.id); entry.dependencies.forEach(add); };
    ids.forEach(add);
    return capabilityIds.filter(id => selected.has(id));
}
export function selectCapabilities(text: string): CapabilityId[] {
    const words = normalized(text).split(/[^a-z0-9-]+/);
    return expandCapabilities(capabilityCatalog.filter(entry => entry.terms.split(' ').some(term => words.some(word => word.startsWith(term)))).map(entry => entry.id));
}
// Schema and authorization remain in the registry. This is presentation metadata only.
export function toolCapabilities(name: string): CapabilityId[] {
    if (/^(read|read_related|read_field|query_records|data_catalog|capability_status|operation_contract|discover_tools|existing_read|propose_actions|goal_coverage|load_capabilities|select_context|resolve_datetime|shift_datetime|analyze_records|parallel_read|delegate_read|search_global|timeline|conversation_history|request_recovery)$/.test(name))
        return [];
    if (/matching|match_|portal/.test(name))
        return ['matching'];
    if (/viewing|task|calendar|today_review|tomorrow_order/.test(name))
        return ['calendar'];
    if (/prospect|owner_|outreach/.test(name))
        return ['prospecting'];
    if (/whatsapp|message|conversation|communication/.test(name))
        return ['communications'];
    if (/property|properties|search_properties|storia/.test(name))
        return ['properties'];
    if (/contact|buyer/.test(name))
        return ['contacts'];
    if (/meta_|tiktok|social|facebook|video/.test(name))
        return ['marketing'];
    if (/sale|offer|contract|file_|document|email/.test(name))
        return ['sales'];
    if (/knowledge|legal/.test(name))
        return ['knowledge'];
    if (/automation|event_rule|insight|notification/.test(name))
        return ['automation'];
    if (/profile|agency|billing|domain|integration|preference|mcp_/.test(name))
        return ['settings'];
    return []; // Unknown registered tools stay visible; never silently hide a new capability.
}
export function visibleTools(names: readonly string[], modules: readonly string[], query = '', requested: readonly string[] = [], rankedLimit = 6) {
    const base = new Set(['query_records', 'request_recovery', 'conversation_history', 'read', 'read_field', 'operation_contract', 'discover_tools', 'existing_read', 'propose_actions', 'goal_coverage', 'load_capabilities', 'resolve_datetime', 'select_context']);
    if (rankedLimit === 0) ['existing_read', 'read_field', 'select_context'].forEach(name => base.delete(name));
    const candidates = names.filter(name => toolCapabilities(name).every(id => modules.includes(id)));
    const ranked = candidates.filter(name => !base.has(name)).map(name => ({ name, score: capabilityScore(query, name) })).filter(row => row.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, rankedLimit).map(row => row.name);
    if (modules.includes('properties'))
        base.add('search_properties');
    if (modules.includes('marketing') && /facebook/i.test(query)) FACEBOOK_PUBLICATION_TOOLS.forEach(name => base.add(name));
    const selected = new Set([...base, ...ranked, ...requested]);
    return names.filter(name => selected.has(name));
}
export type PolicyBlock = {
    id: string;
    modules: readonly CapabilityId[];
    text: string;
};
export function policyBlock(id: string, modules: readonly CapabilityId[], text: string): PolicyBlock { return { id, modules, text }; }
const policyTriggers: Record<string, string[]> = { "general-05": ["tomorrow_order"], "general-06": ["today_review"], "general-29": ["viewing_confirmation_draft"], "general-30": ["viewing_attendance"], "general-31": ["viewing_risk"], "general-32": ["calendar_availability"], "general-33": ["task_deferral"], "general-34": ["task_priorities"], "general-35": ["task_agenda"], "general-36": ["create_task"], "general-37": ["viewing_followups"], "general-38": ["property_viewings"], "general-39": ["viewing_details"], "general-44": ["update_viewing", "shift_datetime"] };
export function renderPolicy(blocks: PolicyBlock[], modules?: readonly CapabilityId[], tools?: readonly string[]) { return blocks.filter(block => !modules || !block.modules.length || block.modules.some(id => modules.includes(id))).filter(block => !modules || !tools || !policyTriggers[block.id] || policyTriggers[block.id].some(tool => tools.includes(tool))).map(block => block.text).join('\n'); }

export function requiresToolPolicy(name: string) { return Object.values(policyTriggers).some(names => names.includes(name)); }
