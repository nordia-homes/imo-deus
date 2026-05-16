import type { AiOutreachOutcome, AiOutreachStatus } from '@/lib/ai-outreach/types';

type StatusMeta = {
  label: string;
  shortLabel: string;
  tone: 'neutral' | 'pending' | 'info' | 'success' | 'danger' | 'warning' | 'muted';
};

export const AI_OUTREACH_OUTCOME_META: Record<AiOutreachOutcome, StatusMeta> = {
  uncalled: { label: 'Nesunat', shortLabel: 'Nesunat', tone: 'neutral' },
  queued: { label: 'AI in asteptare', shortLabel: 'AI asteapta', tone: 'pending' },
  calling: { label: 'In apel', shortLabel: 'In apel', tone: 'info' },
  collaborates: { label: 'Colaboreaza', shortLabel: 'Colaboreaza', tone: 'success' },
  does_not_collaborate: { label: 'Nu colaboreaza', shortLabel: 'Nu colab.', tone: 'danger' },
  call_later: { label: 'Revino mai tarziu', shortLabel: 'Revino', tone: 'warning' },
  no_answer: { label: 'Nu a raspuns', shortLabel: 'Fara raspuns', tone: 'muted' },
  busy: { label: 'Ocupat', shortLabel: 'Ocupat', tone: 'warning' },
  wrong_number: { label: 'Numar gresit', shortLabel: 'Gresit', tone: 'muted' },
  invalid_number: { label: 'Numar invalid', shortLabel: 'Invalid', tone: 'muted' },
  already_sold: { label: 'Deja vandut', shortLabel: 'Vandut', tone: 'muted' },
  already_has_agency: { label: 'Are agentie', shortLabel: 'Are agentie', tone: 'warning' },
  do_not_call: { label: 'Nu mai suna', shortLabel: 'Nu suna', tone: 'muted' },
  verbal_agreement: { label: 'Acord verbal', shortLabel: 'Acord', tone: 'success' },
  negotiation_success: { label: 'Negociere reusita', shortLabel: 'Negociat', tone: 'success' },
  negotiation_blocked: { label: 'Negociere blocata', shortLabel: 'Blocat', tone: 'warning' },
  needs_human_review: { label: 'Necesita review', shortLabel: 'Review', tone: 'warning' },
  failed: { label: 'Apel esuat', shortLabel: 'Esuat', tone: 'danger' },
};

export function getAiOutreachOutcomeMeta(outcome?: AiOutreachOutcome | null): StatusMeta {
  return AI_OUTREACH_OUTCOME_META[outcome || 'uncalled'] ?? AI_OUTREACH_OUTCOME_META.uncalled;
}

export function statusToDefaultOutcome(status?: AiOutreachStatus | null): AiOutreachOutcome {
  if (status === 'queued' || status === 'scheduled') return 'queued';
  if (status === 'calling') return 'calling';
  if (status === 'failed') return 'failed';
  return 'uncalled';
}

export function normalizeVapiEndedReason(reason?: string | null): AiOutreachOutcome {
  const normalized = (reason || '').toLowerCase();
  if (normalized.includes('no-answer') || normalized.includes('no answer')) return 'no_answer';
  if (normalized.includes('busy')) return 'busy';
  if (normalized.includes('invalid')) return 'invalid_number';
  if (normalized.includes('failed')) return 'failed';
  return 'needs_human_review';
}
