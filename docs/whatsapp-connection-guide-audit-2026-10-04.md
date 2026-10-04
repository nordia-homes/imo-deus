# Audit ghid WhatsApp — 2026-10-04

## Revizia pentru agenții
Ghidul are 14 pași principali, cu acțiuni numerotate individual, denumiri de meniuri/butoane în română și engleză, câmpuri explicite și rezultat de verificat. Numărul dedicat și WhatsApp Business App au instrucțiuni separate expandabile. Layoutul existent, alinierea cardurilor, bara de comunicare și ghidul pe toată lățimea sunt păstrate.

## Surse oficiale consultate în browser
- Crearea portofoliului: https://www.facebook.com/business/help/1710077379203657 — selectorul de sub Home, Create a business portfolio, nume, profil, business email, Create și confirmarea e-mailului.
- Fluxul Embedded Signup: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/default-flow — document actualizat 2026-09-03, inclusiv imaginile oficiale pentru selectarea activelor, câmpurile profilului, Verification code / Next, Confirm și verificarea QR.
- Business App: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/ — mesajul oficial Facebook Business, Connect, Connect to the Business Platform, Confirm, Share chats / Don't share chats, Enter Access code / Scan QR code instead și Settings → Account → Business Platform.
- Verificarea firmei: https://www.facebook.com/business/help/2058515294227817 — Security Center, Start verification, date legale, identificarea firmei, documente, metoda de confirmare și Done; numai dacă este disponibilă/solicitată.
- Facturare: https://www.facebook.com/business/help/488291839463771 — Settings → Billing & payments → Messaging accounts → Add payment method / View details → Next → card → Save → datele firmei → Save; vizualizarea cardului în Settings.
- Politica: https://business.whatsapp.com/policy — acord, oprirea mesajelor, șabloane aprobate și intervalul de 24 de ore.

Ordinea nouă Phone Number First este în curs de introducere de Meta. Ghidul indică explicit revenirea între pașii 6–7 în funcție de titlul ecranului. Varianta anterioară a setărilor de plată este descrisă separat. Nu se pretinde că a fost parcursă o conectare într-un portofoliu autentic de client.

## Confruntare cu CRM
Verificate MarketingWorkspace, WhatsAppStudio, WhatsAppTemplates, InboxWorkspace, meta, outbound și whatsapp-config:
- Cele două clickuri pentru lansarea Meta; PIN-ul dedicat are exact șase cifre și este separat de codul Meta.
- Actualizează recitește conexiunile salvate; moneda se recitește la reautorizare, fără deconectare de rutină.
- Bugetul este pentru luna curentă; monedele oferite sunt EUR/RON/USD.
- Numele șablonului, limba, categoria, mesajul, aprobarea și parametrii sunt descriși după formularul real.
- Prima conversație pornește inbound; răspunsul și șablonul sunt verificate înainte de trimitere.
- Acordul se înregistrează în Inbox desktop de administrator, cu scop, dovadă și minimum zece caractere.
- Inițierea pentru un contact existent folosește ID contact CRM și selectorul numărului.
- Nu se promite import de istoric Business App, aprobare automată sau disponibilitate fără verificările de trimitere.

## Prezentare publică
Eliminate prop-ul pilot și toate etichetele de pilot/mod test din Studio, ghid și formular. Ilustrația și confirmarea conectării au text orientat către agenții. Erorile de indisponibilitate afișate de backend au formulare neutră.
Condițiile backend privind aprobarea Meta, facturarea, utilizatorii și destinatarii autorizați nu sunt modificate; nicio setare de activare generală nu este schimbată.

## Validare
- TypeScript communications: PASS.
- ESLint pe ghid, conținut, Studio și modulele backend schimbate: PASS, fără avertismente.
- MarketingWorkspace are două avertismente preexistente react-hooks/set-state-in-effect la liniile neatinse 38 și 47; schimbarea nu introduce avertismente.
- Testele existente whatsapp-signup și whatsapp-security: 38/38 PASS.
- Chromium la 1920, 1440, 1100 și 390 px: fără overflow, 14 pași, ancore valide, ambele variante expandabile și ajutor funcțional.
- Desktop: bazele cardurilor sunt aliniate cu diferență 0 px; bara și ghidul au lățimea overview.
- Stare administrator și stare fără numere/fără rol admin: fără etichete de pilot/mod test/demo.
- Nu au fost trimise mesaje clienților și nu au fost modificate setări într-un cont Meta pentru audit.
