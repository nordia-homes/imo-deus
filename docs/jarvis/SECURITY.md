# SECURITY

Tenantul/actorul/rolul provin din Firebase authentication. Modelul nu poate trimite agencyId sau credentiale în contractele toolurilor. Serverul recitește membership înainte de tools, fiecare pas de execuție și salvarea răspunsului; dosarele, conversațiile și auditul au regulile proprii.

Approval = hash al payloadului canonic + actor + tenant + plan + expirare + versiune policy. Confirmarea claimului este tranzacțională, o singură dată. Ledger-ele fac replay-ul pașilor confirmați fără mutații noi; rezultatul extern unknown blochează retry automat și cere inspecție în domeniu. Rezultatele parțiale reale sunt păstrate în ledger și stoppedStep și pot fi inspectate în UI, inclusiv atunci când handlerul răspunde HTTP 200 cu stare failed/partial/unknown.

AsyncLocalStorage păstrează numai principalul unei cereri interne și bugetul acesteia; un header fals venit din HTTP nu activează principalul. Handler-ele reale își păstrează verificările admin/cost/eligibilitate. Secretele sunt eliminate din date/cards; telemetry conține IDs tehnice/hash, nu nume/telefoane/prompts/payloaduri.

Regulile Firestore root și src interzic clientului citirea/scrierea în colecțiile private Jarvis, inclusiv utilizatorilor admin; acces numai prin API autentificat. Regulile nu înlocuiesc autorizarea Admin SDK: aceasta este implementată în cod și testată separat.

Autonomia este opt-in UI, expiră la30 zile, maximum4 pași low risk, și necesită verb de acțiune explicit în cererea umană. Cererile de preview/analiză și comenzile negate nu produc efecte autonome. Consimțământul WhatsApp se poate consemna doar prin UI explicit cu evidența apelului; modelul nu îl acordă.
