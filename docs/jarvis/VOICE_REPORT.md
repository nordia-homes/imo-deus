# Raport Jarvis Voice — 5 octombrie 2026

Implementarea este un shell vocal peste Jarvis existent. Benchmarkul a costat **0,05505 USD**: 30 probe TTS→STT și 10 probe live-STT. Nu s-au folosit date sau operații CRM reale pentru benchmark.

Corecție de producție: rutele publice ale atlasului și AudioWorklet au returnat 404 în primul rollout; permisiunea de microfon era acordată, dar încărcarea procesorului audio eșua. Atlasul este acum import static cu hash, iar procesorul este împachetat în shell. Testul UI include încărcarea sa în Web Audio real, pe lângă fixture-ul de conversație. Verificarea HTTP a atlasului livrat este inclusă în raportul de producție.

| # | Cerință | Implementare și dovadă |
|---|---|---|
| 1 | Arhitectură | AudioWorklet/VAD → STT server → workspace existent → prezentare → TTS PCM → rig local. [VOICE.md](VOICE.md). |
| 2 | Un singur Jarvis | Niciun planner, registry, executor sau matching vocal. Aceleași endpoint-uri și session ID. Testul de izolare inspectează importurile; testele UI verifică requesturile. |
| 3 | Fișiere create | `src/lib/jarvis-voice/{audio,command,presentation,provider,server,session,transport,vad}.ts`, două suite de teste; `src/components/jarvis-voice/{JarvisVoice,JarvisCharacter}.tsx`, CSS; API Voice și metrics; OwnerConsentDialog comun; atlas și worklet local; două scripturi benchmark/UI; documentația Voice. |
| 4 | Fișiere modificate | Dashboard layout și AI Assistant Text pentru montare/context; package/lock pentru `ws` și tipuri; reguli Firestore/index telemetrie; App Hosting flag/voce; teste Text/rules. Nu se schimbă matchingul sau handler-ele CRM. |
| 5 | STT | `gpt-transcribe`, română explicită, hints imobiliare, WAV mono 24kHz, cerere limitată, timeout/cancel. |
| 6 | Benchmark STT | Cedar loopback: p50 **410ms**, p95 **533ms**. Live: p50 **2241ms**, p95 **3154ms**, 10 probe Marin. Compararea live folosește un sample comis; nu este benchmark de input uman streaming. |
| 7 | TTS | Realtime WebSocket `gpt-realtime-2.1-mini`; conversație izolată, zero tools, instrucțiune verbatim, PCM streaming; maximum 25sec audio. Vechiul endpoint `/audio/speech` a returnat 404 în proba reală și nu este folosit aici. |
| 8 | Voce | **Cedar**, configurabilă server; comparație cu Marin/Coral. Selecția se bazează pe loopback și latență, nu pe o evaluare auditivă umană inventată. |
| 9 | Română | WER mediu loopback: Cedar **6,67%**, Marin **9,58%**, Coral **7,92%**. Nume proprii, numere și punctuație au erori; transcripturile exacte sunt în [VOICE_BENCHMARK.json](VOICE_BENCHMARK.json). Acest test combină TTS și STT, nu izolează acuratețea pe vorbitori români. |
| 10 | Politică răspuns | 1–2 propoziții, maximum 320 caractere; număr exact/primă oră, plan de confirmat, rezultate parțiale explicite. Fără LLM suplimentar pentru scurtare. |
| 11 | Panou | Cardurile și ActionPreview existente; paginare cu cursor; potriviri CRM separate; risc/cost extern; confirmare/anulare; linkuri către rezultate; acord WhatsApp comun. |
| 12 | Rig | 2D stratificat, animat din transformări independente, fără slideshow. [CHARACTER.md](CHARACTER.md). |
| 13 | Straturi | 16: corp, brațe, picioare, ochi, irisuri, pupile, pleoape, gură, antenă, glow. |
| 14 | Expresii | 8 expresii contractuale; starea alege atenție, procesare, confirmare, succes sau îngrijorare. |
| 15 | Gesturi | 9 gesturi, pivoturi independente, gesturi ritmice și salturi scurte la succes. |
| 16 | Ochi | Urmărirea cursorului, pupile/irisuri independente și blink la 1,7–4,5sec. |
| 17 | Gură | Deschidere derivată din RMS audio, nu din text. Update la 20Hz; funcționează și cu microfon mut. |
| 18 | Antenă | Animație lentă, glow contextual, puls la procesare. |
| 19 | Audio-reactiv | RMS normalizat/saturat; deformare corp maximum 2,5%; halo și antenă reactive. |
| 20 | FPS | **57,5 FPS** în Chromium headless, măsurare de 2sec. Numărul exact și mediul sunt în [VOICE_UI_TESTS.json](VOICE_UI_TESTS.json). Necesită acceptanță pe dispozitive reale. |
| 21 | Ctrl+Space | Event în renderer; protecție pentru input/editor/IME/repeat. Test UI trecut. |
| 22 | Esc | Închidere Voice și eliberare microfon; în acord închide întâi modalul. Test UI trecut. |
| 23 | Mobile launcher | Mascota compactă, one tap, pe paginile dashboard autentificate; ascunsă la tastatura virtuală. |
| 24 | Safe area | `env(safe-area-inset-bottom)` la launcher și footer. |
| 25 | Navigație mobilă | Launcher la 88px+safe area; nav existent 64px cu offset 8px. Test geometrie la 390×844 trecut. |
| 26 | Barge-in | 120ms vorbire susținută, abort TTS plus stop pe toate buffer-ele WebAudio; se anulează transcrierea veche. Teste de unitate și UI. AEC solicitat browserului, test hardware încă necesar. |
| 27 | Confirmări | „Da”/„Execută” aprobă doar planul deja prezentat, prin `execute` existent. „Anulează” folosește `cancel`. Incertitudinea se verifică, fără replay automat. Acordul WhatsApp rămâne explicit prin formular. |
| 28 | Privacy | Bearer auth și tenant proaspăt, API key numai server, fără date CRM în vocabularul STT; colecții private și metrics cu UID/rol. |
| 29 | Retenție | Zero audio raw în persistența CRM/loguri/analytics; buffer-ele sunt eliberate. Comanda text rămâne în istoricul Jarvis existent. Retenția OpenAI depinde de cont; nu se pretinde ZDR. |
| 30 | Paritate | Același input/session/job/approve/cancel/query/consent și aceleași componente; teste Text UI nemodificate funcțional au trecut. |
| 31 | p50 | STT 410ms; TTS primul audio 1525ms pentru Cedar. **Nu** sunt prezentate drept latență end-to-end. Core v5 Luna a avut medie 6127ms în evaluarea separată; latența totală este colectată prin `turnToAudioMs` în producție. |
| 32 | p95 | STT 533ms; TTS primul audio 2158ms. Nu există încă un eșantion de utilizare reală pentru p95 end-to-end. |
| 33 | Durată răspuns | Cedar medie **2,8sec**, p50 2,45sec, p95 5,6sec pe cele 10 texte sintetice. Răspunsurile reale CRM pot avea altă distribuție. |
| 34 | Cost STT | **0,0045 USD/min audio intrare**; live 0,017 USD/min, de 3,78 ori mai mult. |
| 35 | Cost TTS | Cedar: 0,0135244 USD pentru 28sec, echivalent în acest eșantion **0,02898 USD/min output**. Tariful oficial este per token; normalizarea pe minute nu este tarif fix. |
| 36 | Cost/1000min sesiune | Exemplu declarat: 20% intrare, 10% ieșire → **3,80 USD audio**. Dacă ieșirea medie este 2,8sec, sunt aproximativ 2143 turnuri: cost core Luna din benchmarkul v5 adaugă aproximativ 0,70 USD, total **4,50 USD**. Dacă toate ar folosi Sol, aproximativ **16,06 USD**. Acestea sunt scenarii sintetice, fără TVA/alte canale; nu promisiuni de facturare. Costurile reale și utilizarea ocupată sunt în metrics. |
| 37 | Teste | Voice: 21 teste, inclusiv cleanup, resample, WAV fals, upload limitat, rezultate parțiale, izolare, paritate, VAD și confirmări. Verificarea precedentă a suitelor CRM/audio/owners/communications: 349 trecute, 15 teste opționale/emulator/live sărite; 18 teste emulator rules trecute separat. 13 verificări Voice UI, inclusiv procesare în OfflineAudioContext real, și 13 Text UI. |
| 38 | Build/producție | Build local Next/TypeScript este verificat înainte de rollout; starea exactă a commitului/buildului și traficul final sunt în [VOICE_PRODUCTION.json](VOICE_PRODUCTION.json). Reguli și index de metrics publicate. |
| 39 | Acțiuni manuale | Refresh CRM; permite microfonul. Verifică pe browser/Electron/telefon real: 3 comenzi în română cu nume/ore/bugete, întrerupere cu difuzor deschis, mute/exit, revenire în Text, un plan de test aprobat. Ascultă Cedar și validează pronunția. Nu se cere alt API key sau deploy manual. |

