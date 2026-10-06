// Deliberately bounded fixtures: an unknown handler must not look connected.
export function existingReadFixture(operation) {
  if (operation === 'global_search') return { contacts: [{ id: 'c1', name: 'Andrei Popescu' }], properties: [], tasks: [], complete: true };
  if (operation === 'facebook_connections') return { connections: [{ id: 'fixture-connection', name: 'Synthetic Facebook connection', status: 'connected' }], complete: true };
  if (['meta_status', 'tiktok_status', 'tiktok_organic_status', 'imobiliare_status', 'storia_status', 'romimo_status', 'communications_status'].includes(operation)) return { configured: true, connected: true, status: 'connected', complete: true };
  if (operation === 'tiktok_capabilities') return { capabilities: [{ id: 'campaign_read', available: true }, { id: 'campaign_publish', available: false, reason: 'Synthetic fixture has no spend authorization' }], complete: true };
  if (operation === 'tiktok_drafts') return { drafts: [{ id: 'draft1', propertyId: 'p1', status: 'draft' }], complete: true };
  return { error: 'No reviewed fixture for this read operation', complete: false };
}
