import { getResource, type AssistantContext } from './access';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';
export async function propertyPublicLink(ctx: AssistantContext, propertyId: string) {
 const property = await getResource(ctx, 'properties', propertyId);
 if (property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId || property.status !== 'Activ') throw new Error('Proprietatea nu este activă pentru distribuire.');
 const agency = await ctx.adminDb.collection('agencies').doc(ctx.agencyId).get();
 if (!agency.exists) throw new Error('Configurația agenției lipsește.');
 const path = buildAgencyPublicUrl({ id: ctx.agencyId, customDomain: agency.data()?.customDomain }, '/properties/' + encodeURIComponent(propertyId));
 const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://imodeus.ro';
 const url = new URL(path, base);
 if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Domeniul public nu are o adresă HTTPS validă.');
 return { propertyId, title: property.title || '', url: url.href, source: 'agency_public_website', availabilityVerified: false };
}
