'use client';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Mail, Phone, Sparkles, MessageCircle, KeyRound } from 'lucide-react';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import { ContactLeadForm } from '@/components/public/ContactLeadForm';
import heroImage from '@/components/public/assets/hero-evening.jpg';
import styles from '@/components/public/AgencyContact.module.css';

export default function AgencyContactPage() {
  const { agency, agencyId, isAgencyLoading } = usePublicAgency();
  const publicPath = usePublicPath();
  return <div className={styles.page}><div className={styles.container}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}>CONTACT · {agency?.name || 'ACASĂ ÎNCEPE CU NOI'}</p>
      <h1>Un gând. O conversație.<br /><span>Un nou început.</span></h1>
      <p>Spune-ne ce îți dorești. Împreună, găsim următorul pas.</p>
    </header>
    <div className={styles.layout}>
      <aside className={styles.story}>
        <div className={styles.photo}>
          <Image src={heroImage} alt="Un living primitor, luminat cald, cu vedere spre oraș" fill sizes="(max-width: 900px) 100vw, 480px" priority />
          <div className={styles.photoCopy}><span className={styles.eyebrow}>MAI MULT DECÂT O ADRESĂ</span><h2>Locul tău.<br /><em>Povestea ta.</em></h2><p>Noi te ajutăm să le aduci împreună.</p></div>
        </div>
        <div className={styles.promise}><Sparkles aria-hidden /><div><strong>O conversație despre tine</strong><p>Despre planuri, buget și ceea ce contează cu adevărat.</p></div></div>
        <div className={styles.promise}><KeyRound aria-hidden /><div><strong>Un pas potrivit pentru tine</strong><p>Cumperi, închiriezi sau vinzi. Pornim de la nevoile tale.</p></div></div>
        {(agency?.phone || agency?.email) && <div className={styles.direct}>
          <p className={styles.eyebrow}>PREFERI SĂ VORBIM DIRECT?</p>
          {agency?.phone && <a href={`tel:${agency.phone.replace(/[^+\d]/g, '')}`}><Phone size={20} aria-hidden /><span><small>Sună-ne</small>{agency.phone}</span><ArrowUpRight size={19} aria-hidden /></a>}
          {agency?.email && <a href={`mailto:${agency.email}`}><Mail size={20} aria-hidden /><span><small>Scrie-ne</small>{agency.email}</span><ArrowUpRight size={19} aria-hidden /></a>}
        </div>}
      </aside>
      <section className={styles.formCard} aria-label="Formular de contact">
        <div className={styles.formIntro}><div className={styles.formIcon}><MessageCircle aria-hidden /></div><p className={styles.eyebrow}>HAI SĂ VORBIM DESPRE PLANUL TĂU</p><h2>Cu ce te putem ajuta?</h2><p>Câteva detalii sunt suficiente pentru a începe.</p></div>
        {isAgencyLoading || !agencyId ? <p role="status">Se pregătește formularul…</p> : <ContactLeadForm agencyId={agencyId} />}
      </section>
    </div>
    <div className={styles.explore}><p>Încă îți cauți inspirația?</p><Link href={publicPath('/properties')}>Descoperă proprietățile <ArrowUpRight size={18} aria-hidden /></Link></div>
  </div></div>;
}
