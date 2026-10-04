# COSTS

Tarife Standard USD/1M tokens, versiunea openai-standard-2026-10-04: Luna input 0,10, cached input 0,01, cache write 0,125, output 0,50; Sol input 2,00, cached input 0,10, cache write 2,50, output 10,00. [Pricing](https://developers.openai.com/api/docs/pricing), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [Responses tools](https://developers.openai.com/api/docs/guides/function-calling).

Formula separă input necacheat, cached_tokens, cache_write_tokens și output. Cache writes înlocuiesc inputul necacheat corespunzător, nu se taxează de două ori. Usage indisponibil înseamnă estimare conservatoare în bytes UTF-8 + limita output, niciodată zero. JARVIS_MODEL_PRICING permite tarife configurabile cu versiune; JARVIS_REGIONAL_PROCESSING=true aplică +10%.

Prefixul policy/tools/skills este stabil, iar contextul dinamic este la final. prompt_cache_key este hash agency+user+promptVersion, cache implicit TTL 30m. Tokens cacheați se măsoară din usage; nu se presupune cache hit. Apelurile text din domeniu împart bugetul parent când sunt citiri în loop; execuțiile separate au buget auxiliar de maximum 0,02 USD/apel.

Telemetria auxiliară are sessionId=domain_ai, nu mărește task-success sau Luna-solved. Raportul include costul auxiliar separat și în totalul perioadei. Average cost per task este costul perioadei împărțit la turns observate, nu o factură contractuală și nici atribuirea exactă a fiecărei operații externe.

WhatsApp, reclame, voce, video, OCR și portaluri au costuri externe distincte; o valoare indisponibilă nu înseamnă gratuit. Previzualizarea canalului și bugetele campaniei rămân obligatorii.
