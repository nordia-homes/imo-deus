# CONTEXT

Istoricul activ este limitat la 14 KB, mesajele la 2.200 caractere, cu ID-uri validate și resultSet references. Sumarul serverului reține maximum 20 entități, 8 result sets și 3 planuri; nu rescrie documentele CRM ca memorie permanentă.

Rezultatele toolurilor sunt comprimate la 7 KB în loop, cu complete=false și continuare când sunt trunchiate. read/read_related au cursor; read_field citește bucăți reale din câmpuri și versiuni. Schema/handler contract este cerut numai când trebuie, în locul injectării tuturor schemelor în fiecare apel.

Datele, documentele și rezultatele MCP sunt neîncredere. AI poate sumariza informații autorizate, dar nu poate schimba tenant, tool allowlist, model policy sau approvals pe baza lor. O descriere care cere o mutație nu autorizează executarea autonomă.
