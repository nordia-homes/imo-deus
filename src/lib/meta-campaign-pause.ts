export type MetaPauseObservation = { id: string; accountId: string; status: string; effectiveStatus: string };

function observation(value: unknown, campaignId: string, accountId: string): MetaPauseObservation {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  if (row.id !== campaignId || row.account_id !== accountId.replace(/^act_/, '') ||
      typeof row.status !== 'string' || typeof row.effective_status !== 'string') {
    throw new Error('Meta nu a confirmat identitatea și starea campaniei din contul selectat.');
  }
  return { id: campaignId, accountId: String(row.account_id), status: row.status, effectiveStatus: row.effective_status };
}

/** A POST acknowledgement is not proof of a pause. Always read back the same campaign. */
export async function verifyMetaCampaignPause(options: {
  campaignId: string;
  accountId: string;
  assertCurrent: () => Promise<void>;
  read: () => Promise<unknown>;
  pause: () => Promise<unknown>;
}): Promise<MetaPauseObservation> {
  if (!/^\d+$/.test(options.campaignId) || !/^(act_)?\d+$/.test(options.accountId)) {
    throw new Error('Identificatorul campaniei sau contului Meta lipsește ori este invalid.');
  }
  await options.assertCurrent();
  const before = observation(await options.read(), options.campaignId, options.accountId);
  if (!['ACTIVE', 'PAUSED'].includes(before.status)) {
    throw new Error('Campania Meta nu poate fi pusă în pauză din starea curentă.');
  }
  if (before.status === 'PAUSED' && before.effectiveStatus === 'PAUSED') {
    await options.assertCurrent();
    return before;
  }
  await options.assertCurrent();
  // A lost response can still mean that Meta applied the pause. Reconcile with a GET,
  // never retry the write or infer failure/success from the response alone.
  try { await options.pause(); } catch { /* The readback below resolves ambiguous transport outcomes. */ }
  let after: MetaPauseObservation;
  try {
    after = observation(await options.read(), options.campaignId, options.accountId);
  } catch {
    throw new Error('Rezultatul pauzei la Meta este neclar. Verifică starea înainte de o nouă comandă.');
  }
  if (after.status !== 'PAUSED' || after.effectiveStatus !== 'PAUSED') {
    throw new Error('Meta nu a confirmat încă pauza campaniei. Nu raportez oprirea ca finalizată.');
  }
  await options.assertCurrent();
  return after;
}
