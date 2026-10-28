import type { NearbyObjective } from '@/lib/property-presentations/nearby-google';

export type PublicNearbySnapshot = {
  status: 'ready' | 'unavailable';
  calculatedAt: string;
  objectives: NearbyObjective[];
};

export type PropertyWithPublicNearby = {
  publicNearby?: PublicNearbySnapshot;
};
