# Imodeus inbound email Worker

Cloudflare Email Worker pentru mesajele trimise catre aliasurile individuale
`inbox+<token>@reply.imodeus.ro`. Worker-ul parseaza MIME, elimina resursele inline,
aplica limitele de securitate si livreaza payload-ul catre endpoint-ul inbound Imodeus.

Secretul `IMODEUS_INBOUND_SECRET` se configureaza exclusiv ca Worker secret si trebuie
sa fie identic cu `EMAIL_INBOUND_WEBHOOK_SECRET` din Firebase Secret Manager.

Comenzi locale:

```sh
npm test
npm run check
npm run deploy
```

## Configuratie de productie

- Domeniul principal `imodeus.ro` ramane pe MX-urile Google Workspace.
- Cloudflare Email Routing este activ numai pentru `reply.imodeus.ro`.
- Plus-addressing este activ, iar regula literala pentru
  `inbox@reply.imodeus.ro` trimite mesajele catre Worker.
- Catch-all ramane dezactivat.
- Worker-ul nu are ruta HTTP publica si foloseste secretul criptat
  `IMODEUS_INBOUND_SECRET`.

## Verificari inainte de activarea rutei

1. `npm ci`, `npm test` si `npm run check` trebuie sa reuseasca.
2. Secretul Worker trebuie sa fie identic cu versiunea folosita de rollout-ul
   App Hosting pentru `EMAIL_INBOUND_WEBHOOK_SECRET`.
3. O cerere fara secret catre endpoint trebuie sa raspunda cu `401`.
4. O cerere autentificata pentru un alias fictiv valid trebuie sa raspunda cu
   `404`, confirmand ca autentificarea a trecut si aliasul a fost verificat.
5. DNS-ul public trebuie sa arate cinci MX-uri Google pentru `imodeus.ro` si
   trei MX-uri Cloudflare pentru `reply.imodeus.ro`.

In cazul unei rotatii de secret, regula Email Routing se dezactiveaza temporar,
se publica noul rollout App Hosting, se actualizeaza secretul Worker, se repeta
probele `401/404`, apoi regula se reactiveaza.
