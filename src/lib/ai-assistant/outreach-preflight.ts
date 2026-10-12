import type { AssistantContext } from './access';
import { AiOutreachGuardError, assertCanCreateAiOutreachCall, getAiOutreachSettings, normalizeAiOutreachPhone } from '@/lib/ai-outreach/server';
import { isVapiOutboundConfigured } from '@/lib/ai-outreach/vapi';

// A read-only preflight, never an authorization or a reservation of a call slot.
export async function readOutreachPreflight(ctx: AssistantContext, input: { listingId: string }) {
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const blocked = (reason: string) => ({ complete: true, eligible: false, rows: [{ id: input.listingId, eligible: false, reason }], reason });
  const favorite = await agency.collection('ownerListingFavorites').doc(input.listingId).get();
  if (!favorite.exists || favorite.data()?.isFavoriteActive === false) return blocked('Anunțul nu este activ în prospectarea agenției.');
  const saved = favorite.data()!;
  const source = await ctx.adminDb.collection('ownerListings').doc(input.listingId).get();
  const canonical = source.data()?.publicationStatus === 'ready' && source.data()?.isCanonical === true ? source.data() : undefined;
  const phone = normalizeAiOutreachPhone(saved.ownerPhone == null || typeof saved.ownerPhone === 'string' && !saved.ownerPhone.trim() ? canonical?.ownerPhone : saved.ownerPhone);
  if (!/^0[237]\d{8}$/.test(phone)) return blocked('Lipsește un număr de telefon românesc valid.');
  const title = [saved.title, canonical?.title].find(value => typeof value === 'string' && value.trim());
  if (!title) return blocked('Lipsește titlul anunțului selectat.');
  try {
    await assertCanCreateAiOutreachCall({ adminDb: ctx.adminDb, agencyId: ctx.agencyId, ownerListingId: input.listingId, settings: await getAiOutreachSettings(ctx.adminDb, ctx.agencyId) });
  } catch (error) {
    if (error instanceof AiOutreachGuardError) return blocked(error.message);
    throw error;
  }
  const calls = await agency.collection('aiOutreachCalls').get();
  const related = calls.docs.map(doc => doc.data()).filter(row => normalizeAiOutreachPhone(row.ownerPhone) === phone);
  if (related.some(row => row.result?.doNotCall === true || row.outcome === 'do_not_call')) return blocked('La acest număr există un refuz de contactare.');
  if (related.some(row => ['calling', 'queued', 'scheduled'].includes(row.status) || row.status === 'completed' && row.ownerListingId !== input.listingId)) return blocked('Există deja un apel activ sau un apel efectuat pentru alt anunț la acest număr.');
  const prospects = await agency.collection('ownerListingFavorites').get();
  if (prospects.docs.some(doc => {
    const row = doc.data();
    return doc.id !== input.listingId && normalizeAiOutreachPhone(Object.hasOwn(row, 'contactOutcomePhone') ? row.contactOutcomePhone : row.ownerPhone) === phone
      && ['negative', 'follow_up'].includes(row.contactOutcome) && typeof row.contactOutcomeAt === 'string' && Number.isFinite(Date.parse(row.contactOutcomeAt));
  })) return blocked('La acest număr există deja un rezultat de contact pentru alt anunț.');
  if (!isVapiOutboundConfigured()) return blocked('Furnizorul de apeluri AI nu este configurat.');
  return { complete: true, eligible: true, rows: [{ id: input.listingId, title, eligible: true }], suggestedAction: { kind: 'existing_operation', operation: 'outreach_start', params: {}, query: {}, body: { ownerListing: { id: input.listingId, title } } },
    note: 'Verificare preliminară reușită. Niciun apel lansat. Copiază suggestedAction în propose_actions, apoi goal_coverage resolution=planned steps=[1]. Planul folosește aprobarea existentă a aplicației; eligibilitatea este reverificată la execuție. Configurarea furnizorului nu garantează disponibilitatea lui.' };
}
