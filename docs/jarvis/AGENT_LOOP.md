# AGENT LOOP

planTurn folosește Responses API într-o buclă read/plan/tool/observe, maximum 12 pași și 24 tools, 70.000 tokens cumulați, 0,12 USD, 120 s și 2.200 output tokens per apel. Se rezervă costul/tokens conservator înainte de fiecare apel; provider usage înlocuiește estimarea când există.

Modelele primesc schema funcțiilor disponibile; câmpurile simple au schema strictă nativă, iar payloadurile heterogene au JSON în string, validat apoi de Zod. Răspunsul final are schema text/intentStatus. Schema acțiunii se descoperă la cerere; propose_actions cere obligatoriu lista actions, inclusiv pentru un pas.

O eroare de infrastructură are maximum un retry pe același model. Două răspunsuri provider invalide sau trei apeluri tool invalide justifică Sol dacă există buget. Citirile simple tranzitorii 429/502/503/504 au maximum două încercări în deadline-ul toolului; scrierile și tools compuse nu se repetă automat. Timeouturile, accesul revocat și resursele lipsă nu justifică un model mai scump.

Rezultatele sunt validate înainte să ajungă în cards/context. Repetarea identică peste două apeluri este oprită; limitele globale împiedică buclele cu payloaduri ușor diferite. Datele calendaristice vin din resolve_datetime sau ISO explicit al agentului. Partial/incomplete nu înseamnă succes. Numai executorul confirmat poate produce efecte CRM.

Planurile compuse folosesc numai ID-uri confirmate anterior: campaignId, draftId, templateId și jobId sunt normalizate din răspunsurile reale ale handler-elor. Mesajele externe cer text/șablon concret în previzualizare; textul unui pas viitor nu poate fi aprobat printr-o referință. Excepția aiPresenterScript acceptă scenariul deja confirmat și limitat la 12.000 caractere.
