# Audit TikTok Ads și Video Studio — 17 septembrie 2026

## Verdict și limite

Crearea unei reclame complete nu este disponibilă în starea observată în Imodeus Desktop: AD_CREATE și SPARK_NEW_VIDEO_AD_ONLY sunt indisponibile, schema reclamei lipsește, iar butonul de creare este dezactivat. Nu a fost creată sau activată o reclamă reală în acest audit. Nu poate fi certificat un flux end-to-end funcțional.

Au fost inspectate codul local, rutele Ads/Studio, backendul, testele și arborele de accesibilitate al ferestrei Imodeus Desktop. Captura grafică a eșuat cu `SetIsBorderRequired failed: No such interface supported (0x80004002)`. Citirea accesibilității a reușit; încercarea de sincronizare nu a putut fi executată, raportând `coordinate input geometry is unavailable`. Nu pretindem inspecție vizuală din screenshot sau succesul sincronizării.

Interfața Desktop are texte diferite de codul local (de exemplu matricea de capabilități și permisiunile). Versiunea livrată trebuie reconciliată cu versiunea locală înainte de validarea modificărilor. Nu a fost stabilit commitul servit în Desktop.

## Observații din aplicația reală

- Advertiser: Nordia Homes; status afișat STATUS_ENABLE; billing ready; spend switch activ.
- Identitate: imodeus5; Deliver ads DA, Publish new NU, Only show as ads NU; ultima verificare afișată 16 septembrie 2026, 12:01.
- AD_CREATE, AD_READ, AD_UPDATE, AD_PAUSE, AD_RESUME și AD_REVIEW_READ apar NOT_DISCOVERED. Cele două fluxuri Spark sunt blocate de AD_CREATE.
- TARGETING_READ și TIKTOK_ACCOUNT_AUTHORIZE apar indisponibile. Mai multe alte capabilități sunt ambigue.
- Proprietatea selectată este un apartament din Sectorul 5, iar video-ul selectat este denumit Hils Brauner. Asocierea nu este verificată înainte de preselectare.
- Video-ul afișat are 181,88 secunde și 42,3 MB. Aceste date arată existența unui material în bibliotecă, nu validează crearea de reclame sau calitatea video.
- Formularul afișează opțiuni pentru aplicații iOS, catalog, RTA și alte scenarii fără relevanță implicită pentru promovarea proprietăților. Obiectivul apare ca text liber. Search campaign apare activat în starea observată.
- Istoricul operațional afișat este gol.

## Probleme prioritare și remediere

1. **P0 — creare indisponibilă în contul observat.** Investigați catalogul efectiv, granturile, paginația, mappingul și versiunea livrată. Lipsa AD_CREATE în Imodeus nu dovedește lipsa operației în platforma TikTok. Revalidați contractul real și creați o reclamă dezactivată, apoi citiți ID-urile și starea înapoi.
2. **P1 — activare/oprire repetată poate raporta succes din cache.** `activateDraft` și `pauseDraftResources` refolosesc chei derivate numai din draft și capabilitate. `beginOperation` returnează rezultatul unei operații reușite. După activare → oprire → activare, a doua activare poate să nu mai ajungă la TikTok. Folosiți o intenție nouă pentru fiecare comandă nouă, aceeași cheie numai pentru retry-ul acelei comenzi și read-back al stării remote.
3. **P1 — draftul afișat poate aparține altui context.** `loadWorkspace` selectează prima operație Spark reușită fără verificarea advertiserului, iar schimbarea advertiserului nu golește complet formularul/draftul. Legați draftul explicit de advertiser, proprietate, creative și versiune. Anulați răspunsurile vechi la schimbarea contextului. Backendul verifică ownership, dar UI poate afișa resursa greșită sau eșua.
4. **P1 — confirmarea financiară nu arată un rezumat remote verificat.** Bugetul anterior este introdus manual, iar dialogul de activare face referire la configurația din formular. Citiți valoarea reală și programul resursei, afișați monedă/fus orar și confirmați exact acea versiune.
5. **P1 — billing ready este prea permisiv în cod.** Prezența unui câmp balance/credit poate seta ready fără verificarea valorii sau a eligibilității efective. Separați date disponibile, metodă de plată, sold și capacitatea de livrare.
6. **P1 — asocierea proprietate/video se pierde.** Crearea proiectelor Studio nu primește propertyId, iar assetul rezultat nu îl persistă explicit. Draftul organic din Studio setează propertyId null. Adăugați legătura pe proiect, asset, versiune, draft, campanie și rezultate; nu selectați implicit primul video al agenției.
7. **P1 — funcții video prezentate peste implementarea efectivă.** Se salvează mai multe repurposeVariants, dar rendererul produce un singur MP4. `no_subtitles` influențează acel unic rezultat. Voice profile este salvat, însă sinteza folosește voiceId. Implementați variante reale cu output separat și mapare verificabilă a vocilor.
8. **P1 — randare sincronă și fără protecție explicită la dublare.** Endpointul așteaptă randarea în request (maxDuration 300); serviciul nu are lease/idempotency explicit pentru randări concurente. Introduceți joburi persistente, progres, retry controlat și versiuni de output.
9. **P2 — programare incompletă.** Datele scheduledAt/scheduleStatus sunt salvate; în codul inspectat nu a fost identificat un executor TikTok pentru publicarea organică programată. Implementați și verificați workerul înainte de a prezenta programarea ca funcție disponibilă.
10. **P2 — raportare confundată cu evaluarea creativului.** Tabul Performance din Studio afișează scorul AI și module premium, nu performanță TikTok. Separați calitatea estimată a materialului de metricile reale de difuzare.
11. **P2 — UI generică, prea densă.** 33 de operații într-un selector, patru scheme deschise, câmpuri JSON și rezultate brute. Înlocuiți cu fluxuri orientate pe proprietate și acțiuni contextuale.

