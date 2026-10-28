'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Calculator, Download, X } from 'lucide-react';
import { calculatePublicNotaryFees, type NotaryInputs } from '@/lib/public-notary';
import styles from './PublicNotaryCalculator.module.css';

let rateRequest: Promise<{ rate: number; fallback: boolean }> | undefined;
function getRate() {
  if (!rateRequest) {
    rateRequest = fetch('https://api.exchangerate-api.com/v4/latest/EUR', { signal: AbortSignal.timeout(8000) })
      .then(async response => {
        if (!response.ok) throw new Error('Curs indisponibil');
        const data = await response.json();
        const rate = Number(data.rates?.RON);
        if (!Number.isFinite(rate) || rate <= 0) throw new Error('Curs invalid');
        return { rate, fallback: false };
      }).catch(() => ({ rate: 5, fallback: true }));
  }
  return rateRequest;
}
const lei = (value: number) => `${value.toLocaleString('ro-RO')} lei`;

export function PublicNotaryCalculator({ price, trigger }: { price: number; trigger?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    {trigger ? <Dialog.Trigger asChild>{trigger}</Dialog.Trigger> : <Dialog.Trigger className={styles.trigger}><Calculator size={18} aria-hidden />Evaluează taxele notariale</Dialog.Trigger>}
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content className={styles.modal}>
        <header className={styles.header}>
          <Dialog.Title className={styles.title}>Taxele pentru noul tău acasă</Dialog.Title>
          <Dialog.Description className={styles.subtitle}>Calculator de taxe notariale pentru vânzare și cumpărare</Dialog.Description>
          <Dialog.Close className={styles.close} aria-label="Închide calculatorul"><X size={24} aria-hidden /></Dialog.Close>
        </header>
        <div className={styles.scroll}><CalculatorForm price={price} /></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

function CalculatorForm({ price }: { price: number }) {
  const id = useId();
  const [rate, setRate] = useState({ rate: 5, fallback: false, loading: true });
  const [mortgage, setMortgage] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculatePublicNotaryFees> | null>(null);
  const [error, setError] = useState('');
  const [calculatedInputs, setCalculatedInputs] = useState<NotaryInputs | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const resultRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [result]);
  useEffect(() => {
    let active = true;
    getRate().then(value => { if (active) setRate({ ...value, loading: false }); });
    return () => { active = false; };
  }, []);
  return <div className={styles.layout}>
    <form className={styles.form} onChange={() => { setResult(null); setCalculatedInputs(null); setError(''); setExportError(''); }} onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      try {
        const inputs: NotaryInputs = {
          price: Number(data.get('price')), currency: data.get('currency') as NotaryInputs['currency'], exchangeRate: rate.rate,
          ownershipDuration: data.get('ownershipDuration') as NotaryInputs['ownershipDuration'],
          buyerType: data.get('buyerType') as NotaryInputs['buyerType'], sellerType: data.get('sellerType') as NotaryInputs['sellerType'],
          mortgage, mortgageValue: Number(data.get('mortgageValue')), mortgageCurrency: data.get('mortgageCurrency') as NotaryInputs['mortgageCurrency'],
        };
        setResult(calculatePublicNotaryFees(inputs));
        setCalculatedInputs(inputs);
        setError('');
      } catch { setError('Introdu un preț valid pentru a calcula taxele.'); }
    }}>
      <div className={styles.pair}>
        <label className={styles.field}>Prețul proprietății<input name="price" type="number" inputMode="decimal" min="0.01" step="any" required defaultValue={price > 0 ? price : ''} /></label>
        <label className={styles.field}>Monedă<select name="currency" defaultValue="eur"><option value="eur">EUR</option><option value="ron">Lei</option></select></label>
      </div>
      <p className={styles.rate}>{rate.loading ? 'Se încarcă cursul valutar…' : `Curs utilizat: 1 EUR = ${rate.rate.toLocaleString('ro-RO', { maximumFractionDigits: 6 })} lei${rate.fallback ? ' · curs de rezervă, ca în calculatorul notarului' : ''}`}</p>
      <label className={styles.field}>Perioada de deținere a proprietății<select name="ownershipDuration" defaultValue="over3"><option value="over3">Peste 3 ani</option><option value="under3">Sub 3 ani</option></select></label>
      <label className={styles.field}>Cumpărător<select name="buyerType" defaultValue="individual"><option value="individual">Persoană fizică</option><option value="company">Persoană juridică</option></select></label>
      <label className={styles.field}>Vânzător<select name="sellerType" defaultValue="individual"><option value="individual">Persoană fizică</option><option value="company">Persoană juridică</option></select></label>
      <label className={styles.field}>Achiziție cu ipotecă<select value={mortgage ? 'yes' : 'no'} onChange={event => setMortgage(event.target.value === 'yes')}><option value="no">Nu</option><option value="yes">Da</option></select></label>
      {mortgage && <div className={styles.pair}>
        <label className={styles.field}>Valoarea ipotecii<input name="mortgageValue" type="number" inputMode="decimal" min="0.01" step="any" required /></label>
        <label className={styles.field}>Monedă<select name="mortgageCurrency" defaultValue="eur"><option value="eur">EUR</option><option value="ron">Lei</option></select></label>
      </div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.submit} type="submit" disabled={rate.loading} aria-controls={`${id}-result`}>{rate.loading ? 'Se pregătește calculatorul…' : 'Calculează taxele notariale'}</button>
    </form>
    <section ref={resultRef} className={styles.results} id={`${id}-result`} aria-live="polite" aria-atomic="true">
      <h3>Estimarea costurilor</h3>
      {result ? <>
        <dl>
          <div className={styles.row}><dt>Onorariu notarial vânzare, cu TVA</dt><dd>{lei(result.notaryFee)}</dd></div>
          <div className={styles.row}><dt>Taxă ANCPI vânzare</dt><dd>{lei(result.ancpiFee)}</dd></div>
          <div className={styles.row}><dt>Impozit vânzător</dt><dd>{lei(result.saleTax)}</dd></div>
          {mortgage && <>
            <div className={styles.row}><dt>Onorariu ipotecă, cu TVA</dt><dd>{lei(result.mortgageNotaryFee)}</dd></div>
            <div className={styles.row}><dt>Taxă ANCPI ipotecă</dt><dd>{lei(result.mortgageAncpiFee)}</dd></div>
          </>}
          <div className={styles.row}><dt>Extras de autentificare</dt><dd>{lei(result.authenticationFee)}</dd></div>
        </dl>
        <div className={styles.total}><span>Total estimat al tranzacției</span><strong>{lei(result.totalFees)}</strong><span className={styles.note}>Include impozitul datorat de vânzător.</span></div>
        <button type="button" className={styles.exportButton} disabled={exporting || !calculatedInputs} onClick={async () => {
          if (!calculatedInputs || exporting) return;
          setExporting(true);
          setExportError('');
          try {
            const { downloadNotaryPdf } = await import('@/lib/notary-pdf');
            await downloadNotaryPdf(calculatedInputs, rate.fallback);
          } catch { setExportError('PDF-ul nu a putut fi generat. Încearcă din nou.'); }
          finally { setExporting(false); }
        }}><Download size={18} aria-hidden />{exporting ? 'Se generează PDF-ul…' : 'Exportă PDF'}</button>
        {exportError && <p role="alert" className={styles.error}>{exportError}</p>}
      </> : <p className={styles.note}>Prețul din anunț este completat automat. Alege situația tranzacției și calculează costurile, inclusiv cele ale ipotecii, dacă este cazul.</p>}
      <p className={styles.note}>Estimare după <a href="https://notar-bucuresti.ro/calculator-taxe-notariale-vanzare/" target="_blank" rel="noopener noreferrer">calculatorul notarului</a>, cu TVA de 19% inclus în onorarii, conform formulelor acestuia. Sumele finale se confirmă cu notarul.</p>
    </section>
  </div>;
}
