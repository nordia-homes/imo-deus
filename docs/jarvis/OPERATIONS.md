# OPERATIONS

Implementarea locală nu activează automat infrastructura și conturile live. Nicio campanie/publicare/trimitere reală și niciun backfill --apply nu au fost efectuate în această rundă.

Ordinea activării: verifică proiectul vizat; creează AI_ASSISTANT_WORKER_SECRET în Secret Manager și acordă acces App Hosting/Functions; configurează OPENAI_API_KEY/billing și modelele exacte; publică regulile server-managed și indexurile; verifică READY; rulează backfill dry-run și revizuiește înainte de --apply; publică aplicația și schedulerul; verifică heartbeat/readiness și probele proprii agent/admin cu două agenții; conectează OAuth/conturile externe și verifică statusul/costul din module.

Joburile sunt persistate server-side, lease300 s. POST start/execute_background lansează procesarea cu Next after; schedulerul Functions la5 minute recuperează coada. Turnurile întrerupte pot relua maximum o dată cu aceeași requestId și ledger de safe actions; planurile externe întrerupte nu se retrimit automat. SSE reconnect50 s, UI așteaptă până180 s; rezultatul final rămâne în istoric dacă browserul se închide. Nu există garanție de latență imediată fără worker sănătos.

Căutarea owners folosește Firestore live, nu primele100 din UI. Proiecția searchPrice/searchCurrency/searchVersion este scrisă atomic cu ingestia/enrichment/canonicalizare. Numără coverage la început; dacă există documente neindexate sau indexul nu e READY, citește live paginat. Maximum5.000 documente/scan, cursor explicit. Un anunț extern care nu a fost încă ingestat sau nu are publicationStatus=ready/isCanonical=true nu este disponibil pentru căutare; indexarea nu îl poate inventa. Nu există snapshot izolat între pagini, deci o căutare nouă reîmprospătează rezultatele la mutații concurente.

Flags: JARVIS_MEMORY, JARVIS_SUBAGENTS, JARVIS_AUTONOMOUS, JARVIS_INSIGHTS, JARVIS_AUTOMATIONS, JARVIS_SOL_ESCALATION (false dezactivează); JARVIS_MCP (true activează), JARVIS_DISABLED_TOOLS (CSV inclusiv action kinds), JARVIS_MCP_SERVERS/tokenEnv, JARVIS_MODEL_PRICING/version, JARVIS_REGIONAL_PROCESSING. Niciun flag nu poate activa modele în afara allowlistului.

Intervenții manuale: deployment și backfill aprobat; OpenAI billing/rate limits; Meta Business app review/live permissions, WhatsApp număr/WABA și șabloane aprobate, acorduri reale din apel; cont/ad account și autorizări Meta/TikTok, bugete; integrare portal și credențiale; servicii voice/video/OCR/storage; configurație/secret pentru fiecare MCP public. Verificarea pe conturi reale se face cu datele și aprobările operatorului, nu prin fixtures.
