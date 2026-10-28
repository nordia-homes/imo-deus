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
      <ul className={styles.nearbyList}>{objectives.map(item => {
        const Icon = icons[item.kind] || MapPin;
        const content = <><Icon aria-hidden="true" /><span className={styles.nearbyContent}><span className={styles.nearbyLabel}>{item.label}</span><strong>{item.name}</strong>{item.address && <span>{item.address}</span>}</span><b>{item.walkingText}</b></>;
        return <li key={item.kind}>{item.mapsUrl?.startsWith('https://www.google.com/maps/')
          ? <a href={item.mapsUrl} target="_blank" rel="noopener noreferrer">{content}</a>
          : <div>{content}</div>}</li>;
      })}</ul>
    </> : <p className={styles.nearbyNote}>Informațiile despre obiectivele din apropiere nu sunt încă disponibile pentru acest anunț.</p>}
  </section>;
}
