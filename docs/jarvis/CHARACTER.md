# Rig Jarvis

Personajul păstrează corpul rotund, puful crem/cyan, accentele coral, ochii cyan mari, antena curbată luminoasă, mâinile scurte și picioarele mici din referința canonică. Atlasul transparent a fost creat din referință cu ImageGen și este livrat local. Este un singur atlas cu piese separate, nu o serie de cadre ale întregului personaj.

16 straturi: corp, două brațe, două picioare, două suprafețe de ochi, două irisuri, două pupile, două pleoape, gură, antenă, glow. Dreptunghiurile atlasului sunt mapate în `JarvisCharacter.tsx`; transformările și skinningul 2D sunt în `character.css`. Corpul, brațele, ochii, gura și antena au transformări independente. Nu se folosește avatar cloud, video sau lip-sync extern.

10 stări: IDLE, LISTENING, FINALIZING_SPEECH, PROCESSING, WORKING, SPEAKING, AWAITING_CONFIRMATION, SUCCESS, ERROR, RECONNECTING. 8 expresii: NEUTRAL_FRIENDLY, HAPPY, EXCITED, THOUGHTFUL, ATTENTIVE, CONFIRMING, SUCCESS, CONCERNED. 9 gesturi: NEUTRAL, OPEN_HANDS, ONE_HAND_EXPLAIN, POINT, HAPPY, THINKING, CONFIRM, SUCCESS, SORRY.

Respirația și antena au animații lente diferite. Clipitul apare la intervale de 2,5–6 secunde și folosește pleoapele plus închiderea ochiului. Irisul și pupila au gaze comun, direcționat către panou, cu mișcări mici. Gura răspunde la RMS-ul ieșirii audio la 20 Hz, inclusiv cu microfon oprit; nu citește textul pentru a simula foneme. Corpul poate varia cel mult 1,5% din audio, deci nu dansează pe fiecare sunet. Brațele au puncte de pivot independente și tranziții amortizate. Antena pulsează la procesare și se mișcă ușor în repaus.

Rig-ul compact de 58px are animațiile de repaus oprite. Voice mare are mișcare redusă prin `prefers-reduced-motion`. La pagină ascunsă clipitul este rarefiat, audio este oprit și microfonul este mut. Panoul mobil micșorează rig-ul și păstrează capul/statusul deasupra rezultatelor. Imaginea atlasului este cache-uită de browser; nu există cereri de imagini per frame.

Benchmarkul Chromium headless este în `VOICE_UI_TESTS.json`; FPS-ul este un rezultat al mediului de test, nu o garanție pentru toate telefoanele. Screenshoturile desktop/mobile au fost inspectate vizual. Rămâne verificarea mișcării pe hardware real și preferinței estetice a utilizatorului.
