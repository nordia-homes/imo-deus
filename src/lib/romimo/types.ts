export type RomimoCategory = { id: number; description: string; dealType: string };
export type RomimoField = {
  key: string;
  description: string;
  valueType: string;
  isRequired: boolean;
  predefinedValues: string[] | null;
  multipleValuesAllowed: boolean;
  multipleValuesSeparator: string | null;
  categoryIds: number[];
};
export type RomimoCatalog = {
  categories: RomimoCategory[];
  currencies: string[];
  properties: RomimoField[];
};
export type RomimoSettings = {
  category: number;
  currency: string;
  county: string;
  city: string;
  area: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  validFrom: string;
  validTo: string;
  fields: Record<string, string>;
};
export type RomimoArticle = {
  user: { email: string };
  ad: {
    active: boolean; promoted: false; externalid: string; category: number;
    price: number; currency: string; title: string; text: string;
    validFrom: string; validTo: string;
  };
  contact: { contactName: string; contactEmail: string; contactPhone: string; allowWhatsApp: false };
  location: { countyName: string; cityName: string; areaName?: string };
  properties: { key: string; value: string }[];
  pictures: { url: string; rank: number }[];
};
export type RomimoState = 'unpublished' | 'pending' | 'published' | 'error';
export type RomimoManagedArticles = {
  items: Array<{ propertyId: string; title: string; state: RomimoState; message: string; remoteUrl: string | null }>;
  nextCursor: string | null;
};
export type RomimoPortalProfile = {
  externalId?: string;
  remoteUrl?: string | null;
  lastCheckedAt?: string;
  message?: string;
};
export type RomimoPreview = {
  settings: RomimoSettings;
  catalog: RomimoCatalog;
  issues: string[];
  warnings: string[];
  summary: { title: string; description: string; price: number; photos: string[] };
  previewHash: string | null;
  connected: boolean;
  canUpdate: boolean;
  hasSubmission: boolean;
  submissionState?: RomimoState;
  lastMessage?: string;
};
