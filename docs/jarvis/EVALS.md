# EVALS

Benchmark real OpenAI pe date sintetice autorizate, 35 scenarii identice/model, maximum8 pași/scenariu și plafon1 USD/rulare. Nu citește/scrie CRM, nu trimite mesaje și nu publică. Contractele Zod actuale și datele deterministe validează tool calls; providerul și function schemas sunt cele reale. Datele fixture sunt puține și nu demonstrează scalabilitatea/fiabilitatea conturilor externe.

| Model | Rezolvate | Cost mediu USD | Latență medie ms | Cached tokens |
| --- | --- | --- | --- | --- |
| Luna | 35/35 (100.00%) | 0.000171733 | 4235.2 | 280069 |
| Sol | 35/35 (100.00%) | 0.002499451 | 11712.8 | 255858 |

Cost total final 0.093491465 USD. Rezultate/versioning exacte în [BENCHMARK_RESULTS.json](BENCHMARK_RESULTS.json). Aceste costuri includ cache și tarifele raportate, nu taxele integrărilor externe. Sol a avut variație temporală de latență; nu extrapolăm media ca SLA.

Istoric transparent: primul simulator avea erori de fixture/grader și a fost corectat; o rundă native v3 a avut Luna31/35 și Sol35/35. Un caz Luna era limită corectă129999.99 vs grader130000; trei aveau payload single-action în locul actions[]. Schema/repair instructions au fost clarificate și runda completă repetată, fără mascarea validărilor. Toleranța graderului este doar un cent descendent pentru priceMax.

Routerul este verificat prin teste executabile Luna-first, un singur failure fără Sol, trei invalid calls→Sol, două invalid outputs→Sol, outage fără Sol și insuficiență buget. Benchmarkul compară fixed-model quality, nu este măsurare a procentului real de escaladare în producție. Prompt-injection/tenant/secret/forbidden-model comenzi și autonomia pentru preview/negații sunt testate.
