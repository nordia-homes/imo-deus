# Audit ghid WhatsApp și layout — 2026-10-04

## Domeniu și dovezi
Auditul acoperă toate instrucțiunile din ghidul afișat clienților, confruntate cu MarketingWorkspace, WhatsAppStudio, WhatsAppTemplates, InboxWorkspace, whatsapp-config, meta, outbound, model și ruta communications. Nu este un audit complet al integrării backend.
Ghidul a fost rescris pentru administratorul unei agenții care pornește de la zero; responsabilitățile agentului și administratorului sunt explicite.

## Probleme găsite și corectate
| Lipsă / ambiguitate | Corecție |
| --- | --- |
| Pregătire vagă | Datele firmei, e-mail, două telefoane, conturi și roluri separate |
| Portofoliu presupus existent | Selectare/creare, confirmare e-mail când este cerută, evitarea duplicatelor |
| Confuzie pagină/portofoliu/cont WhatsApp | Definiții în context, control deplin și acces la active |
| Număr dedicat vs Business App amestecate | Alegere înainte de CRM; instrucțiuni separate la verificare; caz personal/alt furnizor |
| Un singur click presupus pentru Meta | Cele două butoane exacte din CRM și remediere pop-up |
| PIN confundabil cu cod SMS | Scopuri separate, șase cifre, numai pentru varianta dedicată |
| Plata și verificarea firmei într-un singur pas | Pași separați, cont WhatsApp vs cont reclame, acces financiar |
| Actualizează sugerat ca remediere universală | Reîncarcă datele CRM; moneda se verifică la autorizare/reconectare |
| Buget fără monedă/lună | Moneda contului, luna curentă, plafon zero, monedă nesuportată |
| Șabloane fără câmpuri/exemplu | Selector cont, nume, limbă, categorie, text, exemplu condiționat, stări |
| Test fără acces conversație | Administrator vs agent cu atribuire; destinatar pilot |
| Acord menționat dar fără procedură | Inbox desktop → Detalii client → Consimțământ WhatsApp → scop, dovadă, Înregistrează |
| Trimitere fără verificări | Mesaj liber în 24h, șablon, parametri, Verifică trimiterea, confirmare pe telefon |
| Probleme comune incomplete | Opt cazuri: acces, popup, active, SMS, eligibilitate, monedă, recepție, trimitere |

## Limite identificate în implementare
- Producția configurată în repository folosește WHATSAPP_ONBOARDING_MODE=test; accesul depinde de autorizarea utilizatorului și destinatarului. Publicarea paginii nu activează disponibilitatea generală.
- Înregistrarea consimțământului există în panoul desktop pentru admin; varianta mobilă a detaliilor nu include acel formular. Ghidul indică desktopul și administratorul.
- Formularul de plafon permite EUR/RON/USD. Ghidul cere suport pentru altă monedă.
- Dashboardul citește conexiunile salvate, nu metadatele live de facturare Meta. Reautorizarea aceluiași număr recitește moneda.
- Șabloanele create în acest editor au corp text fără variabile/atașamente; testul propus respectă această limită.
- UI solicită ID contact CRM pentru inițiere, nu are selector de contacte în acel formular. Ghidul folosește testul inbound pentru prima conversație și descrie separat formularul real de inițiere.
- „Trimitere mesaje: Activ” nu garantează o trimitere: tarif, acord, fereastră, buget, pilot și aprobare sunt reverificate.
- Nu se promite import complet de istoric Coexistence, tarif gratuit, aprobare automată sau durată fixă.

## Verificarea surselor Meta
Politica oficială accesibilă: https://business.whatsapp.com/policy (redirecționează la https://whatsappbusiness.com/policy/), consultată la 2026-10-04. Confirmă acordul, oprirea comunicării, șabloanele aprobate și fereastra de 24h.
Paginile Meta Embedded Signup și onboarding-business-app-users au răspuns 429/inaccesibil; paginile business-help despre portofoliu și plăți au cerut autentificare. Nu se pretinde validare vizuală într-un cont Meta live. Rutele meniurilor sunt orientative după funcție, cu denumiri română/engleză și alternative; ordinea ecranelor, eligibilitatea și cerințele finale se citesc din ecranul Meta al clientului.
Nu au fost folosite instrucțiunile pentru QR WhatsApp Web ca substitut pentru onboardingul Business App.

## Layout
Rândul superior conține numerele și acțiunile rapide, cu baza cardurilor aliniată pe desktop. Bara statică de comunicare urmează pe lățimea întregului conținut, apoi ghidul. Ghidul are patru etape navigabile și 14 pași cu acțiuni și rezultat verificabil. Layoutul devine vertical pe ecrane mici.


## Validare locală
- TypeScript pentru modulul communications: PASS.
- ESLint pe cele două componente schimbate: PASS.
- Randare a componentelor reale cu date demonstrative, apoi verificare în Chromium la 1920, 1440, 1100 și 390 px: fără overflow orizontal, 14 pași, ancore valide și ajutor expandabil.
- La 1920 și 1440 px, diferența dintre bazele cardului numărului și cardului de acțiuni: 0 px. Bara și ghidul au exact lățimea conținutului overview.
- Starea fără numere, fără rol admin și cu pilot afișează explicațiile de acces și ghidul, fără butonul de conectare rezervat administratorului.
- Nu a fost efectuată o nouă conectare Meta și nu au fost trimise mesaje către clienți pentru acest audit.
