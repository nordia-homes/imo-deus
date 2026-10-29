'use client';

import Link from 'next/link';
import { ArrowRight, Gift, BadgeCheck, KeyRound, Heart, ChevronDown } from 'lucide-react';
import { usePublicPath } from '@/context/PublicAgencyContext';
import styles from '@/components/public/AgencyOwners.module.css';
import offer from '@/components/public/ZeroNotaryFees.module.css';

export default function ZeroNotaryFeesPage() {
  const publicPath = usePublicPath();
  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>UN CADOU PENTRU NOUL TĂU ACASĂ</p>
        <h1>Tu alegi casa.<br /><span>Taxele notariale?<br />Cadou.</span></h1>
        <p className={styles.lead}>Un început frumos merită mai mult loc în bugetul tău. Pentru proprietățile incluse în ofertă, taxele notariale ale cumpărătorului sunt oferite cadou.</p>
        <Link className={styles.primary} href={publicPath('/properties')}>Descoperă proprietățile <ArrowRight size={20} aria-hidden /></Link>
        <a className={styles.textLink} href="#cum-functioneaza">Cum funcționează oferta <ChevronDown size={18} aria-hidden /></a>
      </div>
      <div className={offer.giftCard}>
        <Gift size={44} strokeWidth={1.2} aria-hidden />
        <p className={styles.eyebrow}>ZERO TAXE NOTARIALE</p>
        <div className={offer.zero}>0<span>lei</span></div>
        <h2>Mai mult pentru<br /><span>viața de acasă.</span></h2>
        <p>Taxele notariale ale cumpărătorului, oferite cadou la proprietățile participante.</p>
        <span className={offer.badge}>taxe notariale zero</span>
      </div>
    </section>
    <div className={styles.trustStrip}><span><Gift aria-hidden />Un cadou la cumpărare</span><span><BadgeCheck aria-hidden />Proprietăți marcate în ofertă</span><span><Heart aria-hidden />Un început cu mai puține griji</span></div>
    <section className={styles.section} id="cum-functioneaza">
      <div className={styles.sectionHeading}><p className={styles.eyebrow}>DE LA PRIMA VIZIONARE LA CHEILE TALE</p><h2>Casa potrivită.<br /><span>Un beneficiu în plus.</span></h2></div>
      <div className={styles.services}>
        <article><BadgeCheck aria-hidden /><h3>Caută eticheta verde.</h3><p>Pe fotografia anunțului, eticheta „taxe notariale zero” îți arată că proprietatea participă la ofertă.</p></article>
        <article><Heart aria-hidden /><h3>Hai să o vezi.</h3><p>Contactează agentul din anunț, programează o vizionare și discută detaliile ofertei pentru locuința aleasă.</p></article>
        <article><KeyRound aria-hidden /><h3>Bucură-te de noul început.</h3><p>La cumpărarea proprietății participante, beneficiezi de taxele notariale oferite cadou, conform condițiilor stabilite pentru tranzacția ta.</p></article>
      </div>
    </section>
    <section className={styles.section}>
      <div className={styles.sectionHeading}><p className={styles.eyebrow}>TOTUL CLAR, DE LA ÎNCEPUT</p><h2>Întrebările tale, <span>pe scurt.</span></h2></div>
      <div className={styles.questions}>
        <details><summary>Toate proprietățile au zero taxe notariale?<ChevronDown aria-hidden /></summary><p>Oferta se aplică doar proprietăților marcate explicit cu eticheta verde „taxe notariale zero” pe pagina anunțului.</p></details>
        <details><summary>Cui îi este oferit acest cadou?<ChevronDown aria-hidden /></summary><p>Cumpărătorului unei proprietăți participante. Agentul îți explică beneficiul și condițiile aplicabile proprietății pe care o alegi.</p></details>
        <details><summary>Cum aflu ce costuri sunt acoperite?<ChevronDown aria-hidden /></summary><p>Discută cu agentul proprietății înainte de semnare. Veți clarifica sumele acoperite și condițiile ofertei pentru tranzacția ta, inclusiv situația unei achiziții prin credit.</p></details>
      </div>
    </section>
    <section className={styles.finalCta}><p className={styles.eyebrow}>ACASĂ ÎNCEPE CU NOI</p><h2>Un nou capitol.<br /><span>Un cadou pentru tine.</span></h2><p>Explorează anunțurile și caută eticheta verde pe proprietatea care te atrage.</p><Link className={styles.primary} href={publicPath('/properties')}>Îmi caut noua casă <ArrowRight size={20} aria-hidden /></Link></section>
  </div>;
}
