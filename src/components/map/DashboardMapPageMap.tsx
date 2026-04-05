'use client';

import type { Property } from '@/lib/types';
import { PropertiesMap } from './PropertiesMap';

export function DashboardMapPageMap({ properties }: { properties: Property[] }) {
  return <PropertiesMap properties={properties} layoutMode="map-only" appearance="dashboard-map-page" />;
}
