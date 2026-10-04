# MEMORY

Memoria persistentă este proprie utilizatorului în agenția autentificată. remember_preference acceptă exclusiv preferred_language, preferred_search_zone, preferred_property_source și preferred_response_style, numai după cerere explicită. Nu copiază dosare, prețuri, scoring sau contacte în memorie.

Fiecare intrare are owner, sursă explicită, importanță, versiune, updatedAt și expirare logică la 180 zile. Citirea filtrează expirarea; forget_preference șterge numai preferința proprie cerută explicit. JARVIS_MEMORY=false dezactivează citirea/salvarea, păstrând posibilitatea de ștergere. Curățarea fizică după TTL nu este un serviciu deja activat în Firestore.

Istoricul conversației și sumarul validat sunt separate de preferințe. Reatribuirea conversațiilor/dosarelor revocă și accesul la răspunsuri istorice, cards, plans și artifacts care le conțin.