## Corecturi față de auditul anterior

- Valorile numerice sunt trimise ca text de UI, dar adaptorul are `coerceForSchema` înainte de apelul providerului. Nu este corect să atribuim automat eșecul curent numerelor. Variantele complexe de schemă și validarea condițională necesită teste dedicate.
- Folosirea CAMPAIGN_UPDATE/ADGROUP_UPDATE pentru schimbarea bugetului este intenționată în `effectiveCapability`. Problema este formularul generic și validarea intenției, nu simpla reutilizare a endpointului.
- Absența publicării în contul real este demonstrată de starea UI observată; cauza exactă din catalog/grant/deployment rămâne de verificat.

## Produs propus

Un singur workspace TikTok cu patru secțiuni: Prezentare, Reclame, Videoclipuri, Conturi. Contul publicitar este selector persistent. Acțiunile principale sunt Creează videoclip și Creează reclamă. Detaliile tehnice apar în Setări/Diagnostic.

- **Prezentare:** cheltuieli și rezultate pe perioadă, monedă, data ultimei sincronizări, reclame în review/respinse, drafturi de continuat. Metricile indisponibile nu devin zero. Fără însumarea directă a monedelor diferite.
- **Reclame:** listă căutabilă, filtre de proprietate/cont/status, preview, buget, cheltuieli, rezultate. Drill-down păstrează campanie → grupuri → reclame; nu elimină posibilitatea mai multor creative și audiențe. Detalii laterale cu editare, status, respingere, istoric și acțiuni.
- **Videoclipuri:** bibliotecă pe proprietate, materiale sursă, proiecte editabile, versiuni, randări și unde este utilizat fiecare video. Acțiuni distincte: Editează, Descarcă, Folosește în reclamă, Publică pe profil.
- **Conturi:** profil TikTok, advertiser și Business Center distincte, relațiile dintre ele, permisiuni, valabilitate, monedă/fus orar, facturare și pași concreți pentru remediere. Conectat și Pregătit pentru reclame sunt stări diferite.

Creare videoclip: proprietate → fotografii/clipuri și ordine → scenariu editabil verificat contra datelor proprietății → voce/subtitrări/brand → preview → randare. Durată propusă implicit 20–40 secunde pentru reclama scurtă, fără a o confunda cu o limită universală TikTok. Salvare automată și versiuni. După randare, alegere explicită între reclamă plătită și postare organică.

Creare reclamă: proprietate + cont → obiectiv disponibil (trafic/lead-uri/vizualizări, condiționat de cont) → video nou sau postare autorizată → text/CTA/destinație → audiență/buget/program → verificare → draft remote dezactivat → confirmare separată de activare. Obiectivele care cer pixel/formular nu apar ca pregătite până când dependențele există. Ads-only și Spark din postare existentă sunt fluxuri diferite.

Roluri propuse: agenții pot pregăti drafturi locale și video; dreptul de a crea/activa în TikTok este acordat explicit administratorilor sau responsabililor desemnați. Aceasta necesită implementare de permisiuni, nu doar deblocarea butoanelor.

## Validare de acceptanță necesară

1. Reconciliere versiune Desktop/backend și catalog autorizat real.
2. Contract complet pentru upload, campaign, ad group și ad; permisiuni și identificatori confirmați.
3. Randare video nou și verificare playback, voce, subtitrări, aspect, durată și asociere cu proprietatea.
4. Creare campanie/grup/reclamă dezactivate; read-back și confirmare că nu este publicat organic în fluxul ads-only.
5. Teste pentru schimbare cont, reload, timeout, retry, partial failure/recovery și evitare duplicate.
6. Test real separat pentru activare → oprire → repornire, cu un buget autorizat; raportarea și livrarea nu pot fi certificate numai din teste locale.
7. Verificare paginare, rapoarte, lead-uri și atribuirea la proprietatea corectă; test de programare dacă funcția este oferită.

## Verificări executate

- `npm run test:tiktok-ads -- --reporter=dot`: 50 passed, 4 skipped (Firestore emulator); 5 fișiere passed, 1 skipped. Sunt teste locale, nu validare live.
- ESLint pe pagina Ads, schema form, pagina Studio și renderer: zero erori, 7 warnings în Studio; comanda cu `--max-warnings=0` eșuează.
- TypeScript global (`npx tsc --noEmit --incremental false --pretty false`): PASS, exit code 0.
- Nicio modificare de implementare, publicare sau activare financiară în acest audit.

## Surse externe

- MCP: https://ads.tiktok.com/resources/help/article/about-tiktok-for-business-mcp-server?lang=en&redirected=2
- Endpoint oficial de creare: https://github.com/tiktok/tiktok-business-api-sdk/blob/main/js_sdk/docs/AdApi.md
- Ads-only: https://ads-useast2a.tiktok.com/resources/help/article/how-to-turn-on-dont-show-on-tiktok-profile-option-in-tiktok-ads-manager?lang=en
- Permisiuni: https://ads.us.tiktok.com/help/article/about-managing-show-through-ads-only-permission-in-business-center?lang=en
