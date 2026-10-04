import Link from 'next/link';
import { ArrowUpRight, BookOpen, Check, FileText, Phone, ShieldCheck, Wallet } from 'lucide-react';

import { steps, problems } from './whatsapp-connection-guide-content';

type Props = { admin: boolean; onConnect: () => void; onTemplates: () => void; onBudget: () => void };
const phases = [
  { id: 'wa-guide-prepare', title: 'Pregătește agenția', range: 'Pașii 01–04', from: 0, to: 4 },
  { id: 'wa-guide-connect', title: 'Conectează numărul', range: 'Pașii 05–08', from: 4, to: 8 },
  { id: 'wa-guide-activate', title: 'Configurează trimiterea', range: 'Pașii 09–12', from: 8, to: 12 },
  { id: 'wa-guide-verify', title: 'Prima conversație în CRM', range: 'Pașii 13–14', from: 12, to: 14 },
];
function instruction(text: string) { return text.split(/(„[^”]+”)/g).map((part, index) => part.startsWith("„") ? <strong key={index}>{part}</strong> : part); }

export default function WhatsAppConnectionGuide({ admin, onConnect, onTemplates, onBudget }: Props) {
  return <section className="wa-panel wa-connection-guide" aria-labelledby="wa-connection-guide-title">
    <header className="wa-connection-guide-header">
      <span className="wa-icon"><BookOpen size={22} aria-hidden="true" /></span>
      <div><span className="wa-eyebrow">DE LA ZERO · META + CRM</span>
        <h2 id="wa-connection-guide-title">Conectează WhatsApp, pas cu pas.</h2>
        <p>Urmează fiecare click și completează câmpurile indicate. La verificarea telefonului, deschide instrucțiunile pentru număr dedicat sau WhatsApp Business App.</p>
      </div>
    </header>
    <div className="wa-connection-checklist"><strong>Ai nevoie de</strong>
      <span><ShieldCheck size={16} aria-hidden="true" /> Administrator CRM + acces Meta</span>
      <span><Phone size={16} aria-hidden="true" /> Numărul agenției + un al doilea telefon</span>
      <span><FileText size={16} aria-hidden="true" /> Datele firmei + e-mail de business</span>
    </div>
    {!admin && <p className="wa-connection-access-note"><strong>Configurarea necesită un administrator CRM.</strong> Poți parcurge ghidul; cere administratorului agenției să conecteze numărul, să configureze bugetul și să înregistreze acordul clientului.</p>}
    <div className="wa-connection-shortcuts" aria-label="Acțiuni pentru conectarea WhatsApp">
      {admin && <button className="wa-btn wa-primary" onClick={onConnect}><Phone size={16} aria-hidden="true" /> Conectează număr</button>}
      <a className="wa-btn" href="https://business.facebook.com/" target="_blank" rel="noopener noreferrer">Meta Business Suite <ArrowUpRight size={16} aria-hidden="true" /><span className="wa-visually-hidden"> (filă nouă)</span></a>
      <a className="wa-btn" href="https://business.facebook.com/wa/manage/" target="_blank" rel="noopener noreferrer">WhatsApp Manager <ArrowUpRight size={16} aria-hidden="true" /><span className="wa-visually-hidden"> (filă nouă)</span></a>
      <button className="wa-btn" onClick={onBudget}><Wallet size={16} aria-hidden="true" /> Consum și buget</button>
      <button className="wa-btn" onClick={onTemplates}><FileText size={16} aria-hidden="true" /> Șabloane</button>
      <Link className="wa-btn" href="/inbox"><Check size={16} aria-hidden="true" /> Deschide Inbox</Link>
    </div>
    <nav className="wa-connection-phase-nav" aria-label="Etapele ghidului WhatsApp">{phases.map((phase, index) =>
      <a key={phase.id} href={'#' + phase.id}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{phase.title}</strong><small>{phase.range}</small></div></a>
    )}</nav>
    <p className="wa-connection-resume">Ai deja numărul conectat? Verifică întâi rezultatul la <a href="#wa-guide-step-8">pasul 8</a>, apoi continuă configurarea. Meta poate cere numărul înaintea portofoliului: pașii 6 și 7 îți arată ce să faci pentru fiecare ecran. Butoanele pot apărea în română sau engleză.</p>
    {phases.map(phase => <section className="wa-connection-phase" key={phase.id} aria-labelledby={phase.id}>
      <h3 id={phase.id}><span>{phase.range}</span>{phase.title}</h3>
      <ol className="wa-connection-steps" start={phase.from + 1}>{steps.slice(phase.from, phase.to).map((step, offset) => {
        const number = phase.from + offset + 1;
        return <li key={step.title} id={'wa-guide-step-' + number}>
          <span className="wa-connection-step-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>
          <div className="wa-connection-step-content"><span className="wa-connection-step-place">{step.place}</span><h4>{step.title}</h4>
            <div className="wa-connection-step-layout"><div>
                {step.branches && <><p className="wa-connection-branch-intro">{instruction(step.actions[0])}</p><div className="wa-connection-branches">{step.branches.map(branch => <details className="wa-connection-branch" key={branch.title}><summary>{branch.title}</summary><ol className="wa-connection-actions">{branch.actions.map(action => <li key={action}>{instruction(action)}</li>)}</ol></details>)}</div><p className="wa-connection-branch-intro"><strong>După verificarea telefonului, continuă aici:</strong></p></>}
                <ol className="wa-connection-actions" start={step.branches ? 2 : 1}>{(step.branches ? step.actions.slice(1) : step.actions).map(action => <li key={action}>{instruction(action)}</li>)}</ol>
              </div>
              <aside className="wa-connection-result"><strong><Check size={16} aria-hidden="true" /> Înainte să continui</strong><p>{step.result}</p>{step.note && <p className="wa-connection-step-hint">{step.note}</p>}</aside>
            </div>
          </div>
        </li>;
      })}</ol>
    </section>)}

    <section className="wa-connection-troubleshooting" aria-labelledby="wa-guide-help-title"><h3 id="wa-guide-help-title">Dacă te blochezi, începe de aici.</h3>
      <div>{problems.map(([title, body]) => <details className="wa-connection-help" key={title}><summary>{title}</summary><p>{body}</p></details>)}</div>
    </section>
    <p className="wa-connection-source">Documentație oficială: <a href="https://www.facebook.com/business/help/1710077379203657" target="_blank" rel="noopener noreferrer">Portofoliu Meta</a> · <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/default-flow" target="_blank" rel="noopener noreferrer">Ecranele de conectare</a> · <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/" target="_blank" rel="noopener noreferrer">Conectarea Business App</a> · <a href="https://business.whatsapp.com/policy" target="_blank" rel="noopener noreferrer">Politica oficială WhatsApp Business<span className="wa-visually-hidden"> (filă nouă)</span></a>.</p>
  </section>;
}
