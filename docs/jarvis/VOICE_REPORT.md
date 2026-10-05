# Raport Jarvis Voice — 5 octombrie 2026

Implementarea este un shell vocal peste Jarvis existent. Benchmarkul a costat **0,05505 USD**: 30 probe TTS→STT și 10 probe live-STT. Nu s-au folosit date sau operații CRM reale pentru benchmark.

Corecție de producție: rutele publice ale atlasului și AudioWorklet au returnat 404 în primul rollout; permisiunea de microfon era acordată, dar încărcarea procesorului audio eșua. Atlasul este acum import static cu hash, iar procesorul este împachetat în shell. Testul UI include încărcarea sa în Web Audio real, pe lângă fixture-ul de conversație. Verificarea HTTP a atlasului livrat este inclusă în raportul de producție.

| # | Cerință | Implementare și dovadă |
|---|---|---|
| 1 | Arhitectură | AudioWorklet/VAD → STT server → workspace existent → prezentare → TTS PCM → rig local. [VOICE.md](VOICE.md). |
| 2 | Un singur Jarvis | Niciun planner, registry, executor sau matching vocal. Aceleași endpoint-uri și session ID. Testul de izolare inspectează importurile; testele UI verifică requesturile. |
| 3 | Fișiere create | `src/lib/jarvis-voice/{audio,command,presentation,provider,server,session,transport,vad}.ts`, suite de teste; `src/components/jarvis-voice/{JarvisVoice,JarvisCharacter,JarvisScene,VoiceContext}.tsx`, CSS; API Voice și metrics; OwnerConsentDialog comun; atlas și worklet local; două scripturi benchmark/UI; documentația Voice. |
| 4 | Fișiere modificate | Dashboard layout și AI Assistant Text pentru montare/context; package/lock pentru `ws` și tipuri; reguli Firestore/index telemetrie; App Hosting flag/voce; teste Text/rules. Nu se schimbă matchingul sau handler-ele CRM. |
| 5 | STT | `gpt-transcribe`, română explicită, hints imobiliare, WAV mono 24kHz, cerere limitată, timeout/cancel. |
| 6 | Benchmark STT | Benchmark istoric OpenAI Cedar loopback: p50 **410ms**, p95 **533ms**. Live: p50 **2241ms**, p95 **3154ms**, 10 probe Marin. Compararea live folosește un sample comis; nu este benchmark de input uman streaming. |
| 7 | TTS | ElevenLabs WebSocket text-to-dialogue/stream-input, model **eleven_v3_conversational**, PCM mono 24kHz, română explicită; renderer exclusiv pentru răspunsul Jarvis existent, maximum 25sec audio. |
| 8 | Voce | **Mihai – Inspires Confidence**, voce românească disponibilă în cont, configurată server prin JARVIS_ELEVENLABS_VOICE_ID. Cheia ElevenLabs este legată prin Secret Manager. |
| 9 | Română | Benchmark istoric OpenAI WER mediu loopback: Cedar **6,67%**, Marin **9,58%**, Coral **7,92%**. Nume proprii, numere și punctuație au erori; transcripturile exacte sunt în [VOICE_BENCHMARK.json](VOICE_BENCHMARK.json). Acest test combină TTS și STT, nu izolează acuratețea pe vorbitori români. |
| 10 | Politică răspuns | 1–2 propoziții, maximum 320 caractere; număr exact/primă oră, plan de confirmat, rezultate parțiale explicite. Fără LLM suplimentar pentru scurtare. |
| 11 | Panou | Cardurile și ActionPreview existente; paginare cu cursor; potriviri CRM separate; risc/cost extern; confirmare/anulare; linkuri către rezultate; acord WhatsApp comun. |
| 12 | Rig | 2D stratificat, animat din transformări independente, fără slideshow. [CHARACTER.md](CHARACTER.md). |
| 13 | Straturi | 10: corp albastru, ochi, irisuri, pupile, pleoape și gură; fără brațe/picioare/antenă. |
| 14 | Expresii | 8 expresii contractuale; starea alege atenție, procesare, confirmare, succes sau îngrijorare. |
| 15 | Gesturi | Gesturile contractuale sunt traduse în privire, înclinări, plutire, nod și salt la succes; fără membre. |
| 16 | Ochi | Urmărirea cursorului, pupile/irisuri independente și blink la 1,7–4,5sec. |
| 17 | Gură | Deschidere derivată din RMS audio, nu din text. Update la 20Hz; funcționează și cu microfon mut. |
| 18 | Antenă | Eliminată împreună cu creasta și membrele, conform cerinței. |
| 19 | Audio-reactiv | RMS normalizat/saturat; deformare corp maximum 2,5%; gură și halo reactive. |
| 20 | FPS | În probele scenei albastre: **43–60 FPS** în Chromium headless, inclusiv cu buildul rulând simultan. Mediul și valoarea ultimei probe sunt în VOICE_UI_TESTS.json; nu o garanție hardware. |
| 21 | Ctrl+Space | Event în renderer; protecție pentru input/editor/IME/repeat. Test UI trecut. |
| 22 | Esc | Închidere Voice și eliberare microfon; în acord închide întâi modalul. Test UI trecut. |
| 23 | Mobile launcher | Mascota compactă, one tap, pe paginile dashboard autentificate; ascunsă la tastatura virtuală. |
| 24 | Safe area | `env(safe-area-inset-bottom)` la launcher și footer. |
| 25 | Navigație mobilă | Launcher la 88px+safe area; nav existent 64px cu offset 8px. Test geometrie la 390×844 trecut. |
| 26 | Barge-in | 120ms vorbire susținută, abort TTS plus stop pe toate buffer-ele WebAudio; se anulează transcrierea veche. Teste de unitate și UI. AEC solicitat browserului, test hardware încă necesar. |
| 27 | Confirmări | „Da”/„Execută” aprobă doar planul deja prezentat, prin `execute` existent. „Anulează” folosește `cancel`. Incertitudinea se verifică, fără replay automat. Acordul WhatsApp rămâne explicit prin formular. |
| 28 | Privacy | Bearer auth și tenant proaspăt, API key numai server, fără date CRM în vocabularul STT; colecții private și metrics cu UID/rol. |
| 29 | Retenție | Audio raw nu este persistat în CRM sau analytics. Retenția providerilor OpenAI/ElevenLabs depinde de cont; nu se pretinde zero retention. |
| 30 | Paritate | Același input/session/job/approve/cancel/query/consent și aceleași componente; teste Text UI nemodificate funcțional au trecut. |
| 31 | p50 | Proba sintetică reală ElevenLabs: primul audio **1629ms**, audio **3,28sec**, 157440 bytes PCM și 78065 samples nenule. Nu este o măsurare end-to-end sau p50. |
| 32 | p95 | Nu există încă eșantion suficient pentru p95 ElevenLabs/end-to-end; benchmarkurile Cedar anterioare sunt istorice, nu descriu providerul actual. |
| 33 | Durată răspuns | Cedar medie **2,8sec**, p50 2,45sec, p95 5,6sec pe cele 10 texte sintetice. Răspunsurile reale CRM pot avea altă distribuție. |
| 34 | Cost STT | **0,0045 USD/min audio intrare**; live 0,017 USD/min, de 3,78 ori mai mult. |
| 35 | Cost TTS | ElevenLabs facturează în funcție de contract/credite și caractere. Fără tarif contractual configurat, costul este necunoscut (null), nu zero. Endpointul metrics separă evenimentele neprețuite. |
| 36 | Cost/1000min sesiune | Nu poate fi estimat complet fără tariful ElevenLabs și raportul real intrare/ieșire. Metrics raportează costurile cunoscute, caracterele și durata; vechile estimări Cedar nu se aplică. |
| 37 | Teste | 26 teste Voice; 223 teste CRM + Voice trecute în această modificare, 3 teste rules sărite fără emulator. 14 verificări Voice UI și 13 Text UI trecute. Regulile: 18 teste trecute anterior, nemodificate în această etapă. |
| 38 | Build/producție | Build local Next/TypeScript este verificat înainte de rollout; starea exactă a commitului/buildului și traficul final sunt în [VOICE_PRODUCTION.json](VOICE_PRODUCTION.json). Reguli și index de metrics publicate. |
| 39 | Acțiuni manuale | Refresh CRM și permite microfonul. Verifică pronunția vocii Mihai, întreruperea pe difuzor și microfonul pe dispozitivul real. Deployul și proba sintetică server se verifică separat în VOICE_PRODUCTION.json. |

