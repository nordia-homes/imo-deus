'use client';

import Link from 'next/link';
import { ArrowRight, BedDouble, Ruler, Calendar, Layers, Thermometer, Sofa, Maximize, Paintbrush, ArrowUpDown } from 'lucide-react';
import type { Property } from '@/lib/types';
import { usePublicPath } from '@/context/PublicAgencyContext';
import styles from './PublicPropertyDetail.module.css';

export function PublicPropertyStory({ property }: { property: Property }) {
  const surface = property.totalSurface ?? property.squareFootage;
  const facts = [
    { icon: Ruler, label: 'Suprafață', value: surface ? `${surface} mp` : null },
    { icon: BedDouble, label: 'Camere', value: property.rooms },
    { icon: Calendar, label: 'An construcție', value: property.constructionYear },
    { icon: Layers, label: 'Etaj', value: property.floor },
    { icon: Layers, label: 'Compartimentare', value: property.partitioning },
    { icon: Paintbrush, label: 'Stare interior', value: property.interiorState },
    { icon: Sofa, label: 'Bucătărie', value: property.kitchen },
    { icon: Maximize, label: 'Balcon / terasă', value: property.balconyTerrace },
    { icon: ArrowUpDown, label: 'Lift', value: property.lift },
    { icon: Thermometer, label: 'Încălzire', value: property.heatingSystem },
  ].filter(item => item.value !== undefined && item.value !== null && item.value !== '');
  return <div className={styles.story}>
    <section className={styles.factsSection} aria-labelledby="property-facts-title">
      <h2 id="property-facts-title">Spațiul tău.<br /><em>Fiecare detaliu contează.</em></h2>
      <dl className={styles.facts}>
        {facts.map(({ icon: Icon, label, value }) => <div key={label}>
          <Icon size={22} aria-hidden="true" /><dt>{label}</dt><dd>{String(value)}</dd>
        </div>)}
      </dl>
    </section>

  </div>;
}

export function PublicPropertyFinancing() {
  const publicPath = usePublicPath();
  return (
    <section className={styles.financing} aria-labelledby="property-finance-title">
      <p className={styles.eyebrow}>UN PAS MAI APROAPE DE ACASĂ</p>
      <h2 id="property-finance-title">Planuri mari.<br /><em>Decizii bine calculate.</em></h2>
      <p>Ai nevoie de finanțare? Te punem în legătură cu un broker de credite pentru a compara opțiunile potrivite bugetului tău.</p>
      <p className={styles.financeSummary}>Discuți despre buget, compari ofertele băncilor și alegi informat.</p>
      <Link href={publicPath('/contact')}>Discută despre finanțare <ArrowRight size={18} /></Link>
    </section>
  );
}
