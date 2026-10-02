# WhatsApp signup: missing billing currency

The live pilot reached the application's currency validation after Meta authorization and failed before phone registration and connection persistence. The observed error does not establish why Meta omitted or returned an unexpected currency.

The fix separates WABA identity validation (still mandatory) from billing metadata availability. Missing, null, empty or malformed currency does not abort signup. No currency default is assigned. The connection is stored without a currency and with send capability `configuration_required`; the existing outbound currency/rate gates remain unchanged. Inbound/media and template access remain available subject to their existing checks. After billing metadata is available, reconnecting the same number revalidates it and updates the same connection.

Regression coverage exercises pending phone registration without currency, blocked send access, permitted media access, wrong WABA rejection, and verified currency persistence. This does not establish live Meta billing readiness, approval, or successful message delivery.

Deployment status: local correction; production publication must be confirmed separately.
