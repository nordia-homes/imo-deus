# ROUTING

Luna-first este politică executabilă, nu o etichetă UI. Semnalele permise: invalidCalls>=3, planningFailures>=2, dependencyDepth>=5 împreună cu estimatedTools>=8, sau prag de calitate documentat din eval. Sol necesită flag activ și minimum 0,015 USD rămas; reserve verifică întregul apel înainte de execuție.

Importanța agentului, prețul proprietății și lungimea promptului nu sunt motive de escaladare. Un singur tool invalid, timeout sau outage nu declanșează Sol. Runtime-ul escaladează pe eșecuri validate repetate; semnalele de complexitate/eval sunt disponibile în router pentru workflowuri care furnizează asemenea dovezi, nu sunt fabricate din text.

Ținta 90–95% taskuri obișnuite pe Luna este un obiectiv de producție, nu un procent introdus în cod. Telemetria calculează proporțiile reale și returnează null pentru zero observații. Benchmarkul fix pe fiecare model nu măsoară proporția de routing în producție.
