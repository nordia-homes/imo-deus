# Rig Jarvis

Personajul păstrează corpul rotund, puful crem/cyan, accentele coral, ochii cyan mari, antena curbată luminoasă, mâinile scurte și picioarele mici din referința canonică. Atlasul transparent a fost creat din referință cu ImageGen și este livrat local. Este un singur atlas cu piese separate, nu o serie de cadre ale întregului personaj.

16 straturi: corp, două brațe, două picioare, două suprafețe de ochi, două irisuri, două pupile, două pleoape, gură, antenă, glow. Dreptunghiurile atlasului sunt mapate în `JarvisCharacter.tsx`; transformările sunt în `character-v2.css`. Atlasul `rig-atlas-v2.png` are textura curățată prin ImageGen. Ochii sunt mai mici, picioarele se suprapun natural cu corpul, iar antena este ancorată în creștet. Corpul, brațele, ochii, gura și antena au transformări independente.

10 stări: IDLE, LISTENING, FINALIZING_SPEECH, PROCESSING, WORKING, SPEAKING, AWAITING_CONFIRMATION, SUCCESS, ERROR, RECONNECTING. 8 expresii: NEUTRAL_FRIENDLY, HAPPY, EXCITED, THOUGHTFUL, ATTENTIVE, CONFIRMING, SUCCESS, CONCERNED. 9 gesturi: NEUTRAL, OPEN_HANDS, ONE_HAND_EXPLAIN, POINT, HAPPY, THINKING, CONFIRM, SUCCESS, SORRY.

Personajul plutește cu amplitudine de 14px, înclină corpul, salută cu brațul și mișcă picioarele și antena independent. Ascultarea are o aplecare atentă, procesarea caută cu privirea și apropie mâna de față, vorbirea are gesturi ritmice, iar succesul produce două salturi scurte. Clipitul apare la intervale de 1,7–4,5 secunde. Ochii urmăresc cursorul printr-un listener pasiv cu requestAnimationFrame și cleanup. Gura răspunde la RMS-ul ieșirii audio la 20 Hz, inclusiv cu microfon oprit; nu simulează foneme din text. Intensitatea audio influențează amplitudinea gurii, corpul până la 2,5% și lumina antenei.

Scena fullscreen nu are header. `JarvisScene.tsx` și `scene.css` adaugă auroră teal/violet, particule, orbite lente, halo și o platformă luminoasă. Lumina reacționează la audio și starea conversației; procesarea accelerează orbitele. Controalele sunt într-un dock flotant și două butoane discrete în colț. Eticheta privind vocea AI este sub dock. Scena se recentrează când se deschide panoul CRM. Nu există blur animat pe suprafețe mari sau shadow pe întregul rig; gradientele și transformările reduc costul de randare.

Rig-ul compact de 58px are animațiile de repaus oprite. Voice mare are mișcare redusă prin `prefers-reduced-motion`. La pagină ascunsă clipitul este rarefiat, audio este oprit și microfonul este mut. Panoul mobil micșorează rig-ul și păstrează capul/statusul deasupra rezultatelor. Imaginea atlasului este cache-uită de browser; nu există cereri de imagini per frame.

Benchmarkul Chromium headless este în `VOICE_UI_TESTS.json`; FPS-ul este un rezultat al mediului de test, nu o garanție pentru toate telefoanele. Screenshoturile desktop/mobile au fost inspectate vizual. Rămâne verificarea mișcării pe hardware real și preferinței estetice a utilizatorului.
