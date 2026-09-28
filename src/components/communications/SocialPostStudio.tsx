'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Bookmark, CalendarClock, Check, ChevronLeft, ChevronRight, Facebook, Globe2, GripVertical, Heart, Image as ImageIcon, Instagram, MessageCircle, MoreHorizontal, Repeat2, RotateCcw, Search, Send, Share2, Sparkles } from 'lucide-react';
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
function propertyCaption(property: SocialProperty) {
  const description = property.description.trim().replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ');
  if (description) return description;
  return [property.title, property.location].filter(Boolean).join('\n');
}
function destinationLabel(connection: Connection) { return connection.channel === 'instagram' ? 'Instagram' : 'Facebook'; }
function SortablePhoto({ url, index }: { url: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  return <div ref={setNodeRef} className={'mi-photo-order-item' + (isDragging ? ' mi-photo-order-item--dragging' : '')} style={{ transform: CSS.Transform.toString(transform), transition }}>
    <Image src={url} alt={'Fotografia ' + (index + 1)} width={100} height={100} unoptimized />
    <span className="mi-photo-order-number">{index + 1}</span>
    <button type="button" className="mi-photo-drag-handle" aria-label={'Trage fotografia ' + (index + 1) + ' pentru reordonare'} {...attributes} {...listeners}><GripVertical size={19} /></button>
  </div>;
}
function PreviewPhoto({ url, alt }: { url: string; alt: string }) { return <Image src={url} alt={alt} width={500} height={500} unoptimized />; }


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
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
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
  const photos = photoEdit ?? selectedProperty?.images ?? [];
  const visiblePhotoIndex = Math.min(previewIndex, Math.max(0, photos.length - 1));
  const eligible = connections.filter(c => c.status === 'connected' && (c.channel === 'messenger' || c.channel === 'instagram'));
  const selectedTargets = eligible.filter(c => targets.includes(c.id));
  const filteredProperties = useMemo(() => properties.filter(p => (p.title + ' ' + p.location).toLocaleLowerCase('ro-RO').includes(propertySearch.toLocaleLowerCase('ro-RO'))), [properties, propertySearch]);
  const previewAccount = selectedTargets.find(c => c.channel === (preview === 'instagram' ? 'instagram' : 'messenger')) || eligible.find(c => c.channel === (preview === 'instagram' ? 'instagram' : 'messenger'));
  const wantsInstagram = selectedTargets.some(c => c.channel === 'instagram');
  const instagramLimitExceeded = wantsInstagram && (caption.length > 2200 || photos.length > 10);
  const ready = Boolean(admin && selectedProperty && caption.trim().length && selectedTargets.length > 0 && selectedTargets.length === targets.length && selectedTargets.every(c => c.capabilities.publish?.status === 'active') && (!wantsInstagram || photos.length) && !instagramLimitExceeded && !busy && !loadingProperty);
  function chooseProperty(id: string) {
    setPropertyId(id); setProperty(null); setCaptionEdit(null); setPhotoEdit(null); setPreviewIndex(0); setCaptionExpanded(false); setLoadingProperty(Boolean(id)); setError('');
  }
  function togglePhoto(url: string) {
    if (photos.includes(url)) { setPhotoEdit(photos.filter(item => item !== url)); return; }
    setPhotoEdit([...photos, url]); setError('');
  }
  function reorderPhotos(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.indexOf(String(active.id));
    const newIndex = photos.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0) { setPhotoEdit(arrayMove(photos, oldIndex, newIndex)); setPreviewIndex(0); }
  }
  function toggleTarget(id: string) {
    setTargets(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  async function save(draft: boolean) {
    if (!ready || !selectedProperty) return;
    if (instagramLimitExceeded) { setError('Instagram acceptă prin API cel mult 2.200 de caractere și 10 fotografii. Editează postarea sau deselectează Instagram. Textul și fotografiile rămân integral în studio.'); return; }
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
          <Textarea aria-label="Textul postării" className="mi-caption-input" rows={9} value={caption} onChange={event => setCaptionEdit(event.target.value)} placeholder={selectedProperty ? 'Scrie un text pentru această proprietate...' : 'Alege mai întâi o proprietate'} disabled={!selectedProperty} />
          <div className="mi-studio-field-footer"><span>{caption.length} caractere</span><Button variant="ghost" size="sm" disabled={!selectedProperty || captionEdit === null} onClick={() => setCaptionEdit(null)}><RotateCcw size={14} />Preia din nou descrierea</Button></div>
        </section>
        <section className="tt-panel mi-studio-panel"><div className="mi-studio-step"><span>03</span><div><h3>Fotografii</h3><p>Alege fotografiile dorite, apoi trage-le pentru a le ordona.</p></div></div>
          {!selectedProperty && <p className="mi-studio-empty">Fotografiile apar după alegerea proprietății.</p>}
          {selectedProperty && !selectedProperty.images.length && <p className="mi-studio-empty">Această proprietate nu are fotografii disponibile pentru publicare.</p>}
          {selectedProperty && <div className="mi-photo-grid">{selectedProperty.images.map((url, index) => <button type="button" key={url + index} className={'mi-photo-option' + (photos.includes(url) ? ' mi-photo-option--selected' : '')} onClick={() => togglePhoto(url)} aria-label={'Fotografia ' + (index + 1) + (photos.includes(url) ? ', selectată' : ', neselectată')} aria-pressed={photos.includes(url)}><Image src={url} alt={'Fotografia ' + (index + 1) + ' a proprietății'} width={240} height={200} unoptimized /><span>{photos.includes(url) ? photos.indexOf(url) + 1 : '+'}</span></button>)}</div>}
          {!!photos.length && <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderPhotos}><SortableContext items={photos} strategy={rectSortingStrategy}><div className="mi-photo-order" aria-label="Ordinea fotografiilor">{photos.map((url, index) => <SortablePhoto key={url} url={url} index={index} />)}</div></SortableContext></DndContext>}
          <p className="mi-studio-hint">{photos.length} fotografii selectate. Trage de mâner pentru a schimba ordinea. Instagram necesită cel puțin una.</p>
        </section>
        <section className="tt-panel mi-studio-panel"><div className="mi-studio-step"><span>04</span><div><h3>Destinații și publicare</h3><p>Alege conturile și momentul publicării.</p></div></div>
          <div className="mi-destination-list">{eligible.map(connection => <label key={connection.id} className={'mi-destination' + (targets.includes(connection.id) ? ' mi-destination--selected' : '')}><input type="checkbox" checked={targets.includes(connection.id)} disabled={connection.capabilities.publish?.status !== 'active'} onChange={() => toggleTarget(connection.id)} /><span className="mi-destination-icon">{connection.channel === 'instagram' ? <Instagram /> : <Facebook />}</span><span><strong>{connection.name}</strong><small>{destinationLabel(connection)}{connection.capabilities.publish?.status !== 'active' ? ' · Publicarea necesită configurare' : ''}</small></span></label>)}</div>
          {!eligible.length && <p className="mi-studio-empty">Conectează un cont Facebook sau Instagram înainte de publicare.</p>}
          {wantsInstagram && !photos.length && <p className="mi-studio-warning">Selectează cel puțin o fotografie pentru Instagram.</p>}
          {instagramLimitExceeded && <p className="mi-studio-warning">Instagram acceptă prin API maximum 2.200 de caractere și 10 fotografii. Ai {caption.length} caractere și {photos.length} fotografii. Descrierea și selecția nu au fost scurtate. Pentru publicare, editează postarea sau deselectează Instagram.</p>}
          <div className="mi-schedule"><div className="mi-schedule-title"><CalendarClock size={18} /><strong>Când publicăm?</strong></div><div className="mi-schedule-choices"><label><input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} /> Acum</label><label><input type="radio" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} /> Programează</label></div>{scheduleMode === 'later' && <div className="mi-schedule-fields"><label>Data<Input type="date" value={schedule.date} onChange={event => setSchedule(current => ({ ...current, date: event.target.value }))} /></label><label>Ora București<Input type="time" value={schedule.time} onChange={event => setSchedule(current => ({ ...current, time: event.target.value }))} /></label></div>}</div>
          <div className="mi-studio-actions"><Button variant="outline" disabled={!ready} onClick={() => void save(true)}>Salvează draft</Button><Button disabled={!ready} onClick={() => void save(false)}><Send size={16} />{scheduleMode === 'later' ? 'Programează postarea' : 'Publică postarea'}</Button></div>
          <p className="mi-studio-hint">Prețul și starea proprietății sunt reverificate înainte de publicarea efectivă.</p>
        </section>
      </div>
      <aside className="mi-preview-column"><div className="tt-panel mi-preview-panel">

        <div className="mi-preview-tabs"><button type="button" className={preview === 'facebook' ? 'active' : ''} onClick={() => { setPreview('facebook'); setCaptionExpanded(false); }}><Facebook size={15} />Facebook</button><button type="button" className={preview === 'instagram' ? 'active' : ''} onClick={() => { setPreview('instagram'); setCaptionExpanded(false); }}><Instagram size={15} />Instagram</button></div>
        <div className="mi-phone"><div className="mi-phone-top"><span>9:41</span><span className="mi-phone-island" /><span>●●● ▰</span></div>
          <div className="mi-phone-screen" key={preview}>
            {preview === 'facebook' ? <>
              <div className="mi-app-header mi-app-header--facebook"><strong>facebook</strong><span>⌕　◎</span></div>
              <article className="mi-feed-post mi-feed-post--facebook">
                <div className="mi-feed-author"><span className="mi-feed-avatar">{(previewAccount?.name || 'Nordia').slice(0, 1).toUpperCase()}</span><div><strong>{previewAccount?.name || 'Pagina Facebook'}</strong><small>Acum · <Globe2 size={10} /></small></div><MoreHorizontal size={18} /></div>
                <div className="mi-fb-copy"><p className={captionExpanded ? 'expanded' : ''}>{caption || 'Textul postării va apărea aici.'}</p>{caption.length > 110 && <button type="button" onClick={() => setCaptionExpanded(!captionExpanded)}>{captionExpanded ? 'vezi mai puțin' : 'mai mult'}</button>}</div>
                {photos.length ? <div className={'mi-fb-collage mi-fb-collage--' + Math.min(photos.length, 5)}>{photos.slice(0, 5).map((url, index) => <div key={url} className="mi-fb-tile"><PreviewPhoto url={url} alt={'Fotografia ' + (index + 1)} />{index === 4 && photos.length > 5 && <span>+{photos.length - 5}</span>}</div>)}</div> : <div className="mi-preview-placeholder"><ImageIcon size={24} />Fără fotografii selectate</div>}
                <div className="mi-fb-actions"><span><Heart size={17} />Apreciază</span><span><MessageCircle size={17} />Comentează</span><span><Share2 size={17} />Distribuie</span></div>
              </article>
            </> : <>
              <div className="mi-app-header mi-app-header--instagram"><strong>Instagram</strong><span>♡　⊕</span></div>
              <article className="mi-feed-post mi-feed-post--instagram">
                <div className="mi-feed-author"><span className="mi-feed-avatar mi-feed-avatar--instagram">{(previewAccount?.name || 'N').slice(0, 1).toUpperCase()}</span><div><strong>{previewAccount?.name || 'Contul Instagram'}</strong></div><MoreHorizontal size={18} /></div>
                {photos.length ? <div className="mi-ig-media"><PreviewPhoto url={photos[visiblePhotoIndex]} alt={'Fotografia ' + (visiblePhotoIndex + 1)} />{photos.length > 1 && <><span className="mi-ig-count">{visiblePhotoIndex + 1}/{photos.length}</span><button type="button" className="mi-ig-prev" onClick={() => setPreviewIndex((visiblePhotoIndex - 1 + photos.length) % photos.length)} aria-label="Fotografia precedentă"><ChevronLeft size={16} /></button><button type="button" className="mi-ig-next" onClick={() => setPreviewIndex((visiblePhotoIndex + 1) % photos.length)} aria-label="Fotografia următoare"><ChevronRight size={16} /></button></>}</div> : <div className="mi-preview-placeholder"><ImageIcon size={24} />Selectează o fotografie</div>}
                {photos.length > 1 && <div className="mi-ig-dots">{photos.map((url, index) => <button key={url} type="button" className={index === visiblePhotoIndex ? 'active' : ''} onClick={() => setPreviewIndex(index)} aria-label={'Arată fotografia ' + (index + 1)} />)}</div>}
                <div className="mi-ig-actions"><Heart size={23} /><MessageCircle size={23} /><Repeat2 size={23} /><Send size={23} /><Bookmark size={23} /></div>
                <div className="mi-ig-caption"><p className={captionExpanded ? 'expanded' : ''}><strong>{previewAccount?.name || 'contul_tău'}</strong> {caption || 'Textul postării va apărea aici.'}</p>{caption.length > 110 && <button type="button" onClick={() => setCaptionExpanded(!captionExpanded)}>{captionExpanded ? 'mai puțin' : 'mai mult'}</button>}</div><small className="mi-ig-date">ACUM</small>
              </article>
            </>}
          </div><div className="mi-phone-home"><span /></div>
        </div>{selectedProperty && <p className="mi-preview-property">{selectedProperty.title}{selectedProperty.location ? ' · ' + selectedProperty.location : ''}</p>}
      </div></aside>
    </div>
  </div>;
}
