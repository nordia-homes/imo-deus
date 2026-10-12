import type { AssistantContext } from './access';
import { withDefaultAiOutreachSettings } from '@/lib/ai-outreach/defaults';

export async function readOutreachConfiguration(ctx: AssistantContext) {
  const snapshot = await ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('aiOutreach').doc('settings').get();
  const settings = withDefaultAiOutreachSettings(ctx.agencyId, snapshot.data());
  // Expose only configuration fields, never arbitrary stored keys or credentials.
  const { enabled, desiredCommissionValue, minimumCommissionValue, commissionType, allowNegotiation, allowVerbalAgreement, allowExactAddressCollection, defaultTemplateId, callWindowStart, callWindowEnd, timezone, maxDailyCalls, monthlyBudgetCap, recordCalls, discloseAi } = settings;
  return { rows: [{ enabled, desiredCommissionValue, minimumCommissionValue, commissionType, allowNegotiation, allowVerbalAgreement, allowExactAddressCollection, defaultTemplateId, callWindowStart, callWindowEnd, timezone, maxDailyCalls, monthlyBudgetCap, recordCalls, discloseAi }], complete: true, persisted: snapshot.exists, canEdit: ctx.role === 'admin',
    note: 'Configurația actuală a agenției; lipsa documentului folosește valorile implicite cu serviciul dezactivat. Orele sunt București. Numai administratorul modifică aceste setări. enabled nu dovedește eligibilitatea unui proprietar sau configurarea furnizorului. Nu modifica setări și nu lansa apeluri pentru această citire.' };
}
