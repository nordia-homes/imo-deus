import { z } from 'zod';
import { isDeepStrictEqual } from 'node:util';

const outputsSchema = z.object({
  assetId: z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/).optional(),
  videoUrl: z.string().url().max(8000).refine(value => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch { return false; }
  }).optional(),
}).strict();
export type VerifiedOutputs = z.infer<typeof outputsSchema>;

// Apply exactly the same URL contract when observing and later binding output.
export function validatedVideoUrl(value: unknown): string | undefined {
  const parsed = outputsSchema.safeParse({ videoUrl: value });
  return parsed.success ? parsed.data.videoUrl : undefined;
}

// These values are produced by authorized domain verifiers, never model output.
// Keep them separate from the immutable provider receipt and bind once per plan.
export function bindVerifiedOutputs(results: Record<string, unknown>[], rows: { step: number; completionSatisfied?: boolean; outputs?: unknown }[]) {
  return results.map((step, index) => {
    const candidates = rows.filter(row => row.step === index + 1);
    const evidence = candidates.find(row => row.completionSatisfied === true && row.outputs != null);
    if (!evidence?.outputs) return step;
    if (step.step !== undefined && step.step !== index + 1) throw new Error('Dovezile media nu corespund pasului salvat. Planul necesită reconciliere.');
    const outputs = outputsSchema.parse(evidence.outputs);
    // Duplicate observations are harmless only when they agree on completion
    // and on the full validated output. Never pick the first favorable row.
    for (const candidate of candidates) {
      if (candidate.completionSatisfied !== true || !isDeepStrictEqual(outputsSchema.parse(candidate.outputs ?? {}), outputs)) throw new Error('Dovezi media contradictorii pentru același pas. Planul necesită reconciliere.');
    }
    if (!Object.keys(outputs).length) return step;
    const previous = outputsSchema.parse(step.outputs || {});
    for (const key of Object.keys(previous) as (keyof VerifiedOutputs)[]) {
      if (outputs[key] !== previous[key]) throw new Error('Materialul verificat s-a schimbat. Continuarea necesită un plan nou.');
    }
    return { ...step, outputs: { ...previous, ...outputs } };
  });
}

export function verifiedOutput(step: Record<string, unknown> | undefined, field: keyof VerifiedOutputs) {
  return outputsSchema.parse(step?.outputs || {})[field];
}

// Recovery rebuilds receipts from the execution ledger. Keep already verified
// media only when the exact same step and immutable receipt were recovered.
export function restoreVerifiedOutputs(recovered: Record<string, unknown>[], previous: Record<string, unknown>[]) {
  const bindings = previous.filter(step => step.outputs != null);
  for (const prior of bindings) {
    const matches = recovered.filter(step => step.step === prior.step && step.kind === prior.kind && isDeepStrictEqual(step.result, prior.result));
    if (matches.length !== 1 || bindings.filter(step => step.step === prior.step).length !== 1) throw new Error('Dovezile media nu corespund istoricului recuperat. Planul necesită reconciliere.');
  }
  return recovered.map(step => {
    const prior = bindings.find(previous => previous.step === step.step);
    return prior ? { ...step, outputs: outputsSchema.parse(prior.outputs) } : step;
  });
}
