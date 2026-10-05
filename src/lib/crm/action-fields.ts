import { z } from 'zod';

export const canonicalLocationSchema = z.object({ provider: z.literal('imobiliare'), locationId: z.number().int().positive(), oldId: z.number().int().nullable().optional(), depth: z.union([z.literal(2), z.literal(3)]), county: z.string().max(200), locality: z.string().max(200), zone: z.string().max(200).nullable().optional(), display: z.string().max(500), searchText: z.string().max(500).optional() }).strict();
export const propertyLifecycleSchema = z.object({ status: z.enum(['Activ', 'Inactiv', 'Rezervat', 'Vândut', 'Închiriat']), reason: z.enum(['reservation_offer_accepted', 'reservation_financing_pending', 'reservation_documents_pending', 'sale_completed', 'sale_cash', 'sale_financed']).optional(), notes: z.string().max(3000).default(''), soldPrice: z.number().positive().max(1e9).optional() }).strict();

// Shared field contracts for forms and assistant actions. Ownership/status are
// deliberately handled by separate commands, never by an arbitrary patch.
const text = (max = 500) => z.string().max(max).nullable().optional();
export const propertyExtraFields = {
  location: text(), city: text(100), zone: text(100), imobiliareLocationId: text(180),
  propertyType: text(100), transactionType: text(100),
  totalSurface: z.number().positive().nullable().optional(),
  constructionYear: z.number().int().min(1800).max(new Date().getFullYear() + 1).nullable().optional(),
  floor: text(30), totalFloors: z.number().int().nonnegative().max(300).nullable().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(), longitude: z.number().min(-180).max(180).nullable().optional(),
  orientation: text(), comfort: text(), interiorState: text(), furnishing: text(), heatingSystem: text(),
  parking: text(), keyFeatures: text(10000), buildingState: text(), seismicRisk: text(),
  balconyTerrace: text(), partitioning: text(), kitchen: text(), lift: text(), nearMetro: z.boolean().optional(),
  ownerName: text(200), ownerPhone: text(40), ownerListingUrl: z.string().url().nullable().optional(), salesScore: text(80),
  defaultFacebookConnectionId: text(180), commissionType: text(100), commissionValue: z.number().nonnegative().optional(),
  buyerCommissionType: text(100), buyerCommissionValue: z.number().nonnegative().optional(),
  amenities: z.array(z.string().max(300)).max(100).optional(), cadastralNumber: text(200), tagline: text(500),
  advertisingCosts: z.object({ facebook: z.number().nonnegative().optional(), google: z.number().nonnegative().optional(), tiktok: z.number().nonnegative().optional(), currency: z.enum(['RON', 'EUR', 'USD']).optional() }).strict().optional(),
  locationProfile: z.object({ primary: canonicalLocationSchema.nullable(), publishLocationId: z.number().int().positive().nullable().optional(), source: z.enum(['manual', 'derived', 'migrated']), confidence: z.number().min(0).max(1).nullable().optional() }).strict().nullable().optional(),
  portalProfiles: z.object({ imobiliare: z.object({ locationId: z.number().int().positive().nullable().optional(), locationLabel: z.string().max(500).nullable().optional() }).strict().optional() }).strict().optional(),
  uploadedVideo: z.object({ url: z.string().url(), fileName: z.string().max(300), mimeType: z.string().regex(/^video\//).max(100), sizeBytes: z.number().int().positive().max(500 * 1024 * 1024).nullable().optional(), uploadedAt: z.string().datetime({ offset: true }), uploadedByUid: z.string().max(180).nullable().optional() }).strict().nullable().optional(),
};

export function assertPropertyActivation(row: Record<string, any>) {
  if (!row.title || !row.address || !(row.price > 0) || !(row.squareFootage > 0) || !Array.isArray(row.images) || !row.images.length) {
    throw Object.assign(new Error('Completează titlul, adresa, prețul, suprafața și imaginile înainte de activare.'), { status: 400 });
  }
}

export function initialContactPreferences(budget = 0, city = '') {
  return { desiredPriceRangeMin: budget > 0 ? Math.round(budget * 0.8) : 0,
    desiredPriceRangeMax: budget > 0 ? Math.round(budget * 1.2) : 0, desiredRooms: 0, desiredBathrooms: 0,
    desiredSquareFootageMin: 0, desiredSquareFootageMax: 0, desiredFeatures: '', locationPreferences: city };
}

export function propertyLifecyclePatch(row: Record<string, any>, change: z.infer<typeof propertyLifecycleSchema>, now: string) {
  if (change.status === 'Activ') assertPropertyActivation(row);
  if (change.status === 'Vândut' && !change.soldPrice) throw Object.assign(new Error('Precizează prețul final de vânzare.'), { status: 400 });
  if (change.reason && !(change.status === 'Rezervat' ? change.reason.startsWith('reservation_') : change.status === 'Vândut' && change.reason.startsWith('sale_'))) throw Object.assign(new Error('Motivul nu corespunde statusului.'), { status: 400 });
  return { status: change.status, statusUpdatedAt: now, updatedAt: now, soldPrice: change.status === 'Vândut' ? change.soldPrice : null };
}

export const propertyStatusReasonLabels: Record<string, string> = { reservation_offer_accepted: 'Oferta acceptată', reservation_financing_pending: 'Așteaptă finanțare', reservation_documents_pending: 'Așteaptă acte', sale_completed: 'Tranzacție finalizată', sale_cash: 'Vânzare cash', sale_financed: 'Vânzare prin credit' };
