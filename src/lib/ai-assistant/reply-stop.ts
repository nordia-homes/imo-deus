/** A queued follow-up retains its original reply cutoff; never reset it on retries. */
export function assertNoReplySince(conversation: { lastInboundAt?: unknown }, cutoff: unknown) {
  if (cutoff === undefined) return;
  const since = typeof cutoff === 'string' ? Date.parse(cutoff) : NaN;
  const inbound = conversation.lastInboundAt;
  const repliedAt = typeof inbound === 'string' ? Date.parse(inbound) : NaN;
  if (!Number.isFinite(since) || (inbound != null && !Number.isFinite(repliedAt))) throw new Error('Momentul răspunsului nu poate fi verificat. Follow-up oprit.');
  if (Number.isFinite(repliedAt) && repliedAt >= since) throw new Error('Destinatarul a răspuns după activarea follow-upului. Trimiterea a fost oprită.');
}
