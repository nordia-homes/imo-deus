# TOOLS

Registry = contract callable, schemă input/output, versiune, permissions, risc READ/SAFE_WRITE/SENSITIVE/CRITICAL, timeout, retry, idempotency și audit. Handler-ele mutante nu sunt callable direct din model; existing_read acceptă exclusiv operații readOnly. Contractele handler-elor existente sunt generate în handler-contracts.json și validate din nou de handler.

Tools core (20):

- analyze_records
- resolve_datetime
- read
- read_related
- read_field
- search_properties
- match_contact
- match_property
- filter_existing_matches
- operation_contract
- parallel_read
- discover_tools
- existing_read
- propose_actions
- remember_preference
- forget_preference
- delegate_read
- insights
- mcp_discover
- mcp_read

Acțiuni (19):

- create_contact
- archive_contact
- assign_record
- create_property
- update_contact
- update_preferences
- update_property
- import_owner_listing
- activate_property
- record_offer
- add_interaction
- create_task
- update_task
- schedule_viewing
- update_viewing
- recommend_properties
- create_automation
- update_automation
- existing_operation

Adaptoare existente (67):

| Tool | HTTP | Handler | Comportament |
| --- | --- | --- | --- |
| owner_query | GET | /api/owner-listings/query | Anunțuri proprietari: scopeKey, search, rooms, priceMin/Max, cursor. |
| owner_prospect | POST | /api/owner-listings/prospecting | Adaugă/scoate anunț din prospectare: listingId, action add/remove/retry. |
| owner_import_preview | POST | /api/owner-listings/import | Pregătește importul: source olx/imoradar24/publi24, url, listingId opțional; nu salvează proprietatea. |
| conversation_list | GET | /api/communications/conversations | Conversații autorizate: contactId, channel, status, cursor. |
| conversation_messages | GET | /api/communications/conversations/{conversationId}/messages | Mesaje cu cursor; conversationId obligatoriu. |
| conversation_search | GET | /api/communications/search | Caută mesaje: q, page; păstrează permisiunile conversației. |
| communications_status | GET | /api/communications/dashboard | Starea conexiunilor și bugetului de comunicare. |
| whatsapp_templates | GET | /api/communications/templates/{connectionId} | Șabloane aprobate și parametri necesari. |
| conversation_start | POST | /api/communications/conversations | Pornește conversație WhatsApp: contactId, connectionId, propertyId opțional. |
| message_preview | POST | /api/communications/conversations/{conversationId}/preview | Verifică eligibilitate/cost: text sau template {name,language,parameters}, requestId UUID. |
| message_send | POST | /api/communications/conversations/{conversationId}/messages | Trimite mesaj prin coada existentă. text sau template {name,language,parameters}; requestId injectat de executor. |
| conversation_note | POST | /api/communications/conversations/{conversationId}/notes | Notă internă: text. |
| conversation_update | PATCH | /api/communications/conversations/{conversationId} | Modifică status/assigneeId/read/propertyId, version obligatoriu. Reatribuire numai admin. |
| social_create | POST | /api/communications/posts | Publicare socială prin handler-ul existent, cu buget/rol verificate; consultă conexiunile. |
| collaboration_read | GET | /api/collaboration | Colaborări: view catalog/me/cases/leads; id/cursor. |
| collaboration_action | POST | /api/collaboration | Acțiune colaborare cu schema handler-ului existent; nu inventa acorduri. |
| property_remove | POST | /api/properties/remove | Retragere/vânzare prin lifecycle existent, niciodată delete direct. Necesită motiv și detalii complete. |
| property_context | GET | /api/properties/{propertyId}/sales-recommendation-context | Context vânzare pentru propertyId. |
| property_pricing | GET | /api/properties/{propertyId}/pricing-analysis | Analiză de preț cu comparabile reale pentru propertyId. |
| property_nearby | GET | /api/properties/{propertyId}/nearby-objectives | Obiective din apropierea proprietății. |
| video_jobs | GET | /api/properties/{propertyId}/video-tour-jobs | Joburi și rezultate video ale proprietății. |
| video_create | POST | /api/properties/{propertyId}/video-tour-jobs | Creează job video cu schema existentă. Pentru presenter include aiPresenterScript generat întâi prin video_script; păstrează vocea și randarea existente. Nu pretinde că randarea e finalizată. |
| video_script | POST | /api/properties/{propertyId}/video-tour-script | Generează scenariul video din datele proprietății. |
| imobiliare_status | GET | /api/imobiliare/status | Starea integrării Imobiliare.ro. |
| imobiliare_publish | POST | /api/imobiliare/publish | Publică/sincronizează proprietatea: propertyId, cu validările portalului. |
| imobiliare_unpublish | POST | /api/imobiliare/unpublish | Retrage de pe Imobiliare.ro: propertyId. |
| imobiliare_reconcile | POST | /api/imobiliare/reconcile | Verifică starea reală a publicării: propertyId. |
| storia_status | GET | /api/storia/status | Starea integrării Storia. |
| storia_publish | POST | /api/storia/publish | Publică/sincronizează pe Storia: propertyId. |
| storia_unpublish | POST | /api/storia/unpublish | Retrage proprietatea de pe Storia: propertyId, cu rolul cerut de portal. |
| storia_promotions | POST | /api/storia/property-promotions | Promovări disponibile și starea lor: propertyId. |
| romimo_status | GET | /api/romimo/status | Starea integrării Romimo. |
| romimo_preview | POST | /api/romimo/preview | Previzualizare Romimo: propertyId și setările cerute de portal. |
| romimo_publish | POST | /api/romimo/publish | Publică pe Romimo după preview: propertyId, previewHash, settings. |
| romimo_verify | POST | /api/romimo/verify | Verifică publicarea Romimo: propertyId. |
| property_presentation | GET | /api/properties/{propertyId}/presentation | Generează prezentarea PDF. propertyId; fișierul este salvat și poate fi descărcat. |
| sale_stage | POST | /api/sales/{saleId}/stage | Schimbă etapa tranzacției folosind validările și auditul existent. |
| sale_setup | PATCH | /api/sales/{saleId}/setup | Actualizează participanți/checklist/configurare tranzacție prin handler. |
| sale_requirement | POST | /api/sales/{saleId}/documents | Adaugă document necesar: label, participantRole, stages, required. |
| sale_document_edit | PATCH | /api/sales/{saleId}/documents/{documentId} | Actualizează cerința documentară folosind schema și auditul dosarului. |
| sale_document_action | POST | /api/sales/{saleId}/documents/{documentId} | Verifică/respinge/restabilește versiunea unui document numai pe baza datelor reale și a unei instrucțiuni explicite. |
| sale_document_remove | DELETE | /api/sales/{saleId}/documents/{documentId} | Elimină cerința documentară prin handler-ul auditat existent. |
| sale_message_review | PATCH | /api/sales/{saleId}/messages/{messageId}/review | Revizuiește mesajul/draftul dosarului cu schema existentă. |
| sale_message_evidence | PATCH | /api/sales/{saleId}/messages/{messageId}/send-evidence | Înregistrează dovada reală a trimiterii; nu inventa livrarea unui email. |
| sales_settings_update | PATCH | /api/sales/settings | Administrator: actualizează setările de vânzări prin schema existentă. |
| sales_template_create | POST | /api/sales/templates | Administrator: creează șablon email pentru dosare, folosind schema existentă. |
| sales_template_update | PATCH | /api/sales/templates/{templateId} | Administrator: editează șablonul email al agenției. |
| sales_template_action | POST | /api/sales/templates/{templateId} | Administrator: acțiune/versionare șablon email prin validările existente. |
| outreach_calls | GET | /api/ai-outreach/calls | Istoricul și starea apelurilor de prospectare accesibile agentului. |
| contract_generate | POST | /api/contracts/templates/{templateId}/generate | Generează PDF contract: values {câmp:valoare}, contactId/ownerId/propertyId opționale. templateId în params. |
| agency_agents | GET | /api/agency/agents | Lista agenților autorizați din agenție. |
| agency_agent_detail | GET | /api/agency/agents/{agentId} | Statistici agent: acces propriu sau admin. |
| billing_summary | GET | /api/billing/summary | Plan, funcționalități și locuri disponibile. |
| sales_settings | GET | /api/sales/settings | Setări vânzări accesibile agentului. |
| meta_status | GET | /api/marketing/meta/status | Starea integrării Meta. |
| meta_campaigns | GET | /api/marketing/meta/property-campaigns | Campanii Meta ale agenției. |
| meta_campaign_draft | POST | /api/marketing/meta/property-campaigns | Creează draft campanie Meta, fără publicare. |
| meta_campaign_publish | POST | /api/marketing/meta/property-campaigns/{campaignId}/publish | Publică campanie, cu controalele de buget/aprobare ale handler-ului. |
| meta_campaign_pause | POST | /api/marketing/meta/property-campaigns/{campaignId}/pause | Oprește campania. |
| tiktok_status | GET | /api/marketing/tiktok-ads/status | Starea TikTok Ads. |
| tiktok_organic_status | GET | /api/marketing/tiktok/status | Starea conexiunii TikTok organic. |
| tiktok_dashboard | GET | /api/marketing/tiktok/dashboard | Drafturi și publicări TikTok organic. |
| tiktok_post_draft | POST | /api/marketing/tiktok/post-drafts | Creează draft TikTok prin schema handler-ului existent. |
| tiktok_post_publish | POST | /api/marketing/tiktok/post-drafts/{draftId}/publish | Publică draft TikTok cu toate condițiile și aprobările existente. |
| tiktok_post_schedule | POST | /api/marketing/tiktok/post-drafts/{draftId}/schedule | Programează draft TikTok pentru data cerută. |
| tiktok_capabilities | GET | /api/marketing/tiktok-ads/capabilities | Capabilitățile efectiv disponibile TikTok Ads. |
| tiktok_operations | POST | /api/marketing/tiktok-ads/operations | Execută operație TikTok prin ledger/aprobările existente. |

Nu există generic HTTP, filesystem, shell, Firestore write sau tool de acordare a consimțământului. URL-urile de import au surse HTTPS exacte autorizate. Discovery filtrează după rol și flags; storia_unpublish, meta_campaign_publish, tiktok_capabilities și sales_settings_update necesită admin, iar handler-ele păstrează verificările suplimentare proprii.
