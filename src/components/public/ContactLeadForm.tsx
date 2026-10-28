'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, CheckCircle2, Loader2, LockKeyhole } from 'lucide-react';
import { submitPublicContact } from '@/app/actions/public-contact';
import { usePublicPath } from '@/context/PublicAgencyContext';
import styles from './AgencyContact.module.css';

export function ContactLeadForm({ agencyId }: { agencyId: string }) {
  const [intent, setIntent] = useState('Cumpărare');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [error, setError] = useState('');
  const startedAt = useRef(Date.now());
  const pending = useRef(false);
  const publicPath = usePublicPath();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setStatus('sending'); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await submitPublicContact({ agencyId, intent, name: data.get('name'), phone: data.get('phone'), email: data.get('email'), message: data.get('message'), website: data.get('website'), consent: data.get('consent') === 'on', formStartedAt: startedAt.current });
      if (result.success) setStatus('success');
      else { setError(result.message); setStatus('idle'); }
    } catch { setError('Conexiunea a fost întreruptă. Te rugăm să încerci din nou.'); setStatus('idle'); }
    finally { pending.current = false; }
  }
  if (status === 'success') return <div className={styles.success} role="status"><CheckCircle2 size={48} aria-hidden /><h3>Primul pas e făcut.</h3><p>Am primit solicitarea ta. Un consultant te va contacta folosind datele completate.</p><Link href={publicPath('/properties')} className={styles.submit}>Explorează proprietățile <ArrowRight size={18} aria-hidden /></Link></div>;
  return <form onSubmit={submit} className={styles.form}>
    <fieldset disabled={status === 'sending'} className={styles.fields}>
      <fieldset className={styles.intents}><legend>Mă interesează</legend><div>{['Cumpărare', 'Închiriere', 'Vânzare', 'Altă solicitare'].map(value => <label key={value}><input type="radio" name="intent" value={value} checked={intent === value} onChange={() => setIntent(value)} /><span>{intent === value && <Check size={14} aria-hidden />}{value}</span></label>)}</div></fieldset>
      <div className={styles.formDivider}><span>Datele tale de contact</span><span>* obligatoriu</span></div>
      <div className={styles.inputPair}>
        <label>Nume complet *<input name="name" autoComplete="name" placeholder="Numele tău" minLength={2} maxLength={120} required /></label>
        <label>Telefon *<input name="phone" type="tel" autoComplete="tel" placeholder="07xx xxx xxx" minLength={10} maxLength={30} required /></label>
      </div>
      <label>Email *<input name="email" type="email" autoComplete="email" placeholder="nume@exemplu.ro" maxLength={254} required /></label>
      <label>Ce ai în minte? <small>opțional</small><textarea name="message" rows={4} maxLength={4000} placeholder={intent === 'Vânzare' ? 'Povestește-ne despre proprietatea ta: zonă, suprafață și ce îți dorești…' : 'O zonă preferată, un buget, un anumit tip de locuință…'} /></label>
      <div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <label className={styles.consent}><input name="consent" type="checkbox" required /><span>Sunt de acord să fiu contactat în legătură cu solicitarea mea și am citit <Link href={publicPath('/confidentialitate')} target="_blank" rel="noopener noreferrer">politica de confidențialitate</Link>.</span></label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" className={styles.submit} disabled={status === 'sending'}>{status === 'sending' ? <>Se trimite… <Loader2 className="animate-spin" size={20} aria-hidden /></> : <>Hai să facem primul pas <ArrowRight size={20} aria-hidden /></>}</button>
      <p className={styles.privacy}><LockKeyhole size={14} aria-hidden />Datele tale sunt folosite pentru a răspunde solicitării.</p>
    </fieldset>
  </form>;
}
