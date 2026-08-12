import type { Property } from '@/lib/types';

export function isCompletePropertyRecord(property: Partial<Property> | null | undefined): property is Property {
  return Boolean(
    property &&
      typeof property.id === 'string' &&
      property.id.trim() &&
      typeof property.title === 'string' &&
      property.title.trim() &&
      typeof property.price === 'number' &&
      Number.isFinite(property.price)
  );
}
