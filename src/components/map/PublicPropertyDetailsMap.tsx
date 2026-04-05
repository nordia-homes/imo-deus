'use client';

import type { Property } from '@/lib/types';
import { PropertiesMap } from './PropertiesMap';

export function PublicPropertyDetailsMap({ properties }: { properties: Property[] }) {
  return <PropertiesMap properties={properties} zoomMode="close" appearance="public-property-detail" />;
}
