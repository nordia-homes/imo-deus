# OLX Prospecting Browser Cloud

Sistemul foloseste un `Browserbase Context` separat pentru fiecare combinatie agentie/agent.
Continutul profilului cloud (cookie-uri, local storage si sesiune OLX) ramane la
furnizor. ImoDeus stocheaza server-side doar identificatorul Context-ului.

## Configurare

Variabile runtime obligatorii:

- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `BROWSERBASE_EXTENSION_ID`

Variabile optionale:

- `BROWSERBASE_REGION` (implicit `eu-central-1`)
- `BROWSERBASE_PROXY_COUNTRY` (implicit `RO`)
- `BROWSERBASE_USE_PROXY` (implicit in cod `true`; in productie este `false` pe planul Free)

Extensia se incarca in Browserbase astfel:

```powershell
$env:BROWSERBASE_API_KEY="<cheie>"
.\scripts\upload-browserbase-olx-extension.ps1
```

Identificatorul returnat se salveaza ca `BROWSERBASE_EXTENSION_ID`.

In Firebase App Hosting, valorile se creeaza in Secret Manager fara a fi
scrise in repository:

```powershell
.\node_modules\.bin\firebase.cmd apphosting:secrets:set BROWSERBASE_API_KEY --project studio-652232171-42fb6
.\node_modules\.bin\firebase.cmd apphosting:secrets:set BROWSERBASE_PROJECT_ID --project studio-652232171-42fb6
.\node_modules\.bin\firebase.cmd apphosting:secrets:set BROWSERBASE_EXTENSION_ID --project studio-652232171-42fb6
```

`apphosting.yaml` le expune numai la runtime. Regiunea este `eu-central-1`.
Planul Browserbase Free nu include proxy, deci productia ruleaza cu
`BROWSERBASE_USE_PROXY=false`. Dupa activarea unui plan care include proxy,
valoarea poate fi schimbata la `true` pentru geolocalizare in Romania.

## Flux

1. Agentul apasa `Conecteaza contul OLX`.
2. API-ul creeaza/reutilizeaza Context-ul agentului si deschide o sesiune Live View.
3. Agentul se autentifica direct pe OLX si confirma.
4. Anunturile adaugate in `Prospectare` creeaza joburi in
   `ownerListingOlxPhoneQueue`, lane `prospecting`.
5. Scheduler-ul existent proceseaza secvential joburile.
6. Workerul deschide o sesiune Browserbase cu Context-ul agentului si extensia
   ImoDeus, extrage telefonul si actualizeaza anuntul si intrarea din Prospectare.

Joburile care nu apartin unui anunt activ din Prospectare sunt anulate.
Un lease distribuit per agent impiedica folosirea simultana a aceluiasi profil
de catre scheduler si o cerere manuala. Scheduler-ul ruleaza cu concurenta 1,
iar esecurile temporare sunt reincercate cu backoff.

## Limite de securitate

- Parola OLX este introdusa direct in Live View si nu ajunge in ImoDeus.
- Cookie-urile si starea profilului raman in Context-ul Browserbase dedicat agentului.
- Extensia nu are popup, nu are interfata si nu transmite date catre un serviciu tert.
- Extensia raspunde numai unei cereri din pagina OLX deschisa de worker.
- Deconectarea sterge Context-ul persistent al agentului.
- Sistemul nu rezolva automat CAPTCHA si nu incearca sa ocoleasca verificarile OLX.
