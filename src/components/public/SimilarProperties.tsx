'use client';

import type { Property } from '@/lib/types';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import styles from './PublicPropertyDetail.module.css';

export function SimilarProperties({ properties }: { properties: Property[] }) {
  const { agencyId } = usePublicAgency();
  const publicPath = usePublicPath();
  if (!properties.length || !agencyId) return null;
  return <section className={styles.similar} aria-labelledby="similar-title">
    <p className={styles.eyebrow}>CONTINUĂ SĂ EXPLOREZI</p>
    <h2 id="similar-title">Alte locuri. Aceeași promisiune.</h2>
    <Carousel opts={{ align: 'start', loop: properties.length > 2 }}>
      <CarouselContent>
        {properties.map(property => <CarouselItem key={property.id} className="md:basis-1/2"><PropertyCard property={property} agencyId={agencyId} publicBasePath={publicPath()} /></CarouselItem>)}
      </CarouselContent>
      {properties.length > 1 && <div className={styles.carouselControls}><CarouselPrevious className="static translate-y-0" /><CarouselNext className="static translate-y-0" /></div>}
    </Carousel>
  </section>;
}
