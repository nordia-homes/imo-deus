# OBSERVABILITY

assistantTelemetry salvează usage/input/output/cached/cache-write tokens, cost estimat sau raportat, pricing version, modelele/reasoning effort/reason de routing, tool name/status/durată/hash și versiuni. Nu salvează prompts, telefon, textul documentului, argumente brute sau erori provider cu secrets.

Telemetria include snapshotul configurației efective: flags, limitele implicite și regional processing, fără valori secrete. Astfel comparațiile între versiuni și costuri pot identifica schimbările de politică.

GET /api/ai-assistant/metrics?from=ISO&to=ISO, interval<=366 zile: agentul vede propriile date, admin vede agenția. Scan<=5.000 documente cu continuation autorizat, complete explicit. Grupează cost/day/month/user, tokens/models, Luna-solved/Sol-escalated, approval required/approved/cancelled, execution states, retry rate și categorii de provider errors.

Luna-solved înseamnă răspuns/plan pregătit cu status success fără Sol, nu livrare WhatsApp sau închidere tranzacție. Delivery/provider/domain queue au stări separate. Pentru lipsa observațiilor, procentele și mediile sunt null. Apelurile text auxiliare nu măresc numărul de turns rezolvate.

Progresul persistat este metadată operațională. Istoricul operational/ledger conține date de business necesare execuției și este privat; nu este un log public de telemetrie.
