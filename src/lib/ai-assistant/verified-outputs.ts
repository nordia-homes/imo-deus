import { z } from 'zod';

const outputsSchema = z.object({
  assetId: z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/).optional(),
  videoUrl: z.string().url().max(8000).refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }).optional(),
}).strict();
export type VerifiedOutputs = z.infer<typeof outputsSchema>;

// These values are produced by authorized domain verifiers, never model output.
// Keep them separate from the immutable provider receipt and bind once per plan.
export function bindVerifiedOutputs(results: Record<string, unknown>[], rows: { step: number; completionSatisfied?: boolean; outputs?: unknown }[]) {
  return results.map((step, index) => {
    const evidence = rows.find(row => row.step === index + 1 && row.completionSatisfied === true);
    if (!evidence?.outputs) return step;
    const outputs = outputsSchema.parse(evidence.outputs);
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
