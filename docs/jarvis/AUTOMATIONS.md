# AUTOMATIONS

Automatizări implementate: followup_task, owner_watch, insight_report, matching_watch, whatsapp_template. Contractele cer nextRunAt verificat, interval>=30 minute, maximum365 execuții și rolul actorului. Crearea necesită plan confirmat și heartbeat real al workerului în ultimele15 minute.

Workerul revalidează membership, face claim/lease tranzacțional și persistă rezultat/stare în job și oglinda agenției. Rezultatele externe ambigue devin unknown/blocked și nu se retrimit. WhatsApp trece prin coada existentă, aprobări șablon/acord/limite curente, cu requestId persistat înainte și stopOnReply.

Owner_watch salvează scanCursor și deduplicatează notificările pe listing ID; corpusul mare continuă în următoarele execuții. Matching_watch folosește motorul ImoDeus existent și notifică numai scorurile existente peste prag. Insight-urile deterministe acoperă lead Nou fără follow-up, sarcini întârziate și conflicte de vizionări; sunt bounded și declară analiza parțială.

Scoped autonomy: off implicit pentru fiecare agent; UI autorizează 30 zile numai sarcini, note, import, prospect:add și recomandări portal. Mesaje/publicări/campanii/preț/archive/consimțământ nu se execută prin această politică. După rezultat incert, nu se creează un nou plan cu cheie diferită care ar putea dubla efectul.
