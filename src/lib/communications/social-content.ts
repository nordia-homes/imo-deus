import { createHash } from 'node:crypto';
export function propertyImageUrls(images: Array<{ url?: string }> = []) {
  return [...new Set(images.map(image => image?.url).filter((url): url is string => typeof url === 'string' && /^https:\/\//.test(url)))];
}
export function socialDraftRevision(post: Record<string, any>) { return createHash('sha256').update(JSON.stringify([post.propertyId, post.text, post.images, post.propertyPrice, post.propertyTitle, post.destinations, post.status, post.contentSource, post.createdBy, post.updatedAt || null])).digest('hex'); }
export function socialCrmContentMatches(post: Record<string, any>, property: Record<string, any> | undefined) {
  if (post.contentSource !== 'crm') return true;
  return !!property && !property.deletedAt && property.description === post.text && (property.price ?? null) === post.propertyPrice && (property.title || '') === post.propertyTitle && JSON.stringify(propertyImageUrls(Array.isArray(property.images) ? property.images : [])) === JSON.stringify(post.images);
}