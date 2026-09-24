# Audit și redesign — prezentarea proprietății

24 septembrie 2026. Domeniu: șablon HTML, export A4 și PDF-ul final al proprietății.

## Constatări și corecții

| Problemă în versiunea precedentă | Corecție implementată |
| --- | --- |
| Etichete de 6–8 px și informații importante greu de citit | Etichete 11–12 px, adresă și vecinătăți 12 px, contact 12–20 px; 10 px doar pentru note și subsol |
| Amestec de serif, sans-serif și scris de mână | O singură familie Manrope, încorporată în document, cu greutăți distincte pentru titluri și valori |
| Text auriu prea slab pe crem | Text principal #252a26, secundar #50564f; auriu mai închis #735329 pentru accente |
| „Confort & detalii” aglomera prima pagină | Secțiunea și grila ei au fost eliminate; nu a fost adăugată o pagină nouă cu aceste informații |
| Trei cadre provenite din aceeași fotografie | Eliminarea reutilizării aceleiași fotografii pentru galerie; șablonul utilizează următoarele trei URL-uri distincte, iar exemplarul final conține fotografii separate ale bucătăriei, dormitorului și băii |
| QR absent în exemplarul demo și dependent de o imagine externă | QR vectorial generat local, încorporat în HTML/PDF, cu zonă liberă de patru module și corecție M; dimensiune 31 × 31 mm |
| Fonturi dependente de sistemul pe care este generat PDF-ul | Font Manrope distribuit cu licența OFL și încorporat ca date în șablon |
| Exportul putea continua înainte de încărcarea imaginilor/fonturilor | Așteptare explicită pentru `document.fonts.ready` și decodarea imaginilor înainte de export |
| Galerie suplimentară și texte lungi puteau produce pagini goale sau suprapuneri | Grile cu dimensiuni explicite, verificare automată a limitelor A4, a suprapunerilor și a numărului de pagini |

## Noua compoziție

Prima pagină păstrează fotografia amplă, curba crem și conturul auriu. Informațiile sunt ordonate în cinci zone: identitate și ofertă; specificații esențiale; fotografii distincte; apropiere și acces online; contact pentru vizionare. Au fost eliminate sloganurile decorative și scrisul cursiv pentru a rezerva spațiu datelor utile.

QR-ul și textul „Deschide online” sunt și linkuri apăsabile în PDF. Dacă nu există un URL public valid, șablonul nu inventează un QR sau o destinație. Dacă proprietatea nu are fotografii suplimentare, nu repetă imaginea principală pentru a completa galeria.

Contrastul măsurat pentru textul principal pe fundalul crem este 13,65:1; pentru textul secundar, 7,05:1. Nu se folosesc transparențe în degradeuri sau umbre care au produs artefacte la randarea PDF.

## Verificări

- TypeScript și ESLint pentru fișierele modificate.
- Patru teste persistente: decodarea QR-ului vectorial cu un decodor independent, deduplicarea fotografiilor, păstrarea fotografiilor pe paginile suplimentare și tratarea datelor lipsă fără informații inventate.
- Nouă scenarii de randare A4: date lipsă, texte lungi, închiriere, imagini duplicate și galerii cu 2, 3, 4, 5 și 7 fotografii.
- Verificarea linkului din QR după rasterizarea PDF-ului exportat la 144 dpi, separat de verificarea SVG-ului.

## Exemplarul final verificat

Datele și cele opt fotografii reale au fost recuperate din portofoliul public Nordia pentru proprietatea de pe Strada Ion Conea 12–14. Cele opt fișiere au amprente SHA-256 distincte. Documentul final are trei pagini A4: coperta cu livingul și trei fotografii distincte, urmată de galeria cu celelalte patru fotografii. Fotografii alternative nu au fost inventate sau generate.

QR-ul din PDF-ul final, rasterizat la 144 dpi, a fost decodat cu succes către https://nordia.ro/properties/0m28BP8YDRXj0RD2wFR7. Pagina publică a răspuns HTTP 200. Linkul este încorporat și ca adnotare apăsabilă în PDF.

Suprafața afișată este cea utilă din datele proprietății, 73 m²; cei 79 m² reprezintă suprafața construită. Prețul este 134.800 €. Nu este afișat un comision inventat. Vecinătățile și datele de contact au fost păstrate din exemplarul anterior; timpii de mers pe jos sunt marcați ca estimări și nu au fost recalculați în acest audit.

Verificarea automată a celor trei pagini nu a identificat depășiri ale paginii sau suprapuneri cu zona de contact. Fontul Manrope s-a încărcat, iar textul și diacriticele pot fi extrase din PDF. Randarea finală a fost inspectată vizual. Etichetele automate lungi ale imaginilor sunt înlocuite în șablon cu numere de fotografie; descrierile utile sunt păstrate.

Fișier livrabil: `tmp/prezentare-proprietate-finala.pdf`. Modificările sunt implementate în șablonul local și ruta de export; nu a fost efectuată o publicare în producție.