## Acceptanță și limite

### Corecție redare vocală — 5 octombrie 2026

Logurile runtime au identificat `TypeError: b.mask is not a function` în ruta audio: Next împacheta incorect extensia opțională a bibliotecii `ws`. Biblioteca este acum externă în build, compresia WebSocket este dezactivată pentru PCM, iar `WS_NO_BUFFER_UTIL=true` impune implementarea JavaScript pentru mascarea cadrelor. Buildul verificat include `import("ws")` și dependențele bibliotecii în manifestul standalone.

Verificarea de regresie folosește decoderul PCM real din `VoiceAudio` într-un `OfflineAudioContext` Chromium: semnalul redat are amplitudine și RMS nenule, inclusiv peste limite de chunk impare, fără anularea propriei cereri. Sunt 21 teste Voice trecute și 10 verificări UI. O probă cu text sintetic fix este disponibilă exclusiv prin endpointul worker autentificat; verifică fluxul generat în runtime-ul de producție și nu procesează joburi sau automatizări CRM.

Buildul `build-2026-10-05-008`, commit `a0cd28cb`, este READY și primește 100% din trafic. Proba reală de producție a returnat HTTP 200, **153.600 bytes PCM**, 76.357 eșantioane nenule, **3,2 secunde audio** și primul fragment în **1.274 ms**. Costul probei sintetice este 0,0014384 USD. Apelul fără autentificare este respins cu HTTP 403. Dovezile și configurația runtime sunt în [VOICE_PRODUCTION.json](VOICE_PRODUCTION.json). Proba verifică generarea pe server; testul Chromium verifică decodarea și redarea, iar difuzorul dispozitivului utilizatorului rămâne acceptanță manuală.

Implementarea și testele automate sunt livrate; acceptanța auditivă/hardware nu poate fi echivalată cu fixture-uri. Permisiunea efectivă a microfonului, AEC pe difuzoare, latența pe rețeaua telefonului și naturalețea percepută a românei trebuie verificate în utilizare reală. Acțiunile externe păstrează restricțiile actuale Meta și permisiunile CRM; Voice nu le ocolește.

Surse oficiale verificate: [Speech to text](https://developers.openai.com/api/docs/guides/speech-to-text), [Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription), [Realtime Mini](https://developers.openai.com/api/docs/models/gpt-realtime-2.1-mini), [deprecări](https://developers.openai.com/api/docs/deprecations).
