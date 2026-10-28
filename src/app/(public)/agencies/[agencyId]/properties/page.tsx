'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PropertyList } from '@/components/properties/PropertyList';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import type { Property } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import Image from 'next/image';
import homeStyles from '@/components/public/AgencyHomeHero.module.css';
import styles from '@/components/public/AgencyProperties.module.css';
import heroImage from '@/components/public/assets/hero-evening.jpg';
import { Button } from '@/components/ui/button';
import { ArrowRight, Filter, Search, X } from 'lucide-react';
import { PropertyFilters, type PropertyFiltersType } from "@/components/properties/PropertyFilters";

import { cn } from '@/lib/utils';
import { usePublicPath } from '@/context/PublicAgencyContext';


export default function AgencyAllPropertiesPage() {
  const { agencyId, isAgencyLoading: isAgencyContextLoading } = usePublicAgency();
  const publicPath = usePublicPath();
  const firestore = useFirestore();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<PropertyFiltersType | null>(null);

  // Fetch properties from Firestore
  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
        collection(firestore, 'agencies', agencyId, 'properties'),
        where('status', '==', 'Activ')
    );
  }, [firestore, agencyId]);
  
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
  const isLoading = isAgencyContextLoading || arePropertiesLoading;

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro');
    const words = normalize(search).trim().split(/\s+/).filter(Boolean);

    return properties.filter(prop => {
      const text = normalize([prop.title, prop.address, prop.city, prop.zone].filter(Boolean).join(' '));
      if (!words.every(word => text.includes(word))) return false;
      if (!filters) return true;
      if (filters.transactionType && filters.transactionType !== 'all' && prop.transactionType !== filters.transactionType) return false;
      if (filters.rooms && filters.rooms !== 4 && prop.rooms !== filters.rooms) return false;
      if (filters.rooms && filters.rooms === 4 && prop.rooms < 4) return false;
      
      if (filters.priceMin && prop.price < filters.priceMin) return false;
      if (filters.priceMax && prop.price > filters.priceMax) return false;

      if (filters.hasParking && (!prop.parking || prop.parking === 'Fără')) return false;
      if (filters.heatingSystem && filters.heatingSystem !== 'all' && prop.heatingSystem !== filters.heatingSystem) return false;
      if (filters.nearMetro && !prop.nearMetro) return false;
      if (filters.minSurface && prop.squareFootage < filters.minSurface) return false;
      if (filters.city && filters.city !== 'all' && prop.city !== filters.city) return false;
      if (filters.zones && filters.zones.length > 0 && !filters.zones.includes(prop.zone || '')) return false;
      if (filters.after1977 && prop.constructionYear && prop.constructionYear < 1977) return false;
      if (filters.furnishing && filters.furnishing !== 'all' && prop.furnishing !== filters.furnishing) return false;
      
      return true;
    });
  }, [properties, filters, search]);

  return (
    <div className={cn(homeStyles.page, styles.page)}>
      <section className={homeStyles.hero} aria-labelledby="portfolio-title">
        <div className={homeStyles.heroImage} aria-hidden="true">
          <Image src={heroImage} alt="" fill priority sizes="100vw" className={homeStyles.photo} />
        </div>
        <div className={cn(homeStyles.heroInner, styles.heroInner)}>
          <p className={homeStyles.eyebrow}>PROPRIETĂȚI. OAMENI. ACASĂ.</p>
          <h1 id="portfolio-title" className={homeStyles.title}>Descoperă locul<br /><span>pe care îl numești acasă.</span></h1>
          <p className={homeStyles.description}>Explorează proprietățile noastre și găsește ce ți se potrivește.<br />Simplu, clar, cu noi alături.</p>
          <form className={cn(homeStyles.search, styles.search)} role="search" onSubmit={event => { event.preventDefault(); document.getElementById('portfolio-results')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }}>
            <Search size={23} aria-hidden="true" />
            <label className="sr-only" htmlFor="portfolio-search">Caută proprietăți sau zone</label>
            <input id="portfolio-search" type="search" placeholder="Caută proprietăți sau zone…" value={search} onChange={event => setSearch(event.target.value)} />
            <button type="submit" aria-label="Vezi rezultatele căutării"><ArrowRight size={24} /></button>
          </form>
          <div className={styles.quickFilters} role="group" aria-label="Tipul tranzacției">
            {['all', 'Vânzare', 'Închiriere'].map(value => <button key={value} type="button" aria-pressed={(filters?.transactionType || 'all') === value} onClick={() => setFilters(previous => ({ ...previous, transactionType: value }))}>{value === 'all' ? 'Toate' : value}</button>)}
          </div>
        </div>
      </section>
      <section id="portfolio-results" className={cn(styles.results, homeStyles.cards)} aria-labelledby="results-title" aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div><h2 id="results-title">Proprietăți disponibile</h2><p role="status">{isLoading ? 'Se încarcă proprietățile…' : `${filteredProperties.length} ${filteredProperties.length === 1 ? 'proprietate' : 'proprietăți'} în selecție`}</p></div>
          <PropertyFilters initialFilters={filters} onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
            <Button variant="outline" className={styles.filterButton}><Filter size={17} /> Filtrează</Button>
          </PropertyFilters>
        </div>
        {(search || filters) && <button type="button" className={styles.reset} onClick={() => { setFilters(null); setSearch(''); }}>Resetează selecția <X size={14} /></button>}
        <PropertyList properties={filteredProperties} isLoading={isLoading} agencyId={agencyId!} publicBasePath={publicPath()} />
      </section>
      <section className={styles.contact}>
        <p className={homeStyles.eyebrow}>SUNTEM AICI PENTRU TINE</p>
        <h2>Acasă începe cu o conversație.</h2>
        <p>Spune-ne ce cauți și te ajutăm să alegi proprietatea potrivită.</p>
        <Link href={publicPath('/contact')}>Discută cu un consultant <ArrowRight size={18} /></Link>
      </section>
    </div>
  );
}
