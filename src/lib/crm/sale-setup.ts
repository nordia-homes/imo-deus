import { z } from 'zod';
const id = z.string().min(1).max(180).regex(/^[^/]+$/);
export const saleParticipantSchema = z.object({ id, role: z.enum(['buyer', 'owner', 'notary', 'collaborator']), contactId: id.nullable().optional(), name: z.string().trim().max(200), email: z.string().trim().email().or(z.literal('')), phone: z.string().trim().max(50).nullable().optional(), preferredChannel: z.enum(['email', 'phone', 'whatsapp']).optional() }).strip();
// Legacy clients send whole document rows. Keep only editable metadata; file/scanner fields are authoritative server state.
export const saleChecklistSetupSchema = z.object({ id, label: z.string().trim().min(1).max(240), participantRole: z.enum(['buyer', 'owner']), participantId: id.nullable().optional(), scope: z.enum(['property', 'participant', 'transaction']).optional(), stage: z.enum(['reservation', 'precontract', 'contract']).optional(), appliesToStages: z.array(z.enum(['reservation', 'precontract', 'contract'])).max(3).optional(), status: z.enum(['required', 'requested', 'received_needs_review', 'verified', 'rejected', 'expired', 'not_required']), required: z.boolean(), notes: z.string().max(1000).nullable().optional(), notRequiredReason: z.string().max(1000).nullable().optional() }).strip();
export const saleSetupSchema = z.object({ participants: z.array(saleParticipantSchema).min(2).max(20), agreedPrice: z.number().positive().max(1e9).nullable(), reservationAmount: z.number().nonnegative().max(1e9).nullable().optional().default(null), precontractAmount: z.number().nonnegative().max(1e9).nullable().optional().default(null), financingType: z.enum(['cash', 'credit', 'unknown']), checklist: z.array(saleChecklistSetupSchema).max(100), notary: z.object({ name: z.string().trim().max(200).nullable().optional(), email: z.string().trim().email().or(z.literal('')).nullable().optional(), phone: z.string().trim().max(50).nullable().optional(), address: z.string().trim().max(400).nullable().optional(), appointmentAt: z.string().datetime().nullable().optional() }).strip().nullable(), nextAction: z.string().trim().max(2000).nullable().optional(), nextActionAt: z.string().datetime({ offset: true }).nullable().optional(), expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional() }).strict().superRefine((input, ctx) => {
  if (input.agreedPrice != null && (input.reservationAmount ?? 0) + (input.precontractAmount ?? 0) > input.agreedPrice) ctx.addIssue({ code: 'custom', path: ['precontractAmount'], message: 'Rezervarea și antecontractul nu pot depăși prețul de vânzare.' });
  for (const field of ['participants', 'checklist'] as const) if (new Set(input[field].map(row => row.id)).size !== input[field].length) ctx.addIssue({ code: 'custom', path: [field], message: 'Identificatorii trebuie să fie unici.' });
});

export function mergeSetupChecklist(previous: Record<string, any>[], input: z.infer<typeof saleChecklistSetupSchema>[], now: string) {
  const output = input.map(item => {
    const stored = previous.find(row => row.id === item.id);
    if (!stored && !['required', 'requested', 'not_required'].includes(item.status)) throw new Error('Un document nou nu poate fi declarat primit sau verificat din configurare. Folosește încărcarea și verificarea documentului.');
    let status = stored?.status || item.status;
    if (!item.required && item.status === 'not_required') status = 'not_required';
    else if (stored?.status === 'not_required' && item.required) status = stored.storagePath && stored.fileState !== 'archived' ? 'received_needs_review' : 'required';
    const { status: _status, ...metadata } = item;
    return { ...stored, ...metadata, status, ...(status === 'requested' && !stored?.requestedAt ? { requestedAt: now } : {}) };
  });
  // Configuration cannot silently detach a received document or its version history.
  for (const stored of previous) if (!output.some(row => row.id === stored.id) && (stored.storagePath || stored.versions?.length || stored.downloadUrl)) output.push(stored as any);
  return output;
}
