'use client';

import Link from 'next/link';
import { ArrowRight, BadgeCheck, Camera, ChartColumn, FileSearch, Handshake, MessageCircle, ShieldCheck, ChevronDown } from 'lucide-react';
import { usePublicAgency, usePublicPath } from '@/context/PublicAgencyContext';
import styles from '@/components/public/AgencyOwners.module.css';

const ownersIntroVideoUrl = 'https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/Video%20introducere%20pentru%20proprietari.mp4?alt=media&token=f4163f0e-2265-4d02-b2ef-3f3a70fa2c48';
const services = [
  { icon: ChartColumn, title: 'Prețul potrivit. De la început.', text: 'Analizăm proprietatea, concurența și ritmul pieței pentru o poziționare competitivă și credibilă.' },
  { icon: Camera, title: 'O prezentare care atrage.', text: 'Fotografii bune, informații clare și promovare care pun în valoare ceea ce face proprietatea ta specială.' },
  { icon: BadgeCheck, title: 'Interes real, timp câștigat.', text: 'Discutăm cu potențialii clienți și organizăm vizionările în funcție de nevoile și interesul lor.' },
  { icon: MessageCircle, title: 'Știi mereu ce urmează.', text: 'Primești feedback și explicații la fiecare pas important. Rămâi conectat la evoluția colaborării.' },
  { icon: Handshake, title: 'Negociere cu argumente.', text: 'Gestionăm ofertele și susținem valoarea proprietății tale în discuțiile cu potențialii cumpărători.' },
  { icon: FileSearch, title: 'Alături de tine, până la semnare.', text: 'Coordonăm documentele, comunicarea dintre părți și pașii care duc la încheierea tranzacției.' },
];
const steps = [
  { title: 'Ne cunoaștem.', text: 'Discutăm despre proprietate, obiectivele tale și intervalul în care vrei să vinzi sau să închiriezi.' },
  { title: 'Pregătim lansarea.', text: 'Stabilim poziționarea, pregătim prezentarea și alegem direcția de promovare.' },
  { title: 'Aducem oamenii potriviți.', text: 'Gestionăm solicitările, organizăm vizionările și discutăm ofertele împreună.' },
  { title: 'Facem pasul final.', text: 'Te sprijinim în negociere și coordonăm pașii către semnarea documentelor.' },
];
const questions = [
  { title: 'Cum stabilim prețul proprietății?', text: 'Analizăm caracteristicile proprietății, oferta concurentă și ritmul pieței. Discutăm împreună un preț de pornire argumentat, nu doar prețurile cerute pentru alte anunțuri.' },
  { title: 'Cum sunt organizate vizionările?', text: 'Clarificăm nevoile potențialilor clienți înainte de vizionare și stabilim programările împreună cu tine. După vizionări, îți comunicăm feedbackul primit.' },
  { title: 'Mă puteți ajuta și cu închirierea?', text: 'Da. Discutăm obiectivul tău și adaptăm prezentarea, promovarea și selecția clienților pentru închiriere.' },
  { title: 'Ce presupune colaborarea?', text: 'Începem cu o discuție despre proprietate. Stabilim serviciile, condițiile și pașii colaborării înainte de a porni promovarea, astfel încât să știi la ce să te aștepți.' },
];

export default function AgencyOwnersPage() {
  const { agency } = usePublicAgency();
  const publicPath = usePublicPath();
  return <div className={styles.page}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>PENTRU PROPRIETARI · {agency?.name || 'NORDIA'}</p>
        <h1>Proprietatea ta.<br /><span>Prioritatea noastră.</span></h1>
        <p className={styles.lead}>Un nou capitol începe cu un partener potrivit. De la preț și promovare, până la negociere și semnare, suntem alături de tine.</p>
        <Link className={styles.primary} href={publicPath('/contact')}>Vreau să îmi vând proprietatea <ArrowRight size={20} aria-hidden /></Link>
        <a className={styles.textLink} href="#servicii-proprietari">Descoperă cum te ajutăm <ChevronDown size={17} aria-hidden /></a>
      </div>
      <div className={styles.videoWrap}>
        <div className={styles.videoTop}><span className={styles.dot} /><span>OAMENI. PROPRIETĂȚI. ÎNCREDERE.</span></div>
        <video className={styles.video} src={ownersIntroVideoUrl} preload="metadata" playsInline controls aria-label="Prezentarea serviciilor pentru proprietari" />
        <p>Fă cunoștință cu felul nostru de a lucra.</p>
      </div>
    </section>
    <div className={styles.trustStrip}>
      <span><ChartColumn aria-hidden />Strategie de preț</span><span><Camera aria-hidden />Promovare atentă</span><span><Handshake aria-hidden />Reprezentare dedicată</span>
    </div>
    <section className={styles.section} id="servicii-proprietari" aria-labelledby="services-title">
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>CE FACEM PENTRU TINE</p><h2 id="services-title">Fiecare proprietate are o poveste.<br /><span>Noi o punem în valoare.</span></h2><p>Un proces complet, construit în jurul proprietății și obiectivelor tale.</p></header>
      <div className={styles.services}>{services.map(({icon: Icon,title,text}) => <article key={title}><Icon aria-hidden /><h3>{title}</h3><p>{text}</p></article>)}</div>
      <div className={styles.assurance}><ShieldCheck size={30} aria-hidden /><div><h3>Mai multă claritate. Mai puțin stres.</h3><p>Îți explicăm opțiunile, documentele și aspectele la care merită să fii atent, pentru decizii informate.</p></div></div>
    </section>
    <section className={styles.process} aria-labelledby="process-title">
      <div className={styles.processInner}>
        <header className={styles.processHeading}><p className={styles.eyebrow}>CUM LUCRĂM ÎMPREUNĂ</p><h2 id="process-title">De la prima discuție.<br /><span>Până la cheile predate.</span></h2><p>Comunicare simplă, pași clari și un consultant care cunoaște povestea proprietății tale.</p><Link className={styles.textLink} href={publicPath('/contact')}>Hai să vorbim <ArrowRight size={18} aria-hidden /></Link></header>
        <ol className={styles.steps}>{steps.map(step => <li key={step.title}><span className={styles.stepDot} aria-hidden /><div><h3>{step.title}</h3><p>{step.text}</p></div></li>)}</ol>
      </div>
    </section>
    <section className={styles.section} aria-labelledby="questions-title">
      <header className={styles.sectionHeading}><p className={styles.eyebrow}>ÎNTREBĂRI FIREȘTI. RĂSPUNSURI CLARE.</p><h2 id="questions-title">Începem cu încredere.</h2></header>
      <div className={styles.questions}>{questions.map(question => <details key={question.title}><summary>{question.title}<ChevronDown size={20} aria-hidden /></summary><p>{question.text}</p></details>)}</div>
    </section>
    <section className={styles.finalCta}>
      <p className={styles.eyebrow}>URMĂTORUL CAPITOL AL PROPRIETĂȚII TALE</p>
      <h2>Tu ai proprietatea.<br /><span>Împreună facem următorul pas.</span></h2>
      <p>Spune-ne unde se află și ce îți dorești. Începem cu o conversație.</p>
      <Link className={styles.primary} href={publicPath('/contact')}>Hai să discutăm despre vânzare <ArrowRight size={20} aria-hidden /></Link>
    </section>
  </div>;
}
