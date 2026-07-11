# ImoDeus TikTok AI Video Studio - plan complet pentru produs premium

## Obiectiv

Construim un AI Video Studio imobiliar care nu doar transforma fotografii in video, ci produce continut regizat pentru vanzare: storyboard, script cursiv, voce ElevenLabs, subtitrari karaoke premium, randare FFmpeg, draft TikTok si publicare prin API.

Produsul trebuie sa fie superior unui simplu generator de slideshow prin trei lucruri:

- decizie creativa asistata de AI;
- control vizual si editorial pentru agent;
- flux complet de la media importata la postare TikTok.

## Principii de produs

- Primul ecran trebuie sa fie un studio de lucru, nu o pagina de prezentare.
- Agentul trebuie sa inteleaga imediat ce trebuie facut: importa media, genereaza concept, ajusteaza, randeaza, publica.
- AI-ul trebuie sa propuna, nu sa forteze: agentul poate edita scriptul, hook-ul, caption-ul, ordinea scenelor si vocea.
- Output-ul trebuie sa respecte regulile TikTok: 9:16, safe zones, subtitrare lizibila, CTA clar, durata controlata.
- Brandul agentiei trebuie sa fie constant: fonturi, culori, watermark, ton, voce si CTA salvate ca preset.

## Arhitectura

### 1. Project Builder

Entitatea `TikTokStudioProject` devine centrul modulului:

- media sursa;
- preset creativ;
- brand kit;
- storyboard;
- script;
- hook;
- caption TikTok;
- hashtags;
- voce ElevenLabs;
- subtitrare;
- quality score;
- output asset.

### 2. Creative Intelligence

Un serviciu AI genereaza:

- trei hook-uri pentru primele secunde;
- storyboard pe scene;
- script cursiv cu diacritice;
- descriere TikTok separata de subtitrare;
- hashtags locale;
- scor de performanta;
- recomandari concrete pentru imbunatatire.

Fallback-ul local trebuie sa functioneze si fara OpenAI, ca agentul sa nu ramana blocat.

### 3. Render Engine

Rendererul cloud trebuie sa accepte proiecte independente, nu doar proprietati:

- descarcare media din Firebase Storage;
- voce ElevenLabs cu timestamps;
- subtitrare karaoke bazata pe timpi ElevenLabs;
- video pana la finalul audio-ului, indiferent de lungimea scriptului;
- FFmpeg Ken Burns, crop 9:16, tranzitii, thumbnail;
- upload MP4 si thumbnail inapoi in Storage;
- creare automata `TikTokStudioAsset` video.

### 4. Publishing Layer

Fluxul TikTok trebuie sa includa:

- connect OAuth;
- creator info;
- draft;
- descriere TikTok editabila;
- privacy si flags;
- upload chunked;
- status;
- istoric;
- suport pentru video tururi, asset-uri importate si proiecte AI.

## UX complet

### Zona AI Video Studio

- import video/foto;
- grila media;
- selectie multipla de fotografii;
- preview video importat;
- publicare directa pentru video-uri;
- trimitere fotografie in composer.

### Composer

- preset creativ;
- titlu proiect;
- aspect ratio;
- voice ID;
- script editabil;
- buton AI Concept;
- hook-uri generate;
- storyboard generat;
- quality score;
- caption TikTok separat;
- buton randare reala.

### Preview si publicare

- dupa randare, video-ul generat se deschide direct in modalul de publicare;
- descrierea TikTok este precompletata din AI caption;
- agentul poate salva draft sau publica;
- istoric proiecte si status randare.

## Preseturi premium

### Luxury Real Estate

- ritm elegant;
- texte curate;
- accent roz premium;
- voce calda, calma;
- script aspirational.

### Fast TikTok Hook

- ritm rapid;
- hook puternic;
- scene scurte;
- subtitrari mari;
- CTA direct.

### Warm Family Home

- ton apropiat;
- accent pe confort, lumina, functionalitate;
- voce calda si prietenoasa.

### Investor Deal

- ton pragmatic;
- accent pe randament, zona, pret, potential;
- caption orientat spre decizie.

### New Development

- ton modern;
- accent pe cladire, facilitati, finisaje, comunitate;
- vizual curat si premium.

## Quality Score

Scorul trebuie sa fie calculat inainte de randare, pe baza:

- numarului de fotografii;
- existenta unui hook;
- lungimea scriptului;
- existenta CTA;
- existenta caption TikTok;
- claritatea hashtag-urilor;
- raportul de aspect;
- pregatirea vocii;
- risc de video prea lung;
- existenta storyboard-ului.

Scorul trebuie sa produca recomandari actionabile, nu doar un numar.

## Etape implementare

### Status implementat in acest pachet

- AI Creative Brief cu hook-uri, script cursiv, caption TikTok, hashtags, storyboard, missing shots, weak photos si quality score.
- Preseturi creative: Luxury Real Estate, Modern Urban, Fast TikTok Hook, Warm Family Home, Investor Deal, New Development.
- Timeline editabil in UI: reorder, durata per scena, overlay text si motion per scena.
- Preseturi subtitrare: HeyGen Pink, TikTok Bold, Luxury White, Minimal Premium, High Contrast.
- Voice profiles: femeie calda, femeie tanara TikTok, luxury calm, energetic, profesional.
- Randare cloud foto -> video cu ElevenLabs, karaoke subtitles, crossfade, brand watermark si durata sincronizata cu voiceover-ul.
- Brand kit salvat pe proiect: brand, accent, font, watermark, CTA, voce si subtitrare implicita.
- Repurpose variants salvate pe proiect: TikTok, Reels, Story, Shorts, fara subtitrari, CTA alternativ.
- Programare pregatita la nivel de draft/proiect prin `scheduledAt` si `scheduleStatus`.
- Publicare TikTok pastreaza sursa `studio_project`, asset-ul generat, caption-ul si hashtag-urile AI.

### Etapa 1 - fundament premium

- document plan complet;
- tipuri pentru preseturi, storyboard, brand kit, hooks, caption, score;
- API `creative-brief`;
- UI pentru AI Concept;
- randare din proiecte AI existente;
- draft TikTok din asset generat.

### Etapa 2 - editor timeline

- scene reorder drag & drop;
- durata per scena;
- crop per scena;
- text overlay per scena;
- waveform audio;
- preview rapid in browser.

### Etapa 3 - renderer avansat

- tranzitii `xfade`;
- auto-enhance foto;
- blur background pentru media nepotrivita;
- safe-zone TikTok;
- watermark/brand kit;
- scene pacing din storyboard.

### Etapa 4 - publishing si analytics

- programare postari;
- calendar continut;
- analytics postare;
- template-uri caption A/B;
- recomandari de ora publicare;
- reutilizare continut pentru Reels/Shorts.

## Standard de calitate

Un video generat de modul trebuie sa indeplineasca minim:

- voce naturala ElevenLabs;
- subtitrare alba cu highlight roz #FF007F;
- subtitrare in doua randuri, pozitie fixa;
- duratata video >= durata audio;
- descriere TikTok editabila separat;
- thumbnail generat;
- asset video gata de publicare;
- proiect salvat cu status si erori clare.

## Directia finala

ImoDeus TikTok AI Video Studio trebuie sa devina un studio de creatie vertical pentru agentii imobiliari: agentul importa media, AI-ul propune regia, sistemul randeaza video-ul premium si apoi il publica/urmareste in TikTok.
