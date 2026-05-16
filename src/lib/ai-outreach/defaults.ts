import type { AiOutreachSettings } from '@/lib/ai-outreach/types';

export const DEFAULT_AI_OUTREACH_SETTINGS: Omit<AiOutreachSettings, 'agencyId'> = {
  enabled: false,
  desiredCommissionValue: '3',
  minimumCommissionValue: '2',
  commissionType: 'percent',
  allowNegotiation: true,
  allowVerbalAgreement: true,
  allowExactAddressCollection: true,
  defaultTemplateId: 'owner_acquisition',
  callWindowStart: '09:00',
  callWindowEnd: '18:00',
  timezone: 'Europe/Bucharest',
  maxDailyCalls: 50,
  monthlyBudgetCap: null,
  recordCalls: true,
  discloseAi: true,
};

export function withDefaultAiOutreachSettings(agencyId: string, partial?: Partial<AiOutreachSettings> | null): AiOutreachSettings {
  return {
    ...DEFAULT_AI_OUTREACH_SETTINGS,
    ...partial,
    agencyId,
  };
}
