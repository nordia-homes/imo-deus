# PROPERTY MATCHING

Property Matching = existing ImoDeus algorithm din src/lib/matching-engine.ts. AI Property Matching = forbidden. Matching score recalculation by LLM = forbidden.

match_contact citește contactul autorizat și proprietățile active și apelează getDeterministicMatchedProperties. match_property apelează getDeterministicMatchedBuyers. Nu există un al doilea scoring semantic/LLM. Ordinea, scorurile și reasoning sunt cele ale motorului ImoDeus.

Setul contextual este salvat server-side pentru propriul actor, TTL logic o oră. Follow-up-ul folosește filter_existing_matches; datele curente ale proprietății sunt recitite pentru existență/status/preț/zonă, dar scorurile nu se recalculează. Ordinea ImoDeus rămâne implicită; sortare numerică score/price numai când agentul o cere. Setul este cel returnat anterior, nu întregul portofoliu dacă limita inițială a fost 30.

Testele adapterului compară efectiv rezultatele cu motorul real, nu cu un scoring mock. Smoke-ul existent: 26 zone services + 2 canonical location. Adaptorul adaugă 4 verificări, inclusiv filtrare fără schimbarea scorurilor și refuzul clientului inaccesibil.
