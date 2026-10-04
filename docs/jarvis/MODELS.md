# MODELS

DEFAULT MODEL = GPT-6 Luna (gpt-6-luna). COMPLEX MODEL = GPT-6.1 Sol (gpt-6.1-sol). Allowlistul are exact două ID-uri; orice alt model, inclusiv GPT-6 Astra și GPT-5.6 Sol, este refuzat chiar dacă vine din env sau prompt.

OPENAI_ASSISTANT_MODEL și JARVIS_SOL_MODEL pot confirma doar mappingul logic obligatoriu, nu îl pot schimba. Luna folosește low, Sol medium la escaladare. Adapterul Responses include encrypted reasoning pentru continuitatea protocolului; chain-of-thought nu se afișează și nu se persistă în istoric/telemetrie. store=false.

Generarea scenariilor video pornită de Jarvis folosește același provider și contabilizează costul auxiliar. Video_create cu presenter cere aiPresenterScript furnizat explicit; jobul nu generează text ulterior printr-un model legacy. Media/voice providers existente sunt integrări de randare, cu propriile configurații și costuri; nu sunt modele de raționament Jarvis.
