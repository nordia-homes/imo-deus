'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, CheckCircle2, Loader2, LockKeyhole, MoveUpRight } from 'lucide-react';
import { submitPublicContact } from '@/app/actions/public-contact';
import { usePublicPath } from '@/context/PublicAgencyContext';
import heroImage from './assets/hero-evening.jpg';
import styles from './AgencyContact.module.css';

export function ContactLeadForm({ agencyId }: { agencyId: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');
  const startedAt = useRef(Date.now());
  const pending = useRef(false);
  const publicPath = usePublicPath();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget);
    pending.current = true; setStatus('sending'); setError('');
    try {
      const result = await submitPublicContact({ agencyId, name: data.get('name'), phone: data.get('phone'), email: data.get('email'), city: data.get('city'), message: data.get('message'), website: data.get('website'), consent: data.get('consent') === 'on', formStartedAt: startedAt.current });
      if (result.success) setStatus('success');
      else { setError(result.message); setStatus('idle'); }
    } catch { setError('Conexiunea a fost întreruptă. Te rugăm să încerci din nou.'); setStatus('idle'); }
    finally { pending.current = false; }
  }
  if (status === 'success') return <div className={styles.success} role="status"><CheckCircle2 size={56} aria-hidden /><p className={styles.eyebrow}>SOLICITARE PRIMITĂ</p><h1>Proprietatea ta.<br /><span>Următorul nostru pas.</span></h1><p>Îți mulțumim! Un consultant te va contacta pentru a discuta despre proprietatea ta și pașii către vânzare.</p><Link href={publicPath()} className={styles.back}>Înapoi la prima pagină <ArrowRight size={18} aria-hidden /></Link></div>;
  return <form onSubmit={submit} className={styles.form} aria-labelledby="owner-contact-title">
    <header className={styles.intro}>
      <div className={styles.visual} aria-hidden="true"><Image src={heroImage} alt="" fill sizes="(max-width: 800px) 100vw, 50vw" priority /></div>
      <div className={styles.introContent}>
        <p className={styles.eyebrow}><span /> PENTRU PROPRIETARII CARE VOR SĂ VÂNDĂ</p>
        <h1 id="owner-contact-title">Vrei să vinzi?<br /><span>Hai să găsim<br className={styles.desktopBreak} /> cumpărătorul.</span></h1>
        <p className={styles.description}>Proprietatea ta merită să fie văzută.<br />Spune-ne unde se află și hai să discutăm despre vânzarea ei.</p>
        <div className={styles.signature}><MoveUpRight size={20} aria-hidden /><span>De la primul contact.<br /><strong>Până la următorul capitol.</strong></span></div>
      </div>
    </header>
    <div className={styles.formBody}>
      <div className={styles.formHeading}><p className={styles.eyebrow}>PRIMUL PAS ÎNCEPE CU TINE</p><h2>Povestește-ne despre<br /> <span>proprietatea ta.</span></h2><p>Lasă-ne datele tale. Revenim pentru o discuție despre vânzare.</p></div>
      <fieldset disabled={status === 'sending'} className={styles.fields}>
        <div className={styles.inputPair}>
          <label>Numele proprietarului <span>*</span><input name="name" autoComplete="name" placeholder="Nume și prenume" minLength={2} maxLength={120} required /></label>
          <label>Telefon <span>*</span><input name="phone" type="tel" autoComplete="tel" placeholder="07xx xxx xxx" minLength={10} maxLength={30} required /></label>
        </div>
        <div className={styles.inputPair}>
          <label>Adresa de email <span>*</span><input name="email" type="email" autoComplete="email" placeholder="nume@exemplu.ro" maxLength={254} required /></label>
          <label>Orașul proprietății <span>*</span><input name="city" autoComplete="off" placeholder="Ex.: București" minLength={2} maxLength={120} required /></label>
        </div>
        <label>Mesaj <small>opțional</small><textarea name="message" rows={3} maxLength={4000} placeholder="Ce proprietate vinzi? Spune-ne zona, tipul locuinței sau orice detaliu pe care îl consideri important." /></label>
        <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
        <label className={styles.consent}><input name="consent" type="checkbox" required /><span>Sunt de acord să fiu contactat despre vânzarea proprietății mele și am citit <Link href={publicPath('/confidentialitate')} target="_blank" rel="noopener noreferrer">politica de confidențialitate</Link>.</span></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button type="submit" className={styles.submit} disabled={status === 'sending'}>{status === 'sending' ? <>Se trimite solicitarea… <Loader2 className="animate-spin" size={21} aria-hidden /></> : <>Vreau să îmi vând proprietatea <ArrowRight size={21} aria-hidden /></>}</button>
        <p className={styles.privacy}><LockKeyhole size={14} aria-hidden />Datele tale sunt folosite pentru a răspunde solicitării.</p>
      </fieldset>
    </div>
  </form>;
}

