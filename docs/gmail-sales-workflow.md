# Gmail și Gestionare vânzări

## Ce face implementarea

- Creează un dosar de tranzacție pentru proprietățile rezervate sau vândute.
- Separă vizibilitatea în interfață: agentul vede dosarele lui, administratorul întreaga agenție.
- Păstrează participanții, checklist-ul de acte, întrebările, programarea la notar, următoarea acțiune și istoricul emailurilor.
- Pregătește Gmail fără OAuth. În Imodeus Desktop, Local Runner completează destinatarii, subiectul, corpul și atașamentele, apoi se oprește înainte de trimitere.
- În browser, deschide Gmail cu destinatarul, subiectul și corpul completate; atașamentele se adaugă manual.
- Detectează reply-urile și documentele prin forwarding Gmail către un alias unic al agentului.

Imodeus nu apasă automat butonul Trimite, nu rulează campanii bulk și nu cere parola Gmail.

## Configurarea infrastructurii inbound

Sunt necesare două variabile de mediu:

```text
EMAIL_INBOUND_DOMAIN=reply.imodeus.ro
EMAIL_INBOUND_WEBHOOK_SECRET=<secret lung și aleator>
```

Subdomeniul `reply.imodeus.ro` trebuie conectat la un serviciu care primește email și poate apela un webhook HTTP cu JSON sau `multipart/form-data` (de exemplu Mailgun Routes, SendGrid Inbound Parse ori un worker email echivalent).

Webhook:

```text
POST https://<domeniu-imodeus>/api/email/inbound
X-Imodeus-Inbound-Secret: <EMAIL_INBOUND_WEBHOOK_SECRET>
```

Câmpurile acceptate sunt `recipient/to`, `sender/from`, `subject`, `body-plain/text`, `body-html/html`, `Message-Id/messageId` și fișiere multipart. Pentru JSON, atașamentele folosesc `{ name, type, base64 }`.

Limite implicite: maximum 12 fișiere, 15 MB per fișier și 25 MB cumulat per mesaj.

## Configurarea unui agent

1. Agentul deschide un dosar în Gestionare vânzări → Răspunsuri și apasă „Creează adresa de răspuns”.
2. Copiază aliasul generat, de forma `inbox+<token>@reply.imodeus.ro`.
3. În Gmail deschide Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address.
4. Adaugă aliasul. Imodeus detectează emailul de verificare și afișează codul în aceeași zonă.
5. În Gmail creează un filtru pentru expresia `IMD-V` și selectează „Forward it to” către alias.

Filtrul redirecționează numai conversațiile de tranzacție, deoarece fiecare subiect pregătit de Imodeus conține un cod de forma `[IMD-VXXXXXXX]`.

## Migrarea proprietăților existente

Comanda este dry-run implicit:

```text
npm run backfill:sales
npm run backfill:sales -- --agency <agencyId>
```

Scrierea efectivă se face explicit:

```text
npm run backfill:sales -- --write
```

Scriptul nu suprascrie dosare existente.

## Livrare și spam

Emailul outbound este trimis din interfața Gmail și din contul agentului, la fel ca un mesaj scris manual. Implementarea nu schimbă expeditorul, nu folosește SMTP comun și nu adaugă tracking pixels. Astfel, reputația și autentificarea Gmail rămân cele ale contului agentului. Forwardingul este folosit numai pentru copii inbound și nu influențează livrarea mesajului către client.

Pentru o experiență nederanjantă, reminderele din dosar sunt interne și nu trimit automat mesaje. Agentul vede întotdeauna textul final și decide când îl trimite.

## Operare și verificare

Variabile suplimentare opționale:

- `SALES_DOCUMENT_SCAN_URL` și `SALES_DOCUMENT_SCAN_TOKEN` pentru verdict antivirus extern;
- `SALES_DOCUMENT_OCR_ENABLED=true` pentru activare OCR implicită;
- `SALES_E2E_BASE_URL` și `SALES_E2E_STORAGE_STATE` pentru smoke testul browser autentificat.

Comenzi de verificare:

```text
npm run test:sales-email
npm run test:sales-e2e
npm --prefix functions run build
```

Nu activa `malwareScanRequired` până când scannerul extern răspunde cu un verdict compatibil `{ safe: true }`; altfel fișierele sunt blocate intenționat. OCR rămâne opt-in deoarece documentele pot conține date personale. Joburile programate livrează un digest la 08:00 și aplică retenția la 03:30, ora Europe/Bucharest.
