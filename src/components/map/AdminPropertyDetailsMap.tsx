'use client';

import type { Property } from '@/lib/types';
import { PropertiesMap } from './PropertiesMap';

export function AdminPropertyDetailsMap({ properties }: { properties: Property[] }) {
  return <PropertiesMap properties={properties} zoomMode="close" appearance="admin-property-detail" />;
}
