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
  crm_health: { method: 'GET', path: '/api/ai-assistant/health', description: 'Stare Jarvis: configurarea modelului, heartbeat worker și lag măsurat al proiecțiilor CRM autorizate. Eșantion explicit, fără secrete sau datele altor agenții. Nu certifică providerii externi.', load: () => import('@/app/api/ai-assistant/health/route') },
  email_template_preferences: { method: 'GET', path: '/api/email/template-preferences', description: 'Șabloane email activate și personalizări proprii ale agentului. Paginare cursor; nu modifică biblioteca agenției.', load: () => import('@/app/api/email/template-preferences/route') },
  video_voice_preview: { method: 'POST', readOnly: true, path: '/api/properties/{propertyId}/video-tour-voice-preview', description: 'Generează previzualizarea audio a vocii turului video: voice și text. Returnează fișier audio privat.', external: true, load: () => import('@/app/api/properties/[propertyId]/video-tour-voice-preview/route') },
  file_apply: { method: 'POST', path: '/api/ai-assistant/uploads/{uploadId}/apply', description: 'Aplică un fișier privat deja atașat: destination sale_document cu saleId/documentId, conversation_attachment cu conversationId identity_ocr, property_image sau property_rlv cu propertyId, profile_photo (profil propriu), agency_logo sau agency_share_image (administrator, imagine distribuire site), agent_photo cu agentId (administrator, agent din aceeași agenție). Nu inventa uploadId; citește assistantUploads.', load: () => import('@/app/api/ai-assistant/uploads/[uploadId]/apply/route') },
  file_docx_preview: { method: 'GET', path: '/api/ai-assistant/uploads/{uploadId}/docx-preview', description: 'Previzualizează importul Word DOCX privat ca document de contract: paragrafe, liste, tabele și evidențieri, avertismente de conversie. Administrator; fără creare de șablon. Aplicarea contract_template prin file_apply rămâne un pas separat.', load: () => import('@/app/api/ai-assistant/uploads/[uploadId]/docx-preview/route') },
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
  sale_replies_read: { method: 'POST', path: '/api/sales/{saleId}/read', description: 'Marchează răspunsurile dosarului ca citite. Citește mai întâi dosarul și mesajele; trimite expectedUpdatedAt și observedUnreadCount din snapshot. Nu confirmă trimitere sau livrare. Conflictele cer recitire.', load: () => import('@/app/api/sales/[saleId]/read/route') },
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
  outreach_start: { method: 'POST', path: '/api/ai-outreach/calls', description: "Inițiază/programează un apel AI real; respectă orarul, limitele și costurile outreach.", external: true, load: () => import('@/app/api/ai-outreach/calls/route') },
  outreach_settings: { method: 'GET', path: '/api/ai-outreach/settings', description: "Consultă configurația și eligibilitatea apelurilor AI.", load: () => import('@/app/api/ai-outreach/settings/route') },
  outreach_settings_update: { method: 'POST', path: '/api/ai-outreach/settings', description: "Modifică setările outreach prin validarea existentă.", load: () => import('@/app/api/ai-outreach/settings/route') },
  global_search: { method: 'GET', path: '/api/search', description: "Căutare globală autorizată în CRM.", load: () => import('@/app/api/search/route') },
  company_lookup: { method: 'GET', path: '/api/company-lookup', description: "Consultă datele societății după identificator verificat.", load: () => import('@/app/api/company-lookup/route') },
  geocode: { method: 'GET', path: '/api/geocode', description: "Determină coordonatele adresei.", load: () => import('@/app/api/geocode/route') },
  geocode_search: { method: 'GET', path: '/api/geocode-search', description: "Caută sugestii de adresă/localizare.", load: () => import('@/app/api/geocode-search/route') },
  building_year: { method: 'POST', readOnly: true, path: '/api/building-year-lookup', description: "Caută anul construcției; păstrează proveniența rezultatului.", load: () => import('@/app/api/building-year-lookup/route') },
  notification_read_all: { method: 'POST', path: '/api/notifications/read-all', description: "Marchează notificările proprii ca citite.", load: () => import('@/app/api/notifications/read-all/route') },
  agency_agent_create: { method: 'POST', path: '/api/agency/agents', description: "Creează/invită agent conform drepturilor administratorului.", load: () => import('@/app/api/agency/agents/route') },
  agency_agent_update: { method: 'PATCH', path: '/api/agency/agents/{agentId}', description: "Modifică agentul în agenția curentă.", load: () => import('@/app/api/agency/agents/[agentId]/route') },
  agency_agent_remove: { method: 'DELETE', path: '/api/agency/agents/{agentId}', description: "Elimină agentul conform regulilor existente.", load: () => import('@/app/api/agency/agents/[agentId]/route') },
  domain_status: { method: 'GET', path: '/api/custom-domain/status', description: "Consultă starea domeniului personalizat.", load: () => import('@/app/api/custom-domain/status/route') },
  domain_setup: { method: 'POST', path: '/api/custom-domain/setup', description: "Configurează domeniul; returnează pașii DNS necesari.", external: true, load: () => import('@/app/api/custom-domain/setup/route') },
  billing_change_plan: { method: 'POST', path: '/api/billing/change-plan', description: "Schimbă abonamentul numai pentru administrator; consultă întâi costul și planul.", external: true, load: () => import('@/app/api/billing/change-plan/route') },
  billing_change_seats: { method: 'POST', path: '/api/billing/change-seats', description: "Schimbă numărul de locuri cu cost și drepturi verificate.", external: true, load: () => import('@/app/api/billing/change-seats/route') },
  billing_checkout: { method: 'POST', path: '/api/billing/checkout', description: "Creează sesiune checkout autorizată; plata necesită intervenția utilizatorului.", external: true, load: () => import('@/app/api/billing/checkout/route') },
  billing_portal: { method: 'POST', path: '/api/billing/portal', description: "Deschide sesiunea de administrare billing; nu pretinde plata efectuată.", external: true, load: () => import('@/app/api/billing/portal/route') },
  email_forwarding: { method: 'GET', path: '/api/email/forwarding', description: "Consultă adresa/configurația forwarding proprie.", load: () => import('@/app/api/email/forwarding/route') },
  email_forwarding_setup: { method: 'POST', path: '/api/email/forwarding', description: "Pregătește forwarding-ul email și pașii necesari.", load: () => import('@/app/api/email/forwarding/route') },
  email_health: { method: 'GET', path: '/api/email/health', description: "Verifică starea infrastructurii email.", load: () => import('@/app/api/email/health/route') },
  collaboration_team: { method: 'GET', path: '/api/collaboration/team', description: "Consultă echipa de colaborare autorizată.", load: () => import('@/app/api/collaboration/team/route') },
  collaboration_team_action: { method: 'POST', path: '/api/collaboration/team', description: "Administrează echipa conform contractului existent.", load: () => import('@/app/api/collaboration/team/route') },
  collaboration_onboarding: { method: 'POST', path: '/api/collaboration/onboarding', description: "Pregătește onboarding colaborare; păstrează acordurile umane.", load: () => import('@/app/api/collaboration/onboarding/route') },
  owner_phone: { method: 'POST', path: '/api/owner-listings/olx-phone', description: "Obține telefonul OLX prin conexiunea și limitele existente.", external: true, load: () => import('@/app/api/owner-listings/olx-phone/route') },
  owner_olx_status: { method: 'GET', path: '/api/owner-listings/olx-connection', description: "Consultă starea conexiunii OLX.", load: () => import('@/app/api/owner-listings/olx-connection/route') },
  owner_favorites: { method: 'GET', path: '/api/owner-listings/favorites', description: "Consultă prospectarea agenției.", load: () => import('@/app/api/owner-listings/favorites/route') },
  owner_sync: { method: 'POST', path: '/api/owner-listings/sync', description: "Solicită actualizarea anunțurilor prin fluxul existent.", external: true, load: () => import('@/app/api/owner-listings/sync/route') },
  meta_assets: { method: 'GET', path: '/api/marketing/meta/assets', description: "Consultă assets Meta autorizate.", load: () => import('@/app/api/marketing/meta/assets/route') },
  meta_assets_refresh: { method: 'POST', path: '/api/marketing/meta/assets', description: "Actualizează assets prin handlerul existent.", external: true, load: () => import('@/app/api/marketing/meta/assets/route') },
  meta_dashboard: { method: 'GET', path: '/api/marketing/meta/dashboard', description: "Consultă raportarea și starea campaniilor Meta.", load: () => import('@/app/api/marketing/meta/dashboard/route') },
  meta_campaign_update: { method: 'PATCH', path: '/api/marketing/meta/property-campaigns/{campaignId}', description: "Modifică draftul campaniei Meta.", load: () => import('@/app/api/marketing/meta/property-campaigns/[campaignId]/route') },
  meta_campaign_remove: { method: 'DELETE', path: '/api/marketing/meta/property-campaigns/{campaignId}', description: "Șterge campania/draftul conform handlerului.", external: true, load: () => import('@/app/api/marketing/meta/property-campaigns/[campaignId]/route') },
  meta_campaign_ready: { method: 'POST', path: '/api/marketing/meta/property-campaigns/{campaignId}/ready', description: "Verifică/pregătește eligibilitatea campaniei pentru publicare.", load: () => import('@/app/api/marketing/meta/property-campaigns/[campaignId]/ready/route') },
  meta_property_post: { method: 'POST', path: '/api/marketing/meta/property-posts', description: "Pregătește/publică postarea proprietății prin serviciul existent.", external: true, load: () => import('@/app/api/marketing/meta/property-posts/route') },
  tiktok_drafts: { method: 'GET', path: '/api/marketing/tiktok/post-drafts', description: "Listează drafturile TikTok.", load: () => import('@/app/api/marketing/tiktok/post-drafts/route') },
  tiktok_draft_update: { method: 'PATCH', path: '/api/marketing/tiktok/post-drafts/{draftId}', description: "Modifică draftul TikTok, păstrând condițiile de publicare.", load: () => import('@/app/api/marketing/tiktok/post-drafts/[draftId]/route') },
  tiktok_post_status: { method: 'GET', path: '/api/marketing/tiktok/post-drafts/{draftId}/status', description: "Verifică rezultatul efectiv al publicării TikTok.", load: () => import('@/app/api/marketing/tiktok/post-drafts/[draftId]/status/route') },
  tiktok_unschedule: { method: 'DELETE', path: '/api/marketing/tiktok/post-drafts/{draftId}/schedule', description: "Anulează programarea unei postări TikTok.", load: () => import('@/app/api/marketing/tiktok/post-drafts/[draftId]/schedule/route') },
  tiktok_creator: { method: 'GET', path: '/api/marketing/tiktok/creator-info', description: "Consultă eligibilitatea și opțiunile profilului TikTok.", load: () => import('@/app/api/marketing/tiktok/creator-info/route') },
  tiktok_brief: { method: 'POST', path: '/api/marketing/tiktok/creative-brief', description: "Generează brief TikTok din date reale ale proprietății.", load: () => import('@/app/api/marketing/tiktok/creative-brief/route') },
  tiktok_descriptions: { method: 'POST', path: '/api/marketing/tiktok/descriptions', description: "Generează descrieri pentru TikTok.", load: () => import('@/app/api/marketing/tiktok/descriptions/route') },
  tiktok_premium_script: { method: 'POST', path: '/api/marketing/tiktok/premium-script', description: "Generează scenariu TikTok; nu pretinde video finalizat.", load: () => import('@/app/api/marketing/tiktok/premium-script/route') },
  tiktok_studio_assets: { method: 'GET', path: '/api/marketing/tiktok/studio-assets', description: "Listează fișierele Studio autorizate.", load: () => import('@/app/api/marketing/tiktok/studio-assets/route') },
  tiktok_studio_asset_create: { method: 'POST', path: '/api/marketing/tiktok/studio-assets', description: "Înregistrează asset existent prin contractul Studio.", load: () => import('@/app/api/marketing/tiktok/studio-assets/route') },
  tiktok_studio_asset_update: { method: 'PATCH', path: '/api/marketing/tiktok/studio-assets', description: "Modifică asset Studio.", load: () => import('@/app/api/marketing/tiktok/studio-assets/route') },
  tiktok_studio_asset_remove: { method: 'DELETE', path: '/api/marketing/tiktok/studio-assets', description: "Șterge asset Studio conform drepturilor.", load: () => import('@/app/api/marketing/tiktok/studio-assets/route') },
  tiktok_studio_projects: { method: 'GET', path: '/api/marketing/tiktok/studio-projects', description: "Listează proiectele Studio.", load: () => import('@/app/api/marketing/tiktok/studio-projects/route') },
  tiktok_studio_project_create: { method: 'POST', path: '/api/marketing/tiktok/studio-projects', description: "Creează proiect Studio.", load: () => import('@/app/api/marketing/tiktok/studio-projects/route') },
  tiktok_studio_render: { method: 'POST', path: '/api/marketing/tiktok/studio-projects/{projectId}/render', description: "Inițiază randarea Studio și returnează jobul.", load: () => import('@/app/api/marketing/tiktok/studio-projects/[projectId]/render/route') },
  tiktok_studio_voices: { method: 'GET', path: '/api/marketing/tiktok/voices', description: "Consultă vocile disponibile Studio.", load: () => import('@/app/api/marketing/tiktok/voices/route') },
  tiktok_ads_workspace: { method: 'GET', path: '/api/marketing/tiktok-ads/workspace', description: "Consultă configurația completă TikTok Ads.", load: () => import('@/app/api/marketing/tiktok-ads/workspace/route') },
  tiktok_ads_manager: { method: 'GET', path: '/api/marketing/tiktok-ads/manager', description: "Consultă campanii/adgroups/ads din manager.", load: () => import('@/app/api/marketing/tiktok-ads/manager/route') },
  tiktok_ads_reporting: { method: 'GET', path: '/api/marketing/tiktok-ads/reporting', description: "Consultă raportarea TikTok Ads.", load: () => import('@/app/api/marketing/tiktok-ads/reporting/route') },
  tiktok_ads_drafts: { method: 'GET', path: '/api/marketing/tiktok-ads/drafts', description: "Listează drafturile Ads.", load: () => import('@/app/api/marketing/tiktok-ads/drafts/route') },
  tiktok_ads_draft_create: { method: 'PUT', path: '/api/marketing/tiktok-ads/drafts', description: "Salvează draftul Ads conform contractului existent.", load: () => import('@/app/api/marketing/tiktok-ads/drafts/route') },
  tiktok_ads_draft_update: { method: 'PATCH', path: '/api/marketing/tiktok-ads/drafts', description: "Modifică draftul Ads.", load: () => import('@/app/api/marketing/tiktok-ads/drafts/route') },
  tiktok_ads_publication: { method: 'POST', path: '/api/marketing/tiktok-ads/drafts/publication', description: "Publică draft Ads cu aprobările și plafonul existente.", external: true, load: () => import('@/app/api/marketing/tiktok-ads/drafts/publication/route') },
  tiktok_ads_operation_status: { method: 'GET', path: '/api/marketing/tiktok-ads/operations/{operationId}', description: "Verifică rezultatul operației Ads înainte de repetare.", load: () => import('@/app/api/marketing/tiktok-ads/operations/[operationId]/route') },
  tiktok_ads_operation_recover: { method: 'POST', path: '/api/marketing/tiktok-ads/operations/{operationId}/recover', description: "Reconciliază operația incertă; nu retrimite automat efectul.", external: true, load: () => import('@/app/api/marketing/tiktok-ads/operations/[operationId]/recover/route') },
  tiktok_ads_spend_authorization: { method: 'POST', path: '/api/marketing/tiktok-ads/spend-authorization', description: "Pregătește autorizarea exactă de cheltuieli conform handlerului.", external: true, load: () => import('@/app/api/marketing/tiktok-ads/spend-authorization/route') },
  tiktok_ads_advertisers: { method: 'GET', path: '/api/marketing/tiktok-ads/advertisers', description: "Listează advertiserii autorizați.", load: () => import('@/app/api/marketing/tiktok-ads/advertisers/route') },
  tiktok_ads_advertiser_select: { method: 'POST', path: '/api/marketing/tiktok-ads/advertisers', description: "Selectează advertiser autorizat.", load: () => import('@/app/api/marketing/tiktok-ads/advertisers/route') },
  tiktok_ads_resources: { method: 'POST', path: '/api/marketing/tiktok-ads/resources', description: "Modifică resurse Ads cu aprobările și bugetul existente.", external: true, load: () => import('@/app/api/marketing/tiktok-ads/resources/route') },
  facebook_connections: { method: 'GET', path: '/api/marketing/facebook-cloud/connections', description: "Consultă conexiunile Facebook Cloud.", load: () => import('@/app/api/marketing/facebook-cloud/connections/route') },
  facebook_connection_update: { method: 'PATCH', path: '/api/marketing/facebook-cloud/connections/{connectionId}', description: "Modifică conexiunea Facebook Cloud.", load: () => import('@/app/api/marketing/facebook-cloud/connections/[connectionId]/route') },
  facebook_connection_remove: { method: 'DELETE', path: '/api/marketing/facebook-cloud/connections/{connectionId}', description: "Elimină conexiunea Cloud.", load: () => import('@/app/api/marketing/facebook-cloud/connections/[connectionId]/route') },
  facebook_jobs: { method: 'GET', path: '/api/marketing/facebook-cloud/jobs', description: "Consultă joburile de publicare în grupuri.", load: () => import('@/app/api/marketing/facebook-cloud/jobs/route') },
  facebook_job_create: { method: 'POST', path: '/api/marketing/facebook-cloud/jobs', description: "Pornește jobul de promovare în grupuri, cu drepturile existente.", external: true, load: () => import('@/app/api/marketing/facebook-cloud/jobs/route') },
  facebook_job_update: { method: 'PATCH', path: '/api/marketing/facebook-cloud/jobs/{jobId}', description: "Actualizează/control job de promovare conform handlerului.", external: true, load: () => import('@/app/api/marketing/facebook-cloud/jobs/[jobId]/route') },
  facebook_job_remove: { method: 'DELETE', path: '/api/marketing/facebook-cloud/jobs/{jobId}', description: "Anulează/elimină jobul de promovare.", external: true, load: () => import('@/app/api/marketing/facebook-cloud/jobs/[jobId]/route') },
  facebook_devices: { method: 'GET', path: '/api/marketing/facebook-local/devices', description: "Verifică dispozitivele/helper-ele de publicare locale.", load: () => import('@/app/api/marketing/facebook-local/devices/route') },
  video_job: { method: 'GET', path: '/api/properties/{propertyId}/video-tour-jobs/{jobId}', description: "Consultă progresul și rezultatul jobului video.", load: () => import('@/app/api/properties/[propertyId]/video-tour-jobs/[jobId]/route') },
  video_job_action: { method: 'POST', path: '/api/properties/{propertyId}/video-tour-jobs/{jobId}', description: "Controlează jobul video prin acțiunile handlerului existent.", load: () => import('@/app/api/properties/[propertyId]/video-tour-jobs/[jobId]/route') },
  video_voices: { method: 'GET', path: '/api/properties/{propertyId}/video-tour-voices', description: "Listează vocile disponibile pentru video tour.", load: () => import('@/app/api/properties/[propertyId]/video-tour-voices/route') },
  pricing_pdf: { method: 'POST', path: '/api/properties/{propertyId}/pricing-analysis/pdf', description: "Generează raportul PDF de preț din date reale.", load: () => import('@/app/api/properties/[propertyId]/pricing-analysis/pdf/route') },
  sale_export: { method: 'GET', path: '/api/sales/{saleId}/export', description: "Exportă dosarul de vânzare autorizat.", load: () => import('@/app/api/sales/[saleId]/export/route') },
  sale_document_package: { method: 'GET', path: '/api/sales/{saleId}/documents/package', description: "Pregătește pachetul de documente autorizat.", load: () => import('@/app/api/sales/[saleId]/documents/package/route') },
  conversation_sync: { method: 'POST', path: '/api/communications/conversations/{conversationId}/sync', description: "Sincronizează conversația autorizată.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  conversation_link: { method: 'POST', path: '/api/communications/conversations/{conversationId}/contact', description: "Leagă contactul existent de conversație.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  social_publish: { method: 'POST', path: '/api/communications/posts/{postId}/publish', description: "Publică draftul social existent.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  social_comments: { method: 'GET', path: '/api/communications/posts/{postId}/comments', description: "Consultă comentariile postării.", load: () => import('@/app/api/communications/[...path]/route') },
  social_comment: { method: 'POST', path: '/api/communications/posts/{postId}/comments', description: "Publică un comentariu.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  social_reply: { method: 'POST', path: '/api/communications/posts/{postId}/comments/{commentId}/replies', description: "Răspunde la comentariul public.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  social_like: { method: 'POST', path: '/api/communications/posts/{postId}/comments/{commentId}/like', description: "Apreciază comentariul.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  social_diagnostics: { method: 'GET', path: '/api/communications/posts/{postId}/diagnostics', description: "Verifică accesul și starea postării.", load: () => import('@/app/api/communications/[...path]/route') },
  social_remove: { method: 'DELETE', path: '/api/communications/posts/{postId}', description: "Șterge postarea prin handlerul existent.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  social_destination_remove: { method: 'DELETE', path: '/api/communications/posts/{postId}/destinations/{connectionId}', description: "Elimină publicarea din destinația aleasă.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  whatsapp_template_create: { method: 'POST', path: '/api/communications/templates/{connectionId}', description: "Creează șablon; aprobarea Meta este o stare ulterioară.", external: true, load: () => import('@/app/api/communications/[...path]/route') },
  imobiliare_agents_sync: { method: 'POST', path: '/api/imobiliare/agents/sync', description: "Operație imobiliare agents_sync: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/imobiliare/agents/sync/route') },
  imobiliare_categories: { method: 'GET', path: '/api/imobiliare/categories', description: "Operație imobiliare categories: consultă contractul și păstrează autorizarea și statusurile handlerului.", load: () => import('@/app/api/imobiliare/categories/route') },
  imobiliare_locations: { method: 'GET', path: '/api/imobiliare/locations', description: "Operație imobiliare locations: consultă contractul și păstrează autorizarea și statusurile handlerului.", load: () => import('@/app/api/imobiliare/locations/route') },
  imobiliare_property_link: { method: 'POST', path: '/api/imobiliare/property-link', description: "Operație imobiliare property_link: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/imobiliare/property-link/route') },
  imobiliare_promotion_settings: { method: 'POST', path: '/api/imobiliare/property-promotion-settings', description: "Operație imobiliare promotion_settings: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/imobiliare/property-promotion-settings/route') },
  imobiliare_retry: { method: 'POST', path: '/api/imobiliare/retry', description: "Operație imobiliare retry: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/imobiliare/retry/route') },
  imobiliare_settings_update: { method: 'POST', path: '/api/imobiliare/settings', description: "Operație imobiliare settings_update: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/imobiliare/settings/route') },
  storia_apply_promotions: { method: 'POST', path: '/api/storia/apply-promotions', description: "Operație storia apply_promotions: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/storia/apply-promotions/route') },
  storia_property_link: { method: 'POST', path: '/api/storia/property-link', description: "Operație storia property_link: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/storia/property-link/route') },
  storia_promotion_settings: { method: 'POST', path: '/api/storia/property-promotion-settings', description: "Operație storia promotion_settings: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/storia/property-promotion-settings/route') },
  storia_refresh_link: { method: 'POST', path: '/api/storia/refresh-link', description: "Operație storia refresh_link: consultă contractul și păstrează autorizarea și statusurile handlerului.", external: true, load: () => import('@/app/api/storia/refresh-link/route') },
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
    // Cloud browser accounts are a separate domain, not messaging connections.
    // Its original handler enforces getOwnedConnection and session ownership.
    if (key === 'connectionId' && op.path.startsWith('/api/marketing/facebook-cloud/')) continue;
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
  const artifactTypes: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'video/mp4': 'mp4', 'application/pdf': 'pdf', 'application/zip': 'zip', 'application/x-zip-compressed': 'zip', 'text/csv': 'csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };
  const artifactType = response.headers.get('content-type')?.split(';')[0].trim() || '';
  if (response.ok && artifactTypes[artifactType]) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 25 * 1024 * 1024) throw new CommunicationError('Fișierul depășește limita asistentului.', 413);
    const artifactId = randomUUID();
    const extension = artifactTypes[artifactType];
    const storagePath = `agencies/${ctx.agencyId}/privateCommunications/assistant-artifacts/${ctx.uid}/${artifactId}.${extension}`;
    const fileName = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]?.replace(/[^a-zA-Z0-9._-]/g, '_') || `${input.operation}.${extension}`;
    await getStorage(ctx.adminAuth.app).bucket().file(storagePath).save(bytes, { contentType: artifactType, resumable: false });
    await collectionFor(ctx, 'assistantArtifacts').doc(artifactId).set({ ownerId: ctx.uid, storagePath, fileName, mimeType: artifactType, createdAt: new Date().toISOString(), accessRefs: actionReferences([{ kind: 'existing_operation', ...input }]) });
    return { artifactId, fileName, downloadPath: `/api/ai-assistant/artifacts/${artifactId}` };
  }
  if (!response.headers.get('content-type')?.includes('application/json')) throw new CommunicationError('Formatul rezultatului nu este acceptat.', 422);
  const result = await response.json();
  if (!response.ok) throw new OperationFailure(result.message || result.error || 'Operația nu este confirmată integral. Verifică rezultatele pasului oprit.', response.status, result);
  return operationResult(input.operation, result, isReadOperation(input.operation));
}
