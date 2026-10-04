import { NextRequest } from 'next/server';
import { CommunicationError } from '@/lib/communications/server';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { safeData } from './contracts';
import type { AssistantContext } from './access';
import { operationResult } from './operation-result';
import { OperationFailure } from './operation-error';
import { collectionFor, getResource, actionReferences } from './access';
import { getStorage } from 'firebase-admin/storage';
import { randomUUID } from 'node:crypto';
import handlerContracts from './handler-contracts.json';
import { withAssistantPrincipal, INTERNAL_PRINCIPAL_HEADER } from './principal';

type Operation = { method: string; path: string; description: string; external?: boolean; readOnly?: boolean; load: () => Promise<any> };
// Explicit imports: no arbitrary URL, module, Firestore path or HTTP method from the model.
export const operations: Record<string, Operation> = {
  owner_query: { method: 'GET', path: '/api/owner-listings/query', description: 'Anunțuri proprietari: scopeKey, search, rooms, priceMin/Max, cursor.', load: () => import('@/app/api/owner-listings/query/route') },
  owner_prospect: { method: 'POST', path: '/api/owner-listings/prospecting', description: 'Adaugă/scoate anunț din prospectare: listingId, action add/remove/retry.', load: () => import('@/app/api/owner-listings/prospecting/route') },
  owner_import_preview: { method: 'POST', readOnly: true, path: '/api/owner-listings/import', description: 'Pregătește importul: source olx/imoradar24/publi24, url, listingId opțional; nu salvează proprietatea.', load: () => import('@/app/api/owner-listings/import/route') },
  conversation_list: { method: 'GET', path: '/api/communications/conversations', description: 'Conversații autorizate: contactId, channel, status, cursor.', load: () => import('@/app/api/communications/[...path]/route') },
  conversation_messages: { method: 'GET', path: '/api/communications/conversations/{conversationId}/messages', description: 'Mesaje cu cursor; conversationId obligatoriu.', load: () => import('@/app/api/communications/[...path]/route') },
  conversation_search: { method: 'GET', path: '/api/communications/search', description: 'Caută mesaje: q, page; păstrează permisiunile conversației.', load: () => import('@/app/api/communications/[...path]/route') },
  communications_status: { method: 'GET', path: '/api/communications/dashboard', description: 'Starea conexiunilor și bugetului de comunicare.', load: () => import('@/app/api/communications/[...path]/route') },
  whatsapp_templates: { method: 'GET', path: '/api/communications/templates/{connectionId}', description: 'Șabloane aprobate și parametri necesari.', load: () => import('@/app/api/communications/[...path]/route') },
  conversation_start: { method: 'POST', path: '/api/communications/conversations', description: 'Pornește conversație WhatsApp: contactId, connectionId, propertyId opțional.', external: true, load: () => import('@/app/api/communications/[...path]/route') },
  message_preview: { method: 'POST', readOnly: true, path: '/api/communications/conversations/{conversationId}/preview', description: 'Verifică eligibilitate/cost: text sau template {name,language,parameters}, requestId UUID.', load: () => import('@/app/api/communications/[...path]/route') },
  message_send: { method: 'POST', path: '/api/communications/conversations/{conversationId}/messages', description: 'Trimite mesaj prin coada existentă. text sau template {name,language,parameters}; requestId injectat de executor.', external: true, load: () => import('@/app/api/communications/[...path]/route') },
  conversation_note: { method: 'POST', path: '/api/communications/conversations/{conversationId}/notes', description: 'Notă internă: text.', load: () => import('@/app/api/communications/[...path]/route') },
  conversation_update: { method: 'PATCH', path: '/api/communications/conversations/{conversationId}', description: 'Modifică status/assigneeId/read/propertyId, version obligatoriu. Reatribuire numai admin.', load: () => import('@/app/api/communications/[...path]/route') },
  social_create: { method: 'POST', path: '/api/communications/posts', description: 'Publicare socială prin handler-ul existent, cu buget/rol verificate; consultă conexiunile.', external: true, load: () => import('@/app/api/communications/[...path]/route') },
  collaboration_read: { method: 'GET', path: '/api/collaboration', description: 'Colaborări: view catalog/me/cases/leads; id/cursor.', load: () => import('@/app/api/collaboration/route') },
  collaboration_action: { method: 'POST', path: '/api/collaboration', description: 'Acțiune colaborare cu schema handler-ului existent; nu inventa acorduri.', external: true, load: () => import('@/app/api/collaboration/route') },
  property_remove: { method: 'POST', path: '/api/properties/remove', description: 'Retragere/vânzare prin lifecycle existent, niciodată delete direct. Necesită motiv și detalii complete.', external: true, load: () => import('@/app/api/properties/remove/route') },
  property_context: { method: 'GET', path: '/api/properties/{propertyId}/sales-recommendation-context', description: 'Context vânzare pentru propertyId.', load: () => import('@/app/api/properties/[propertyId]/sales-recommendation-context/route') },
  property_pricing: { method: 'GET', path: '/api/properties/{propertyId}/pricing-analysis', description: 'Analiză de preț cu comparabile reale pentru propertyId.', load: () => import('@/app/api/properties/[propertyId]/pricing-analysis/route') },
  property_nearby: { method: 'GET', path: '/api/properties/{propertyId}/nearby-objectives', description: 'Obiective din apropierea proprietății.', load: () => import('@/app/api/properties/[propertyId]/nearby-objectives/route') },
  video_jobs: { method: 'GET', path: '/api/properties/{propertyId}/video-tour-jobs', description: 'Joburi și rezultate video ale proprietății.', load: () => import('@/app/api/properties/[propertyId]/video-tour-jobs/route') },
  video_create: { method: 'POST', path: '/api/properties/{propertyId}/video-tour-jobs', description: 'Creează job video cu schema existentă. Pentru presenter include aiPresenterScript generat întâi prin video_script; păstrează vocea și randarea existente. Nu pretinde că randarea e finalizată.', load: () => import('@/app/api/properties/[propertyId]/video-tour-jobs/route') },
  video_script: { method: 'POST', path: '/api/properties/{propertyId}/video-tour-script', description: 'Generează scenariul video din datele proprietății.', load: () => import('@/app/api/properties/[propertyId]/video-tour-script/route') },
  imobiliare_status: { method: 'GET', path: '/api/imobiliare/status', description: 'Starea integrării Imobiliare.ro.', load: () => import('@/app/api/imobiliare/status/route') },
  imobiliare_publish: { method: 'POST', path: '/api/imobiliare/publish', description: 'Publică/sincronizează proprietatea: propertyId, cu validările portalului.', external: true, load: () => import('@/app/api/imobiliare/publish/route') },
  imobiliare_unpublish: { method: 'POST', path: '/api/imobiliare/unpublish', description: 'Retrage de pe Imobiliare.ro: propertyId.', external: true, load: () => import('@/app/api/imobiliare/unpublish/route') },
  imobiliare_reconcile: { method: 'POST', path: '/api/imobiliare/reconcile', description: 'Verifică starea reală a publicării: propertyId.', load: () => import('@/app/api/imobiliare/reconcile/route') },
  storia_status: { method: 'GET', path: '/api/storia/status', description: 'Starea integrării Storia.', load: () => import('@/app/api/storia/status/route') },
  storia_publish: { method: 'POST', path: '/api/storia/publish', description: 'Publică/sincronizează pe Storia: propertyId.', external: true, load: () => import('@/app/api/storia/publish/route') },
  storia_unpublish: { method: 'POST', path: '/api/storia/unpublish', description: 'Retrage proprietatea de pe Storia: propertyId, cu rolul cerut de portal.', external: true, load: () => import('@/app/api/storia/unpublish/route') },
  storia_promotions: { method: 'POST', readOnly: true, path: '/api/storia/property-promotions', description: 'Promovări disponibile și starea lor: propertyId.', load: () => import('@/app/api/storia/property-promotions/route') },
  romimo_status: { method: 'GET', path: '/api/romimo/status', description: 'Starea integrării Romimo.', load: () => import('@/app/api/romimo/[action]/route') },
  romimo_preview: { method: 'POST', readOnly: true, path: '/api/romimo/preview', description: 'Previzualizare Romimo: propertyId și setările cerute de portal.', load: () => import('@/app/api/romimo/[action]/route') },
  romimo_publish: { method: 'POST', path: '/api/romimo/publish', description: 'Publică pe Romimo după preview: propertyId, previewHash, settings.', external: true, load: () => import('@/app/api/romimo/[action]/route') },
  romimo_verify: { method: 'POST', path: '/api/romimo/verify', description: 'Verifică publicarea Romimo: propertyId.', load: () => import('@/app/api/romimo/[action]/route') },
  property_presentation: { method: 'GET', path: '/api/properties/{propertyId}/presentation', description: 'Generează prezentarea PDF. propertyId; fișierul este salvat și poate fi descărcat.', load: () => import('@/app/api/properties/[propertyId]/presentation/route') },
  sale_stage: { method: 'POST', path: '/api/sales/{saleId}/stage', description: 'Schimbă etapa tranzacției folosind validările și auditul existent.', load: () => import('@/app/api/sales/[saleId]/stage/route') },
  sale_setup: { method: 'PATCH', path: '/api/sales/{saleId}/setup', description: 'Actualizează participanți/checklist/configurare tranzacție prin handler.', load: () => import('@/app/api/sales/[saleId]/setup/route') },
  sale_requirement: { method: 'POST', path: '/api/sales/{saleId}/documents', description: 'Adaugă document necesar: label, participantRole, stages, required.', load: () => import('@/app/api/sales/[saleId]/documents/route') },
  sale_document_edit: { method: 'PATCH', path: '/api/sales/{saleId}/documents/{documentId}', description: 'Actualizează cerința documentară folosind schema și auditul dosarului.', load: () => import('@/app/api/sales/[saleId]/documents/[documentId]/route') },
  sale_document_action: { method: 'POST', path: '/api/sales/{saleId}/documents/{documentId}', description: 'Verifică/respinge/restabilește versiunea unui document numai pe baza datelor reale și a unei instrucțiuni explicite.', load: () => import('@/app/api/sales/[saleId]/documents/[documentId]/route') },
  sale_document_remove: { method: 'DELETE', path: '/api/sales/{saleId}/documents/{documentId}', description: 'Elimină cerința documentară prin handler-ul auditat existent.', load: () => import('@/app/api/sales/[saleId]/documents/[documentId]/route') },
  sale_message_review: { method: 'PATCH', path: '/api/sales/{saleId}/messages/{messageId}/review', description: 'Revizuiește mesajul/draftul dosarului cu schema existentă.', load: () => import('@/app/api/sales/[saleId]/messages/[messageId]/review/route') },
  sale_message_evidence: { method: 'PATCH', path: '/api/sales/{saleId}/messages/{messageId}/send-evidence', description: 'Înregistrează dovada reală a trimiterii; nu inventa livrarea unui email.', load: () => import('@/app/api/sales/[saleId]/messages/[messageId]/send-evidence/route') },
  sales_settings_update: { method: 'PATCH', path: '/api/sales/settings', description: 'Administrator: actualizează setările de vânzări prin schema existentă.', load: () => import('@/app/api/sales/settings/route') },
  sales_template_create: { method: 'POST', path: '/api/sales/templates', description: 'Administrator: creează șablon email pentru dosare, folosind schema existentă.', load: () => import('@/app/api/sales/templates/route') },
  sales_template_update: { method: 'PATCH', path: '/api/sales/templates/{templateId}', description: 'Administrator: editează șablonul email al agenției.', load: () => import('@/app/api/sales/templates/[templateId]/route') },
  sales_template_action: { method: 'POST', path: '/api/sales/templates/{templateId}', description: 'Administrator: acțiune/versionare șablon email prin validările existente.', load: () => import('@/app/api/sales/templates/[templateId]/route') },
  outreach_calls: { method: 'GET', path: '/api/ai-outreach/calls', description: 'Istoricul și starea apelurilor de prospectare accesibile agentului.', load: () => import('@/app/api/ai-outreach/calls/route') },
  contract_generate: { method: 'POST', path: '/api/contracts/templates/{templateId}/generate', description: 'Generează PDF contract: values {câmp:valoare}, contactId/ownerId/propertyId opționale. templateId în params.', load: () => import('@/app/api/contracts/templates/[templateId]/generate/route') },
  agency_agents: { method: 'GET', path: '/api/agency/agents', description: 'Lista agenților autorizați din agenție.', load: () => import('@/app/api/agency/agents/route') },
  agency_agent_detail: { method: 'GET', path: '/api/agency/agents/{agentId}', description: 'Statistici agent: acces propriu sau admin.', load: () => import('@/app/api/agency/agents/[agentId]/route') },
  billing_summary: { method: 'GET', path: '/api/billing/summary', description: 'Plan, funcționalități și locuri disponibile.', load: () => import('@/app/api/billing/summary/route') },
  sales_settings: { method: 'GET', path: '/api/sales/settings', description: 'Setări vânzări accesibile agentului.', load: () => import('@/app/api/sales/settings/route') },
  meta_status: { method: 'GET', path: '/api/marketing/meta/status', description: 'Starea integrării Meta.', load: () => import('@/app/api/marketing/meta/status/route') },
  meta_campaigns: { method: 'GET', path: '/api/marketing/meta/property-campaigns', description: 'Campanii Meta ale agenției.', load: () => import('@/app/api/marketing/meta/property-campaigns/route') },
  meta_campaign_draft: { method: 'POST', path: '/api/marketing/meta/property-campaigns', description: 'Creează draft campanie Meta, fără publicare.', load: () => import('@/app/api/marketing/meta/property-campaigns/route') },
  meta_campaign_publish: { method: 'POST', path: '/api/marketing/meta/property-campaigns/{campaignId}/publish', description: 'Publică campanie, cu controalele de buget/aprobare ale handler-ului.', external: true, load: () => import('@/app/api/marketing/meta/property-campaigns/[campaignId]/publish/route') },
  meta_campaign_pause: { method: 'POST', path: '/api/marketing/meta/property-campaigns/{campaignId}/pause', description: 'Oprește campania.', external: true, load: () => import('@/app/api/marketing/meta/property-campaigns/[campaignId]/pause/route') },
  tiktok_status: { method: 'GET', path: '/api/marketing/tiktok-ads/status', description: 'Starea TikTok Ads.', load: () => import('@/app/api/marketing/tiktok-ads/status/route') },
  tiktok_organic_status: { method: 'GET', path: '/api/marketing/tiktok/status', description: 'Starea conexiunii TikTok organic.', load: () => import('@/app/api/marketing/tiktok/status/route') },
  tiktok_dashboard: { method: 'GET', path: '/api/marketing/tiktok/dashboard', description: 'Drafturi și publicări TikTok organic.', load: () => import('@/app/api/marketing/tiktok/dashboard/route') },
  tiktok_post_draft: { method: 'POST', path: '/api/marketing/tiktok/post-drafts', description: 'Creează draft TikTok prin schema handler-ului existent.', load: () => import('@/app/api/marketing/tiktok/post-drafts/route') },
  tiktok_post_publish: { method: 'POST', path: '/api/marketing/tiktok/post-drafts/{draftId}/publish', description: 'Publică draft TikTok cu toate condițiile și aprobările existente.', external: true, load: () => import('@/app/api/marketing/tiktok/post-drafts/[draftId]/publish/route') },
  tiktok_post_schedule: { method: 'POST', path: '/api/marketing/tiktok/post-drafts/{draftId}/schedule', description: 'Programează draft TikTok pentru data cerută.', external: true, load: () => import('@/app/api/marketing/tiktok/post-drafts/[draftId]/schedule/route') },
  tiktok_capabilities: { method: 'GET', path: '/api/marketing/tiktok-ads/capabilities', description: 'Capabilitățile efectiv disponibile TikTok Ads.', load: () => import('@/app/api/marketing/tiktok-ads/capabilities/route') },
  tiktok_operations: { method: 'POST', path: '/api/marketing/tiktok-ads/operations', description: 'Execută operație TikTok prin ledger/aprobările existente.', external: true, load: () => import('@/app/api/marketing/tiktok-ads/operations/route') },
};
export function isReadOperation(operation: string) { const op = Object.hasOwn(operations, operation) ? operations[operation] : undefined; return Boolean(op && (op.readOnly ?? op.method === 'GET')); }
export function operationContract(operation: string) {
  if (!Object.hasOwn(operations, operation)) throw new CommunicationError('Operație necunoscută.');
  return (handlerContracts as Record<string, unknown>)[operation] || { note: 'Consultă descrierea operației; handler-ul validează datele.' };
}
export function operationCatalog() { return Object.entries(operations).map(([id, o]) => ({ id, method: o.method, readOnly: isReadOperation(id), description: o.description, params: [...o.path.matchAll(/\{(\w+)\}/g)].map(m => m[1]), external: Boolean(o.external) })); }
export function operationPath(operation: Operation, params: Record<string, string>) {
  return operation.path.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (!value || !/^[a-zA-Z0-9_.:-]+$/.test(value) || value === '..') throw new CommunicationError(`Parametru invalid: ${key}.`);
    return encodeURIComponent(value);
  });
}
export async function invokeOperation(ctx: AssistantContext, input: { operation: string; params: Record<string, string>; query: Record<string, string>; body: Record<string, unknown> }, readOnly = false) {
  const op = Object.hasOwn(operations, input.operation) ? operations[input.operation] : undefined;
  if (!op || (readOnly && !isReadOperation(input.operation))) throw new CommunicationError('Operație indisponibilă pentru citire.');
  if (ctx.runtimeMode === 'demo' && input.operation !== 'owner_query') throw new CommunicationError('Acest handler nu este disponibil prin asistent în demo.', 403);
  if (op.external && isDemoAgencyId(ctx.agencyId)) throw new CommunicationError('Integrările externe nu sunt disponibile în demo.', 403);
  const path = operationPath(op, input.params);
  if (input.operation === 'video_create' && input.body.includeAiPresenter !== false && !String(input.body.aiPresenterScript || '').trim()) throw new CommunicationError('Generează întâi scenariul prin video_script și include aiPresenterScript în planul video. Workerul nu trebuie să lanseze un model text în afara politicii Jarvis.');
  if (input.operation === 'owner_import_preview') {
    const url = new URL(String(input.body.url || ''));
    const domains: Record<string, string[]> = { olx: ['olx.ro', 'www.olx.ro'], imoradar24: ['imoradar24.ro', 'www.imoradar24.ro'], publi24: ['publi24.ro', 'www.publi24.ro'] };
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !domains[String(input.body.source)]?.includes(url.hostname)) throw new CommunicationError('URL-ul anunțului nu aparține sursei permise.');
  }
  for (const [key, resource] of Object.entries({ contactId: 'contacts', ownerId: 'contacts', propertyId: 'properties', saleId: 'sales', conversationId: 'conversations', connectionId: 'channelConnections', templateId: 'contractTemplates' })) {
    const id = input.params[key] || input.body[key];
    if (typeof id === 'string' && id) await getResource(ctx, key === 'templateId' && input.operation.startsWith('sales_template_') ? 'salesEmailTemplates' : resource, id);
  }
  const url = new URL(path, ctx.appOrigin || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  Object.entries(input.query).forEach(([key, value]) => url.searchParams.set(key, value));
  const request = new NextRequest(url, { method: op.method, headers: { authorization: ctx.authorization || INTERNAL_PRINCIPAL_HEADER, 'content-type': 'application/json' }, ...(op.method !== 'GET' ? { body: JSON.stringify(input.body) } : {}) });
  const handlerModule = await op.load();
  const handler = handlerModule[op.method];
  if (typeof handler !== 'function') throw new CommunicationError('Metoda handler-ului nu este disponibilă.', 501);
  const params = path.startsWith('/api/communications/') ? { path: path.slice('/api/communications/'.length).split('/').map(decodeURIComponent) } : path.startsWith('/api/romimo/') ? { action: path.slice('/api/romimo/'.length) } : input.params;
  const response: Response = await withAssistantPrincipal(ctx, () => handler(request, { params: Promise.resolve(params) }));
  if (response.ok && response.headers.get('content-type')?.includes('application/pdf')) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024) throw new CommunicationError('Fișierul depășește limita asistentului.', 413);
    const artifactId = randomUUID();
    const storagePath = `agencies/${ctx.agencyId}/privateCommunications/assistant-artifacts/${ctx.uid}/${artifactId}.pdf`;
    const fileName = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]?.replace(/[^a-zA-Z0-9._-]/g, '_') || `${input.operation}.pdf`;
    await getStorage(ctx.adminAuth.app).bucket().file(storagePath).save(bytes, { contentType: 'application/pdf', resumable: false });
    await collectionFor(ctx, 'assistantArtifacts').doc(artifactId).set({ ownerId: ctx.uid, storagePath, fileName, mimeType: 'application/pdf', createdAt: new Date().toISOString(), accessRefs: actionReferences([{ kind: 'existing_operation', ...input }]) });
    return { artifactId, fileName, downloadPath: `/api/ai-assistant/artifacts/${artifactId}` };
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new CommunicationError('Formatul rezultatului nu este acceptat.', 422);
  const result = await response.json();
  if (!response.ok) throw new OperationFailure(result.message || result.error || 'Operația nu este confirmată integral. Verifică rezultatele pasului oprit.', response.status, result);
  return operationResult(input.operation, result);
}
