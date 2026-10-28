import { Bus, GraduationCap, ShoppingBasket, TrainFront, Baby, MapPin } from 'lucide-react';
import type { PropertyWithPublicNearby } from '@/lib/public-nearby';
import styles from './PublicPropertyDetail.module.css';

const icons = { metro: TrainFront, bus: Bus, tram: TrainFront, school: GraduationCap, kindergarten: Baby, grocery: ShoppingBasket };

// Render saved data only. No fetch, Google SDK, or calculation on page load.
export function PublicNearbyObjectives({ property }: { property: PropertyWithPublicNearby }) {
  const objectives = property.publicNearby?.objectives || [];
  return <section className={styles.nearby} aria-label="În apropiere">
    <p className={styles.eyebrow}>CARTIERUL TĂU, PAS CU PAS</p>
    <h2>Tot ce contează, aproape.</h2>
    {objectives.length ? <>
      <div className={styles.nearbyGrid}>{objectives.map(item => {
        const Icon = icons[item.kind] || MapPin;
        const content = <><Icon aria-hidden="true" /><span className={styles.nearbyLabel}>{item.label}</span><strong>{item.name}</strong>{item.address && <span>{item.address}</span>}<b>{item.walkingText}</b></>;
        return item.mapsUrl?.startsWith('https://www.google.com/maps/')
          ? <a key={item.kind} href={item.mapsUrl} target="_blank" rel="noopener noreferrer">{content}</a>
          : <div key={item.kind}>{content}</div>;
      })}</div>
      <p className={styles.nearbyNote}>Timpi estimativi de mers pe jos · Date Google Maps, salvate la {new Date(property.publicNearby!.calculatedAt).toLocaleDateString('ro-RO')}.</p>
    </> : <p className={styles.nearbyNote}>Informațiile despre obiectivele din apropiere nu sunt încă disponibile pentru acest anunț.</p>}
  </section>;
}
