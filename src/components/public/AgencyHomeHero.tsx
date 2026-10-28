'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Clock3, FileCheck2, MapPin, Search, ShieldCheck, X } from 'lucide-react';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { PropertyCard } from '@/components/properties/PropertyCard';
import type { Property } from '@/lib/types';
import styles from './AgencyHomeHero.module.css';
import heroImage from './assets/hero-evening.jpg';

const categories = [
  { id: 'all', label: 'Toate' },
  { id: 'apartments', label: 'Apartamente' },
  { id: 'studios', label: 'Garsoniere' },
  { id: 'houses', label: 'Case' },
  { id: 'rent', label: 'Închiriere' },
] as const;
type Category = typeof categories[number]['id'];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro').trim();

export function AgencyHomeHero({ properties = [], featuredProperties = [], isLoading = false }: {
  properties?: Property[];
  featuredProperties?: Property[];
  isLoading?: boolean;
}) {
  const { agencyId } = usePublicAgency();
  const publicPath = usePublicPath();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [visibleCount, setVisibleCount] = useState(8);
  const hasFilters = Boolean(query.trim()) || category !== 'all';
  const filtered = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return properties.filter(property => {
      const type = normalize(property.propertyType || '');
      const studio = type.includes('garson') || (type === 'apartament' && property.rooms === 1);
      if (category === 'apartments' && (!type.includes('apartament') || studio)) return false;
      if (category === 'studios' && !studio) return false;
      if (category === 'houses' && !/casa|vila/.test(type)) return false;
      if (category === 'rent' && !normalize(property.transactionType || '').includes('inchiriere')) return false;
      const searchable = normalize([property.title, property.address, property.city, property.zone, property.propertyType].filter(Boolean).join(' '));
      return words.every(word => searchable.includes(word));
    });
  }, [properties, category, query]);
  const shown = hasFilters ? filtered.slice(0, visibleCount) : featuredProperties;
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    document.getElementById('proprietati-recomandate')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  return (
    <>
      <section className={styles.hero} aria-labelledby="agency-home-title">
        <div className={styles.heroImage} aria-hidden="true">
          <Image src={heroImage} alt="" fill priority sizes="100vw" className={styles.photo} />
        </div>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>PROPRIETĂȚI. OAMENI. ACASĂ.</p>
          <h1 id="agency-home-title" className={styles.title}>Locuințe reale.<br /><span>Oameni reali.</span></h1>
          <p className={styles.description}>Un loc potrivit pentru următorul tău capitol.<br />Simplu, clar, cu noi alături.</p>
          <form className={styles.search} onSubmit={submitSearch} role="search">
            <Search size={23} aria-hidden="true" />
            <label className="sr-only" htmlFor="agency-home-search">Caută proprietăți după zonă, adresă sau cuvinte cheie</label>
            <input id="agency-home-search" type="search" placeholder="Caută proprietăți sau zone…" value={query} onChange={event => { setQuery(event.target.value); setVisibleCount(8); }} />
            <button type="submit" aria-label="Vezi rezultatele căutării"><ArrowRight size={24} /></button>
          </form>
          <div className={styles.filters} role="group" aria-label="Tipul proprietății">
            {categories.map(item => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => { setCategory(item.id); setVisibleCount(8); }}>{item.label}</button>)}
          </div>
        </div>
      </section>
      <div className={styles.benefits}>
        <div><MapPin /><p>Zone pentru tine<span>opțiuni relevante</span></p></div>
        <div><ShieldCheck /><p>0% comision<span>pentru cumpărător</span></p></div>
        <div><FileCheck2 /><p>Suport dedicat<span>pe tot parcursul</span></p></div>
        <div><Clock3 /><p>Vizionări flexibile<span>în ritmul tău</span></p></div>
      </div>
      <section id="proprietati-recomandate" className={`container mx-auto px-4 ${styles.listings}`} aria-labelledby="home-properties-title" aria-busy={isLoading}>
        <div className={styles.sectionHeading}>
          <h2 id="home-properties-title">{hasFilters ? 'Rezultatele căutării' : 'Proprietăți recomandate'}</h2>
          <Link href={publicPath('/properties')}>Vezi toate <ArrowRight size={18} /></Link>
        </div>
        {hasFilters && <div className={styles.resultStatus}><p role="status" aria-live="polite">{isLoading ? 'Se încarcă proprietățile…' : `${filtered.length} ${filtered.length === 1 ? 'proprietate găsită' : 'proprietăți găsite'}`}</p><button type="button" onClick={() => { setQuery(''); setCategory('all'); setVisibleCount(8); }}>Resetează <X size={14} /></button></div>}
        {isLoading ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">{[0,1,2,3].map(item => <div key={item} className={styles.skeleton}><div className="aspect-[16/10]" /><span /></div>)}</div> : shown.length && agencyId ? (
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8 ${styles.cards}`}>
            {shown.map(property => <PropertyCard key={property.id} property={property} agencyId={agencyId} publicBasePath={publicPath()} />)}
          </div>
        ) : <div className={styles.empty}><Search /><h3>{hasFilters ? 'Nu am găsit proprietăți pentru această selecție.' : 'Pregătim următoarele proprietăți.'}</h3><p>{hasFilters ? 'Încearcă altă zonă sau elimină un filtru.' : 'Spune-ne ce cauți și te ajutăm cu o selecție potrivită.'}</p><Link href={publicPath('/contact')}>Discută cu un consultant <ArrowRight size={16} /></Link></div>}
        {hasFilters && filtered.length > visibleCount && <button type="button" className={styles.loadMore} onClick={() => setVisibleCount(count => count + 8)}>Arată mai multe proprietăți <ArrowRight size={18} /></button>}
      </section>
    </>
  );
}