## Acceptanță și limite

### Corecție redare vocală — 5 octombrie 2026

Logurile runtime au identificat `TypeError: b.mask is not a function` în ruta audio: Next împacheta incorect extensia opțională a bibliotecii `ws`. Biblioteca este acum externă în build, compresia WebSocket este dezactivată pentru PCM, iar `WS_NO_BUFFER_UTIL=true` impune implementarea JavaScript pentru mascarea cadrelor. Buildul verificat include `import("ws")` și dependențele bibliotecii în manifestul standalone.

Verificarea de regresie folosește decoderul PCM real din `VoiceAudio` într-un `OfflineAudioContext` Chromium: semnalul redat are amplitudine și RMS nenule, inclusiv peste limite de chunk impare, fără anularea propriei cereri. Sunt 26 teste Voice trecute și 14 verificări UI. O probă cu text sintetic fix este disponibilă exclusiv prin endpointul worker autentificat; verifică fluxul generat în runtime-ul de producție și nu procesează joburi sau automatizări CRM.

Dovezile deploymentului activ, procentul de trafic, modelul și proba audio sintetică actuală sunt în [VOICE_PRODUCTION.json](VOICE_PRODUCTION.json). Proba verifică generarea pe server; testul Chromium verifică decodarea/redarea, iar difuzorul dispozitivului utilizatorului rămâne acceptanță manuală.

Implementarea și testele automate sunt livrate; acceptanța auditivă/hardware nu poate fi echivalată cu fixture-uri. Permisiunea efectivă a microfonului, AEC pe difuzoare, latența pe rețeaua telefonului și naturalețea percepută a românei trebuie verificate în utilizare reală. Acțiunile externe păstrează restricțiile actuale Meta și permisiunile CRM; Voice nu le ocolește.

Surse oficiale verificate: [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text), [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), [Realtime Mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), [deprecări](https://developers.openai.com/api/docs/deprecations).

## Migrare ElevenLabs și transparență

Protocolul este verificat cu [documentația oficială ElevenLabs](https://elevenlabs.io/docs/api-reference/text-to-dialogue/ttd-websocket): o singură voce, header xi-api-key numai server, inputs și close_socket pentru flush. PCM permite delimitarea completă a turei. Anularea și erorile nu declanșează fallback la alt model. STT și executorii CRM existenți rămân comuni.

Tariful ElevenLabs variază cu contractul. Fără JARVIS_ELEVENLABS_USD_PER_1000_CHARACTERS configurat, costUsd este null, caracterele sunt contorizate, iar metrics expune explicit evenimentele fără preț; nu raportează cost zero fals.
