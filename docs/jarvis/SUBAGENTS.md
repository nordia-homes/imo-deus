# SUBAGENTS

delegate_read pornește o planificare copil pe același provider/context autentificat și același buget global, cu goal<=1.000 caractere, maximum 3 tools permise și schema auxiliară operation_contract. Copilul are maximum 3 pași, 30 s, 16.000 tokens conservator și 0,03 USD în bugetul parent; output<=1.200 tokens.

Nu există recursie, scrieri, creare de consimțământ, apeluri arbitrare de model sau recalculare matching în subagent. Pentru analiza matching primește resultSetId și folosește filtrarea contextuală. Datele/telemetria copilului sunt incluse în parent, fără double billing.

parallel_read folosește maximum 3 citiri independente și Promise.allSettled. Eșecul unui braț nu anulează rezultatele confirmate; complete=false dacă un braț este parțial/eșuat. Fiecare citire consumă buget și are metadate de observabilitate fără payload.
