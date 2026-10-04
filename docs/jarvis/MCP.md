# MCP

MCP este dezactivat implicit. JARVIS_MCP=true și JARVIS_MCP_SERVERS configurează servere server-side cu ID, endpoint HTTPS public port443, agencyIds exact un tenant, tools allowlisted, tokenEnv și timeout<=15 s. Nu se ia niciun URL/token din prompt.

Transport Streamable HTTP, protocol2025-03-26: initialize → notifications/initialized → tools/list → tools/call; session ID și JSON/SSE. Serverul trebuie să declare readOnlyHint=true; inputul este validat local cu subsetul suportat de JSON Schema. Schemele externe cu refs/unions nesuportate sunt refuzate.

Protecții: DNS/IP public verificat și pinning pe conexiune, fără redirects/credentials în URL, SSRF/rebinding, deadline și limită50 KB, decodare Unicode incrementală, secrets excluse. Rezultatul rămâne neîncredere. Scrierile MCP sunt interzise; orice asemenea integrare trebuie să aibă un adaptor intern cu contract/aprobare/ledger.

Nu a fost configurat sau apelat un server MCP real în această rundă. Validarea de configurație/tenant/schema/SSRF este acoperită local. [Specificația](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports).
