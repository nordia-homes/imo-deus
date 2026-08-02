# Sistemul de notificari

## Domeniu functional

Sistemul emite doar urmatoarele categorii:

- mesaj Storia nou;
- vizionare atribuita sau realocata;
- vizionare reprogramata;
- sumarul vizionarilor de maine la 21:00 `Europe/Bucharest` si reminderul cu doua ore inainte;
- task atribuit si modificarea campurilor relevante ale taskului;
- publicare automata/programata pe grupuri Facebook finalizata sau oprita de o eroare;
- proprietate atribuita sau realocata;
- feedback si comentarii din portalul cumparatorului.

Nu exista notificare pentru task restant. Schimbarea statusului unui task si stergerea lui nu emit notificari.

## Arhitectura

- Trigger-ele Firestore scriu evenimente idempotente in `notificationEvents`.
- Procesorul creeaza inboxul durabil in `users/{uid}/notifications` si joburile push in `notificationDeliveryJobs`.
- `notificationSchedules` pastreaza reminderele de vizionare. Un scheduler la minut recupereaza joburile esuate sau ramase cu lease expirat.
- Push-ul este un canal secundar; documentul din inbox este sursa de adevar.
- Preferintele sunt in `users/{uid}/notificationPreferences/default`, iar dispozitivele web in `messagingRegistrations`.
- Cozile interne sunt server-only prin Firestore Rules si au TTL pe `expiresAt`.

Evenimentele, notificarile si livrarile au ID-uri deterministe. Retry-ul unei functii nu creeaza duplicate. Tokenurile invalide sunt dezactivate automat, iar tokenurile din vechiul camp `users.pushTokens` sunt migrate la prima reinregistrare.

## Feedback din portal

Portalul nu mai scrie direct in Firestore. Endpointul
`POST /api/client-portal/{portalId}/feedback` valideaza portalul si recomandarea, actualizeaza recomandarea si istoricul contactului intr-o singura tranzactie si creeaza evenimentul de notificare in aceeasi tranzactie. Cererile au cheie idempotenta si rate limit.

## Operare si deploy

Aplicatia web trebuie sa aiba `NEXT_PUBLIC_FIREBASE_VAPID_KEY`. Functions foloseste `APP_BASE_URL` pentru linkurile absolute din push; daca lipseste, valoarea implicita este `https://imodeus.ro`.

Ordinea recomandata de deploy:

1. `firebase deploy --only firestore:rules,firestore:indexes`
2. `npm --prefix functions run build`
3. `firebase deploy --only functions`
4. deploy-ul aplicatiei Next/Electron

Pentru diagnostic se verifica `notificationEvents`, `notificationSchedules` si `notificationDeliveryJobs`. Starile terminale sanatoase sunt `completed`, `fired` si `provider_accepted`; `provider_accepted` confirma acceptarea de catre FCM, nu afisarea pe dispozitiv.
