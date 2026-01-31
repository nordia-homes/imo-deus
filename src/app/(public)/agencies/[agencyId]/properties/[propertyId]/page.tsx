'use client';

import { useParams, notFound } from 'next/navigation';
import { useMemo } from 'react';
import type { Property } from '@/lib/types';
import { PropertyClientView } from '@/components/public/PropertyClientView';
import { properties as allProperties } from '@/lib/data';

export default function PublicPropertyDetailPage() {
  const params = useParams();
  const { propertyId } = params as { propertyId: string };

  const property = useMemo(() => {
    return allProperties.find(p => p.id === propertyId);
  }, [propertyId]);

  if (!property || property.status !== 'Activ') {
    notFound();
    return null;
  }

  return <PropertyClientView property={property} />;
}
