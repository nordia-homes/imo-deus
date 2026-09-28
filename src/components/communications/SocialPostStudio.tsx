'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { CalendarClock, Check, ChevronLeft, ChevronRight, Facebook, Image as ImageIcon, Instagram, RotateCcw, Search, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { bucharestLocalToIso, defaultBucharestScheduleInput } from '@/lib/bucharest-time';
import type { Connection } from '@/lib/communications/model';
import './social-post-studio.css';

export type SocialPropertySummary = { id: string; title: string; location: string; thumbnailUrl: string | null };
type SocialProperty = { id: string; title: string; description: string; location: string; price: number | null; images: string[] };
type Props = {
  properties: SocialPropertySummary[];
  connections: Connection[];
  initialPropertyId: string;
  admin: boolean;
  api: (path: string, method?: string, body?: unknown) => Promise<any>;
  onSaved: () => Promise<void>;
};
const maxLength = 2200;
function propertyCaption(property: SocialProperty) {
  const description = property.description.trim().replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ');
  if (description) return description.slice(0, maxLength);
  return [property.title, property.location].filter(Boolean).join('\n');
}
function destinationLabel(connection: Connection) { return connection.channel === 'instagram' ? 'Instagram' : 'Facebook'; }

export default function SocialPostStudio({ properties, connections, initialPropertyId, admin, api, onSaved }: Props) {
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [property, setProperty] = useState<SocialProperty | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const [loadingProperty, setLoadingProperty] = useState(Boolean(initialPropertyId));
  const [captionEdit, setCaptionEdit] = useState<string | null>(null);
  const [photoEdit, setPhotoEdit] = useState<string[] | null>(null);
  const [targets, setTargets] = useState<string[]>([]);
  const [preview, setPreview] = useState<'facebook' | 'instagram'>('facebook');
  const [previewIndex, setPreviewIndex] = useState(0);
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [schedule, setSchedule] = useState(defaultBucharestScheduleInput);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!propertyId) return;
    let live = true;
    void api('properties/' + encodeURIComponent(propertyId)).then(value => {
      if (live) setProperty(value.property as SocialProperty);
    }).catch(err => { if (live) setError(err instanceof Error ? err.message : 'Proprietatea nu a putut fi încărcată.'); })
      .finally(() => { if (live) setLoadingProperty(false); });
    return () => { live = false; };
  }, [api, propertyId]);
  const selectedProperty = property?.id === propertyId ? property : null;
  const caption = captionEdit ?? (selectedProperty ? propertyCaption(selectedProperty) : '');
  const photos = photoEdit ?? selectedProperty?.images.slice(0, 10) ?? [];
  const visiblePhotoIndex = Math.min(previewIndex, Math.max(0, photos.length - 1));
  const eligible = connections.filter(c => c.status === 'connected' && (c.channel === 'messenger' || c.channel === 'instagram'));
  const selectedTargets = eligible.filter(c => targets.includes(c.id));
  const filteredProperties = useMemo(() => properties.filter(p => (p.title + ' ' + p.location).toLocaleLowerCase('ro-RO').includes(propertySearch.toLocaleLowerCase('ro-RO'))), [properties, propertySearch]);
  const previewAccount = selectedTargets.find(c => c.channel === (preview === 'instagram' ? 'instagram' : 'messenger')) || eligible.find(c => c.channel === (preview === 'instagram' ? 'instagram' : 'messenger'));
  const wantsInstagram = selectedTargets.some(c => c.channel === 'instagram');
  const ready = Boolean(admin && selectedProperty && caption.trim().length && caption.length <= maxLength && selectedTargets.length > 0 && selectedTargets.length === targets.length && selectedTargets.every(c => c.capabilities.publish?.status === 'active') && (!wantsInstagram || photos.length) && !busy && !loadingProperty);
  function chooseProperty(id: string) {
    setPropertyId(id); setProperty(null); setCaptionEdit(null); setPhotoEdit(null); setPreviewIndex(0); setLoadingProperty(Boolean(id)); setError('');
  }
  function togglePhoto(url: string) {
    if (photos.includes(url)) { setPhotoEdit(photos.filter(item => item !== url)); return; }
    if (photos.length >= 10) { setError('Poți selecta cel mult 10 fotografii.'); return; }
    setPhotoEdit([...photos, url]); setError('');
  }
  function movePhoto(index: number, direction: -1 | 1) {
    const next = [...photos]; const other = index + direction;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]]; setPhotoEdit(next);
  }
  function toggleTarget(id: string) {
    setTargets(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  async function save(draft: boolean) {
    if (!ready || !selectedProperty) return;
    let scheduledAt: string | undefined;
    if (scheduleMode === 'later') {
      scheduledAt = bucharestLocalToIso(schedule.date, schedule.time) || undefined;
      if (!scheduledAt || Date.parse(scheduledAt) < Date.now() + 60_000) { setError('Alege o dată și o oră viitoare valide pentru București.'); return; }
    }
    setBusy(true); setError('');
    try {
      await api('posts', 'POST', { requestId: crypto.randomUUID(), propertyId, connectionIds: targets, text: caption.trim(), imageUrls: photos, draft, ...(scheduledAt ? { scheduledAt } : {}) });
      await onSaved();
    } catch (err) { setError(err instanceof Error ? err.message : 'Postarea nu a putut fi salvată.'); }
    finally { setBusy(false); }
  }
  return <div className="mi-studio">
    <div className="mi-studio-heading"><span className="tt-eyebrow"><Sparkles size={14} />STUDIO DE POSTĂRI</span><h2>O postare nouă, <em>gata de publicare.</em></h2><p>Alege proprietatea, adaptează textul și fotografiile, apoi verifică postarea înainte de publicare.</p></div>
    {error && <div role="alert" className="mi-studio-error">{error}</div>}
    <div className="mi-studio-layout">
      <div className="mi-studio-editor">
        <section className="tt-panel mi-studio-panel"><div className="mi-studio-step"><span>01</span><div><h3>Proprietatea</h3><p>Alege anunțul pe care îl vei prezenta.</p></div></div>
          <label className="mi-studio-search"><Search size={17} /><input value={propertySearch} onChange={event => setPropertySearch(event.target.value)} placeholder="Caută după titlu sau zonă" aria-label="Caută proprietăți" /></label>
          <div className="mi-property-list" role="radiogroup" aria-label="Proprietate pentru postare">
            {!filteredProperties.length && <p className="mi-studio-empty">Nu am găsit proprietăți active.</p>}
            {filteredProperties.map(item => <button type="button" role="radio" aria-checked={propertyId === item.id} key={item.id} className={'mi-property-option' + (propertyId === item.id ? ' mi-property-option--selected' : '')} onClick={() => chooseProperty(item.id)}><span className="mi-property-thumb">{item.thumbnailUrl ? <Image src={item.thumbnailUrl} alt="" width={138} height={106} unoptimized /> : <ImageIcon size={23} />}</span><span className="mi-property-copy"><strong>{item.title}</strong><small>{item.location || 'Locație nespecificată'}</small></span><span className="mi-property-check">{propertyId === item.id && <Check size={16} />}</span></button>)}
          </div>
          {loadingProperty && <p className="mi-studio-hint">Se încarcă fotografiile și descrierea...</p>}
        </section>
        <section className="tt-panel mi-studio-panel"><div className="mi-studio-step"><span>02</span><div><h3>Textul postării</h3><p>Descrierea proprietății este preluată automat și rămâne editabilă.</p></div></div>
          <Textarea aria-label="Textul postării" className="mi-caption-input" rows={9} maxLength={maxLength} value={caption} onChange={event => setCaptionEdit(event.target.value)} placeholder={selectedProperty ? 'Scrie un text pentru această proprietate...' : 'Alege mai întâi o proprietate'} disabled={!selectedProperty} />
          <div className="mi-studio-field-footer"><span>{caption.length} / {maxLength} caractere</span><Button variant="ghost" size="sm" disabled={!selectedProperty || captionEdit === null} onClick={() => setCaptionEdit(null)}><RotateCcw size={14} />Preia din nou descrierea</Button></div>
        </section>
        <section className="tt-panel mi-studio-panel"><div className="mi-studio-step"><span>03</span><div><h3>Fotografii</h3><p>Alege până la 10 imagini. Ordinea de mai jos este ordinea din postare.</p></div></div>
          {!selectedProperty && <p className="mi-studio-empty">Fotografiile apar după alegerea proprietății.</p>}
          {selectedProperty && !selectedProperty.images.length && <p className="mi-studio-empty">Această proprietate nu are fotografii disponibile pentru publicare.</p>}
          {selectedProperty && <div className="mi-photo-grid">{selectedProperty.images.map((url, index) => <button type="button" key={url + index} className={'mi-photo-option' + (photos.includes(url) ? ' mi-photo-option--selected' : '')} onClick={() => togglePhoto(url)} aria-label={'Fotografia ' + (index + 1) + (photos.includes(url) ? ', selectată' : ', neselectată')} aria-pressed={photos.includes(url)}><Image src={url} alt={'Fotografia ' + (index + 1) + ' a proprietății'} width={240} height={200} unoptimized /><span>{photos.includes(url) ? photos.indexOf(url) + 1 : '+'}</span></button>)}</div>}
          {!!photos.length && <div className="mi-photo-order">{photos.map((url, index) => <div key={url + index} className="mi-photo-order-item"><Image src={url} alt="" width={72} height={58} unoptimized /><span>{index + 1}</span><div><button type="button" onClick={() => movePhoto(index, -1)} disabled={index === 0} aria-label={'Mută fotografia ' + (index + 1) + ' mai devreme'}><ChevronLeft size={15} /></button><button type="button" onClick={() => movePhoto(index, 1)} disabled={index === photos.length - 1} aria-label={'Mută fotografia ' + (index + 1) + ' mai târziu'}><ChevronRight size={15} /></button></div></div>)}</div>}
          <p className="mi-studio-hint">{photos.length} fotografii selectate. Instagram necesită cel puțin una.</p>
        </section>
        <section className="tt-panel mi-studio-panel"><div className="mi-studio-step"><span>04</span><div><h3>Destinații și publicare</h3><p>Alege conturile și momentul publicării.</p></div></div>
          <div className="mi-destination-list">{eligible.map(connection => <label key={connection.id} className={'mi-destination' + (targets.includes(connection.id) ? ' mi-destination--selected' : '')}><input type="checkbox" checked={targets.includes(connection.id)} disabled={connection.capabilities.publish?.status !== 'active'} onChange={() => toggleTarget(connection.id)} /><span className="mi-destination-icon">{connection.channel === 'instagram' ? <Instagram /> : <Facebook />}</span><span><strong>{connection.name}</strong><small>{destinationLabel(connection)}{connection.capabilities.publish?.status !== 'active' ? ' · Publicarea necesită configurare' : ''}</small></span></label>)}</div>
          {!eligible.length && <p className="mi-studio-empty">Conectează un cont Facebook sau Instagram înainte de publicare.</p>}
          {wantsInstagram && !photos.length && <p className="mi-studio-warning">Selectează cel puțin o fotografie pentru Instagram.</p>}
          <div className="mi-schedule"><div className="mi-schedule-title"><CalendarClock size={18} /><strong>Când publicăm?</strong></div><div className="mi-schedule-choices"><label><input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} /> Acum</label><label><input type="radio" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} /> Programează</label></div>{scheduleMode === 'later' && <div className="mi-schedule-fields"><label>Data<Input type="date" value={schedule.date} onChange={event => setSchedule(current => ({ ...current, date: event.target.value }))} /></label><label>Ora București<Input type="time" value={schedule.time} onChange={event => setSchedule(current => ({ ...current, time: event.target.value }))} /></label></div>}</div>
          <div className="mi-studio-actions"><Button variant="outline" disabled={!ready} onClick={() => void save(true)}>Salvează draft</Button><Button disabled={!ready} onClick={() => void save(false)}><Send size={16} />{scheduleMode === 'later' ? 'Programează postarea' : 'Publică postarea'}</Button></div>
          <p className="mi-studio-hint">Prețul și starea proprietății sunt reverificate înainte de publicarea efectivă.</p>
        </section>
      </div>
      <aside className="mi-preview-column"><div className="tt-panel mi-preview-panel"><div className="mi-preview-heading"><span className="tt-eyebrow">PREVIZUALIZARE</span><h3>Vezi postarea înainte de publicare.</h3><p>Aspect orientativ; Meta poate ajusta afișarea.</p></div><div className="mi-preview-tabs"><button type="button" className={preview === 'facebook' ? 'active' : ''} onClick={() => setPreview('facebook')}><Facebook size={15} />Facebook</button><button type="button" className={preview === 'instagram' ? 'active' : ''} onClick={() => setPreview('instagram')}><Instagram size={15} />Instagram</button></div>
        <div className={'mi-social-preview mi-social-preview--' + preview}><div className="mi-preview-account"><span>{preview === 'facebook' ? <Facebook size={20} /> : <Instagram size={20} />}</span><div><strong>{previewAccount?.name || (preview === 'facebook' ? 'Pagina Facebook' : 'Contul Instagram')}</strong><small>Previzualizare · Public</small></div></div><p className="mi-preview-caption">{caption || 'Textul postării va apărea aici.'}</p>{photos.length ? <div className="mi-preview-media"><Image src={photos[visiblePhotoIndex]} alt={"Fotografia " + (visiblePhotoIndex + 1) + " selectată pentru postare"} width={720} height={600} unoptimized />{photos.length > 1 && <div className="mi-preview-carousel"><button type="button" onClick={() => setPreviewIndex((visiblePhotoIndex - 1 + photos.length) % photos.length)} aria-label="Fotografia precedentă"><ChevronLeft size={17} /></button><span>{visiblePhotoIndex + 1} / {photos.length}</span><button type="button" onClick={() => setPreviewIndex((visiblePhotoIndex + 1) % photos.length)} aria-label="Fotografia următoare"><ChevronRight size={17} /></button></div>}</div> : <div className="mi-preview-placeholder"><ImageIcon size={27} />Fără fotografii selectate</div>}<div className="mi-preview-reactions">{preview === 'facebook' ? 'Apreciază     Comentează     Distribuie' : '♡     ◯     ↗'}</div></div>
        {selectedProperty && <p className="mi-preview-property">{selectedProperty.title}{selectedProperty.location ? ' · ' + selectedProperty.location : ''}</p>}
      </div></aside>
    </div>
  </div>;
}
