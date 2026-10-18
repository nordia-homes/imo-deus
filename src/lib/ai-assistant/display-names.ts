/** Presentation only: identifiers stay in contracts and access checks. */
export function displayReference(id: string, resolveName: (id: string) => string) {
  if (id.startsWith('@step:')) return 'Creat într-un pas anterior';
  const label = resolveName(id)?.trim();
  return label && label !== id ? label : 'Denumire indisponibilă';
}
export function isInternalDisplayField(key: string) {
  return /(?:Revision|Hash|Token)$/.test(key) || /^(?:idempotencyKey|requestId|executionId|approvalId|evidenceCallIds)$/.test(key);
}
