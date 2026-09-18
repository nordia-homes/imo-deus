'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useStorage, useUser } from '@/firebase';
import { Button, StudioEyebrow } from './StudioPrimitives';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Clapperboard, Images, Mic2, Sparkles, RefreshCw, Film, WandSparkles } from 'lucide-react';
import Image from 'next/image';
import type { LibraryVideo } from '@/lib/tiktok-video-library';
import type { TikTokStudioAsset, TikTokStudioProject, TikTokStudioRepurposeVariant, TikTokPostDraft, TikTokStudioCreativeBrief } from '@/lib/types';
import { statusLabel } from '@/lib/tiktok-ads/workspace-model';
import { Field } from './AdComposer';
import { inputClass, panelClass, type Api } from './workspace-types';

type Property = { id: string; title: string; description?: string; location?: string; price?: string; images: Array<{ url: string; alt?: string }> };
type Dashboard = { videoLibrary?: LibraryVideo[]; portfolioProperties: Property[]; studioAssets: TikTokStudioAsset[]; studioProjects: TikTokStudioProject[]; drafts: TikTokPostDraft[]; status: { connected: boolean }; config?: { privateModeOnly?: boolean }; };
type Voice = { id: string; name: string; previewUrl: string | null };
type Editor = { id: string; version: number; propertyId: string; title: string; sourceAssetIds: string[]; script: string; voiceId: string; subtitleStyle: string; brandName: string; variants: TikTokStudioRepurposeVariant[] };
type Creator = { creator_username?: string; privacy_level_options?: string[]; comment_disabled?: boolean; duet_disabled?: boolean; stitch_disabled?: boolean; max_video_post_duration_sec?: number };
const blank = (propertyId = ''): Editor => ({ id: crypto.randomUUID(), version: 0, propertyId, title: '', sourceAssetIds: [], script: '', voiceId: '', subtitleStyle: 'clean_white', brandName: '', variants: ['tiktok_9_16'] });

export function VideoLibrary({ api, onAd, initialPropertyId = '' }: { api: Api; onAd: (asset: TikTokStudioAsset) => void; initialPropertyId?: string }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [search, setSearch] = useState('');
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const [page, setPage] = useState(1);
  const [publishing, setPublishing] = useState<{ asset: TikTokStudioAsset; creator: Creator; text: string; privacy: string; schedule: string; comments: boolean; duet: boolean; stitch: boolean; draftId?: string } | null>(null);
  const storage = useStorage(); const { user } = useUser();
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const versions = useRef(new Map<string, number>());
  const savedEditors = useRef(new Map<string, string>());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => { const data = await api<Dashboard>('/api/marketing/tiktok/dashboard'); setDashboard(data); }, [api]);
  useEffect(() => { let live = true; void api('/api/marketing/tiktok/studio-assets/reconcile', { method: 'POST' }).catch(error => { if (live) setMessage(error.message); }).then(() => api<Dashboard>('/api/marketing/tiktok/dashboard')).then(data => { if (live) setDashboard(data); }).catch(error => { if (live) setMessage(error.message); }); return () => { live = false; }; }, [api]);
  const processing = dashboard?.studioProjects.some(item => item.status === 'queued' || item.status === 'rendering') || dashboard?.drafts.some(item => item.status === 'processing' || item.status === 'publishing' || item.scheduleStatus === 'scheduled');
  useEffect(() => {
    if (!processing) return;
    let pending = false;
    const timer = setInterval(() => {
      if (pending) return;
      pending = true;
      void (async () => {
        for (const post of (dashboard?.drafts || []).filter(item => item.createdByUid === user?.uid && item.publishId && ['publishing', 'processing'].includes(item.status)).slice(0, 5)) {
          await api(`/api/marketing/tiktok/post-drafts/${post.id}/status`);
        }
        await load();
      })().catch(error => setMessage(error.message)).finally(() => { pending = false; });
    }, 15000);
    return () => clearInterval(timer);
  }, [processing, load, api, dashboard?.drafts, user?.uid]);
  async function run(action: () => Promise<void>) { if (saveTimer.current) clearTimeout(saveTimer.current); setBusy(true); setMessage(''); try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operația nu a reușit.'); } finally { setBusy(false); } }
  const persist = useCallback((value: Editor) => {
    saveChain.current = saveChain.current.catch(() => undefined).then(async () => {
      const serialized = JSON.stringify(value);
      if (savedEditors.current.get(value.id) === serialized) return;
      const result = await api<{ project: TikTokStudioProject }>('/api/marketing/tiktok/studio-projects', { method: 'POST', body: JSON.stringify({ projectId: value.id, expectedVersion: versions.current.get(value.id) ?? value.version, propertyId: value.propertyId, title: value.title, sourceAssetIds: value.sourceAssetIds, script: value.script, voiceId: value.voiceId, subtitleStyle: value.subtitleStyle, brandKit: { name: value.brandName, watermarkText: value.brandName, defaultCallToAction: 'Programează o vizionare' }, repurposeVariants: value.variants, aspectRatio: '9:16' }) });
      versions.current.set(value.id, result.project.version || 1); savedEditors.current.set(value.id, serialized); setSaved('Salvat'); return result.project;
    });
    return saveChain.current;
  }, [api]);
  useEffect(() => { if (!editor?.propertyId || busy) return; saveTimer.current = setTimeout(() => { void persist(editor).catch(error => setSaved(error.message)); }, 1200); return () => { if (saveTimer.current) clearTimeout(saveTimer.current); }; }, [editor, persist, busy]);
  function edit(patch: Partial<Editor>) { setSaved('Modificări nesalvate'); setEditor(current => current ? { ...current, ...patch } : current); }
  async function loadVoices() {
    setVoicesLoading(true); setVoiceError('');
    try {
      const result = await api<{ voices: Voice[]; message?: string }>('/api/marketing/tiktok/voices');
      setVoices(result.voices || []);
      if (!result.voices?.length) setVoiceError(result.message || 'Nu sunt disponibile voci în cont. Verifică integrarea ElevenLabs.');
    } catch (error) {
      setVoices([]); setVoiceError(error instanceof Error ? error.message : 'Vocile nu pot fi încărcate.');
    } finally { setVoicesLoading(false); }
  }
  async function closeEditor() {
    await run(async () => { if (editor?.propertyId) await persist(editor); setEditor(null); await load(); });
  }
  async function openEditor(project?: TikTokStudioProject) {
    const value = project ? { id: project.id, version: project.version || 1, propertyId: project.propertyId || '', title: project.title, sourceAssetIds: project.sourceAssetIds, script: project.script || '', voiceId: project.voiceId || '', subtitleStyle: project.subtitleStyle || 'clean_white', brandName: project.brandKit?.name || '', variants: project.repurposeVariants || ['tiktok_9_16' as const] } : blank();
    if (project) { versions.current.set(project.id, value.version); savedEditors.current.set(project.id, JSON.stringify(value)); }
    setSaved(project ? 'Salvat' : 'Draft nou'); setEditor(value);
    void loadVoices();
    if (!project && propertyId) await importProperty(propertyId);
  }
  async function importProperty(nextId: string) {
    const property = dashboard?.portfolioProperties.find(item => item.id === nextId); if (!property) return;
    edit({ propertyId: nextId, title: property.title, sourceAssetIds: [], script: `${property.title}. ${property.location || ''}. ${property.price ? `Preț: ${property.price}.` : ''} Contactează-ne pentru detalii și o vizionare.` });
    const sourceAssetIds: string[] = [];
    for (const photo of property.images.slice(0, 12)) {
      const existing = dashboard?.studioAssets.find(asset => asset.propertyId === nextId && asset.url === photo.url);
      if (existing) { sourceAssetIds.push(existing.id); continue; }
      const result = await api<{ asset: TikTokStudioAsset }>('/api/marketing/tiktok/studio-assets', { method: 'POST', body: JSON.stringify({ propertyId: nextId, type: 'image', name: photo.alt || property.title, url: photo.url, thumbnailUrl: photo.url, mimeType: 'image/jpeg', source: 'upload' }) });
      sourceAssetIds.push(result.asset.id);
    }
    edit({ sourceAssetIds }); await load();
  }
  async function upload(files: File[]) {
    if (!user || !propertyId) throw new Error('Selectează proprietatea înainte de import.');
    for (const file of files) {
      if (!/^video\//.test(file.type) || file.size > 500 * 1024 * 1024) throw new Error('Folosește videoclipuri de maximum 500 MB.');
      const target = ref(storage, `users/${user.uid}/tiktok-studio/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
      await uploadBytes(target, file, { contentType: file.type }); const url = await getDownloadURL(target);
      await api('/api/marketing/tiktok/studio-assets', { method: 'POST', body: JSON.stringify({ propertyId, type: file.type.startsWith('video') ? 'video' : 'image', name: file.name, url, mimeType: file.type, sizeBytes: file.size, source: 'upload' }) });
    }
    await load(); setMessage('Materialele au fost importate.');
  }
  async function startPublish(asset: TikTokStudioAsset) {
    const data = await api<{ creatorInfo: Creator }>('/api/marketing/tiktok/creator-info');
    if (asset.durationSeconds && data.creatorInfo.max_video_post_duration_sec && asset.durationSeconds > data.creatorInfo.max_video_post_duration_sec) throw new Error(`Profilul permite maximum ${data.creatorInfo.max_video_post_duration_sec} secunde. Alege un videoclip mai scurt.`);
    setPublishing({ asset, creator: data.creatorInfo, text: asset.editorState?.description || asset.name, privacy: '', schedule: '', comments: false, duet: false, stitch: false });
  }
  async function generateScript() {
    if (!editor) return;
    const property = dashboard?.portfolioProperties.find(item => item.id === editor.propertyId);
    const result = await api<{ brief: TikTokStudioCreativeBrief }>('/api/marketing/tiktok/creative-brief', { method: 'POST', body: JSON.stringify({ propertyId: editor.propertyId, title: editor.title, sourceAssetIds: editor.sourceAssetIds, propertyContext: property ? JSON.stringify({ title: property.title, description: property.description, location: property.location, price: property.price }) : '', brandKit: { name: editor.brandName, defaultCallToAction: 'Programează o vizionare' } }) });
    edit({ script: result.brief.script });
    setMessage('Scenariul AI este pregătit. Verifică informațiile despre proprietate înainte de randare.');
  }
  async function publish() {
    if (!publishing || !publishing.privacy) throw new Error('Selectează vizibilitatea postării.');
    let draftId = publishing.draftId;
    if (!draftId) {
      const result = await api<{ draft: TikTokPostDraft }>('/api/marketing/tiktok/post-drafts', { method: 'POST', body: JSON.stringify({ assetId: publishing.asset.id, description: publishing.text, privacyLevel: publishing.privacy, disableComment: !publishing.comments, disableDuet: !publishing.duet, disableStitch: !publishing.stitch, aiGeneratedContent: publishing.asset.source === 'ai_generated' }) });
      draftId = result.draft.id; setPublishing({ ...publishing, draftId });
    }
    await api(`/api/marketing/tiktok/post-drafts/${draftId}/${publishing.schedule ? 'schedule' : 'publish'}`, { method: 'POST', body: JSON.stringify(publishing.schedule ? { runAt: new Date(publishing.schedule).toISOString(), confirm: true } : {}) });
    setPublishing(null); await load(); setMessage('Cererea a fost înregistrată. Starea publicării apare în istoric.');
  }
  async function resolveVideo(video: LibraryVideo): Promise<TikTokStudioAsset> {
    if (!video.requiresImport) return video;
    const result = await api<{ asset: TikTokStudioAsset }>('/api/marketing/tiktok/studio-assets', {
      method: 'POST', body: JSON.stringify({ propertyId: video.propertyId, type: 'video', name: video.name, url: video.url, thumbnailUrl: video.thumbnailUrl, mimeType: video.mimeType, sizeBytes: video.sizeBytes, source: video.source }),
    });
    await load();
    return result.asset;
  }
  const videoProperties = new Map((dashboard?.portfolioProperties || []).map(item => [item.id, item.title]));
  dashboard?.videoLibrary?.forEach(video => { if (video.propertyId && video.propertyTitle) videoProperties.set(video.propertyId, video.propertyTitle); });
  const assets = (dashboard?.videoLibrary || dashboard?.studioAssets || []).filter(asset => asset.type === 'video' && !!asset.propertyId && (!propertyId || asset.propertyId === propertyId) && asset.name.toLowerCase().includes(search.toLowerCase()));
  return <div className="tt-media-library space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Videoclipurile proprietăților</h2><p className="text-sm text-slate-500">Videoclipuri Video AI și videoclipuri încărcate pentru proprietăți.</p></div><Button onClick={() => void run(() => openEditor())} disabled={busy}>Creează videoclip</Button></div>
    <div className="grid gap-3 sm:grid-cols-3"><input className={inputClass} aria-label="Caută material" placeholder="Caută videoclipul…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><select aria-label="Filtrează după proprietate" className={inputClass} value={propertyId} onChange={event => { setPropertyId(event.target.value); setPage(1); }}><option value="">Toate proprietățile</option>{[...videoProperties].map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select><label className="cursor-pointer rounded-xl border border-dashed p-2 text-center text-sm"><input type="file" accept="video/*" multiple disabled={busy || !propertyId} className="sr-only" onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ''; void run(() => upload(files)); }} />Încarcă videoclip</label></div>
    {message && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">{message}</p>}
    {!dashboard && <p className="p-8 text-center text-slate-500">Se încarcă biblioteca…</p>}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{assets.slice((page - 1) * 12, page * 12).map(asset => <article key={asset.id} className="overflow-hidden rounded-2xl border bg-white"><div className="aspect-[4/3] bg-slate-950">{<video controls playsInline preload="metadata" src={asset.url} poster={asset.thumbnailUrl || undefined} className="h-full w-full object-contain" />}</div><div className="space-y-3 p-4"><span className="tt-badge">{asset.source === 'upload' ? 'Video încărcat' : 'Video AI'}</span><h3 className="line-clamp-2 text-sm font-semibold">{asset.name}</h3><p className="text-xs text-slate-500">{videoProperties.get(asset.propertyId || '') || 'Proprietate asociată'} · {statusLabel(asset.status)}</p>{!asset.propertyId && <select aria-label="Asociază proprietatea" className={inputClass} defaultValue="" disabled={busy} onChange={event => void run(async () => { await api('/api/marketing/tiktok/studio-assets', { method: 'PATCH', body: JSON.stringify({ assetId: asset.id, propertyId: event.target.value }) }); await load(); })}><option value="">Asociază proprietatea…</option>{dashboard?.portfolioProperties.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}{asset.type === 'video' && <><Button className="w-full" disabled={busy || !asset.propertyId || asset.status !== 'ready'} onClick={() => void run(async () => onAd(await resolveVideo(asset)))}>Folosește în reclamă</Button><div className="flex items-center justify-between gap-2"><a className="text-xs underline" href={asset.url} target="_blank" rel="noreferrer">Descarcă / deschide</a><Button size="sm" variant="outline" disabled={busy || !dashboard?.status.connected} onClick={() => void run(async () => startPublish(await resolveVideo(asset)))}>Publică pe profil</Button></div></>}</div></article>)}</div>
    {dashboard && !assets.length && <div className={`${panelClass} text-center text-slate-500`}>Nu există videoclipuri pentru această selecție. Generează un Video AI din proprietate sau încarcă un videoclip. Fotografiile sunt disponibile doar în editor.</div>}
    {assets.length > 12 && <div className="flex justify-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Înapoi</Button><span className="p-2 text-sm">{page} / {Math.ceil(assets.length / 12)}</span><Button variant="outline" disabled={page * 12 >= assets.length} onClick={() => setPage(page + 1)}>Înainte</Button></div>}
    <div className={panelClass}><h3 className="mb-4 font-semibold">Proiecte editabile</h3><div className="space-y-3">{dashboard?.studioProjects.filter(project => !propertyId || project.propertyId === propertyId).map(project => <div key={project.id} className="flex flex-wrap items-center justify-between gap-3 border-b pb-3"><div><p className="text-sm font-medium">{project.title} · v{project.version || 1}</p><p className="text-xs text-slate-500">{project.renderProgress || statusLabel(project.status)}{project.errorMessage ? ` · ${project.errorMessage}` : ''}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled={busy || ['queued', 'rendering'].includes(project.status)} onClick={() => void run(() => openEditor(project))}>Editează</Button>{project.status === 'error' && <Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await api(`/api/marketing/tiktok/studio-projects/${project.id}/render`, { method: 'POST' }); await load(); })}>Reîncearcă</Button>}</div></div>)}</div></div>
    <details className={panelClass}><summary className="cursor-pointer font-semibold">Publicări pe profil</summary>{dashboard?.drafts.map(draft => <div className="mt-3 flex justify-between gap-3 border-t pt-3 text-sm" key={draft.id}><div>{draft.propertyTitle}<p className="text-xs text-slate-500">{(draft.scheduleStatus === 'scheduled' ? 'Programată' : statusLabel(draft.status))} · {draft.scheduledAt ? new Date(draft.scheduledAt).toLocaleString('ro-RO') : 'Manual'}{draft.lastPublishError ? ` · ${draft.lastPublishError}` : ''}</p></div>{draft.scheduleStatus === 'scheduled' && draft.createdByUid === user?.uid && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { await api(`/api/marketing/tiktok/post-drafts/${draft.id}/schedule`, { method: 'DELETE' }); await load(); })}>Anulează programarea</Button>}{draft.publishId && draft.createdByUid === user?.uid && <Button variant="outline" size="sm" onClick={() => void run(async () => { await api(`/api/marketing/tiktok/post-drafts/${draft.id}/status`); await load(); })}>Verifică</Button>}</div>)}</details>
    {editor && <DialogPrimitive.Root open onOpenChange={open => { if (!open && !busy) void closeEditor(); }}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="tt-composer-backdrop" /><DialogPrimitive.Content className="tt-design tt-video-editor" aria-labelledby={undefined} aria-label="Editor videoclip" onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
      <header className="tt-video-header"><span className="tt-video-mark"><Clapperboard /></span><div><StudioEyebrow>PROPERTY VIDEO STUDIO</StudioEyebrow><DialogPrimitive.Title>Creează o poveste. Nu doar un video.</DialogPrimitive.Title><DialogPrimitive.Description>{saved || 'Draft nou'} · Videoclipul proprietății · Format vertical 9:16</DialogPrimitive.Description></div><Button variant="outline" disabled={busy} onClick={() => void closeEditor()}>Salvează și închide</Button></header>
      <div className="tt-video-body"><div className="tt-video-workflow"><span><Images />Selectează cadrele</span><i /><span><Mic2 />Dă-le o voce</span><i /><span><Film />Pregătește videoclipul</span></div>
      <fieldset disabled={busy} className="tt-video-columns"><section className="tt-video-section tt-video-section--media"><div className="tt-video-section-heading"><span>01</span><div><h3>Scena îți aparține.</h3><p>Fotografiile vin automat din proprietatea aleasă.</p></div><Images /></div><Field label="1. Proprietatea"><select className={inputClass} value={editor.propertyId} disabled={busy} onChange={event => void run(() => importProperty(event.target.value))}><option value="">Selectează proprietatea</option>{dashboard?.portfolioProperties.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></Field><Field label="Titlu"><input className={inputClass} value={editor.title} onChange={event => edit({ title: event.target.value })} /></Field><div className="tt-storyboard-heading"><h4>Storyboard</h4><span>{editor.sourceAssetIds.length} cadre selectate</span></div>{!editor.sourceAssetIds.length && <div className="tt-storyboard-empty"><Images /><p>Alege proprietatea pentru a importa fotografiile.</p></div>}<div className="tt-storyboard">{editor.sourceAssetIds.map((id, index) => { const asset = dashboard?.studioAssets.find(item => item.id === id); return <div key={id} className="tt-story-frame"><Image unoptimized width={180} height={180} src={asset?.url || '/placeholder.svg'} alt={asset?.name || `Scena ${index + 1}`} className="aspect-square object-cover" /><div className="flex justify-around p-1"><button aria-label="Mută fotografia înainte" disabled={index === 0} onClick={() => { const ids = [...editor.sourceAssetIds]; [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]]; edit({ sourceAssetIds: ids }); }}>←</button><span className="text-xs">{index + 1}</span><button aria-label="Exclude fotografia" onClick={() => edit({ sourceAssetIds: editor.sourceAssetIds.filter(item => item !== id) })}>×</button></div></div>; })}</div><select className={inputClass} aria-label="Adaugă fotografie" value="" onChange={event => edit({ sourceAssetIds: [...editor.sourceAssetIds, event.target.value] })}><option value="">Adaugă o fotografie…</option>{dashboard?.studioAssets.filter(asset => asset.type === 'image' && asset.propertyId === editor.propertyId && !editor.sourceAssetIds.includes(asset.id)).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}</select></section><section className="tt-video-section tt-video-section--voice"><div className="tt-video-section-heading"><span>02</span><div><h3>Povestea prinde voce.</h3><p>Scenariu, narațiune și stil vizual.</p></div><Mic2 /></div><Button variant="outline" disabled={busy || editor.sourceAssetIds.length < 2} onClick={() => void run(generateScript)}><WandSparkles size={16} />Generează scenariu AI din proprietate</Button><Field label="3. Scenariul vocii"><textarea className={inputClass} rows={7} value={editor.script} onChange={event => edit({ script: event.target.value })} /><span className="text-xs text-slate-500">Aproximativ {Math.ceil(editor.script.split(/\s+/).filter(Boolean).length / 2.4)} secunde. Verifică exactitatea datelor înainte de generare.</span></Field><div className="tt-voice-picker"><div className="tt-voice-heading"><Mic2 size={16} /><strong>Naratorul poveștii</strong><Button size="sm" variant="ghost" disabled={voicesLoading || busy} onClick={() => void loadVoices()}><RefreshCw size={13} />Reîncarcă vocile</Button></div><Field label="Voce"><select aria-label="Voce" disabled={voicesLoading} className={inputClass} value={editor.voiceId} onChange={event => edit({ voiceId: event.target.value })}><option value="">{voicesLoading ? 'Se încarcă vocile…' : 'Selectează vocea'}</option>{editor.voiceId && !voices.some(voice => voice.id === editor.voiceId) && <option value={editor.voiceId}>Vocea salvată · {editor.voiceId}</option>}{voices.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></Field>{voiceError && <p role="alert" className="tt-voice-error">{voiceError}</p>}{voices.find(voice => voice.id === editor.voiceId)?.previewUrl && <audio controls src={voices.find(voice => voice.id === editor.voiceId)!.previewUrl!} className="w-full" />}</div><Field label="Subtitrări"><select className={inputClass} value={editor.subtitleStyle} onChange={event => edit({ subtitleStyle: event.target.value })}><option value="clean_white">Alb simplu</option><option value="tiktok_bold">TikTok bold</option><option value="luxury_white">Elegant</option></select></Field><Field label="Numele agenției / marcaj"><input className={inputClass} value={editor.brandName} onChange={event => edit({ brandName: event.target.value })} /></Field><div className="tt-export-options"><div className="tt-video-section-heading"><span>03</span><div><h3>Pregătit pentru fiecare ecran.</h3><p>Alege versiunile de export.</p></div></div>{(['tiktok_9_16', 'reels_9_16', 'story_9_16', 'shorts_9_16', 'no_subtitles', 'alternate_cta'] as const).map(variant => <label key={variant} className={`tt-export-option ${editor.variants.includes(variant) ? 'tt-export-option--selected' : ''}`}><input type="checkbox" checked={editor.variants.includes(variant)} onChange={event => edit({ variants: event.target.checked ? [...editor.variants, variant] : editor.variants.filter(item => item !== variant) })} />{{ tiktok_9_16: 'TikTok', reels_9_16: 'Reels', story_9_16: 'Story', shorts_9_16: 'Shorts', no_subtitles: 'Versiune fără subtitrări', alternate_cta: 'Variantă cu alt îndemn final' }[variant]}</label>)}</div><Button disabled={busy || voicesLoading || !editor.voiceId || editor.sourceAssetIds.length < 2 || !editor.script.trim() || !editor.variants.length} className="tt-render-button w-full" onClick={() => void run(async () => { await persist(editor); await api(`/api/marketing/tiktok/studio-projects/${editor.id}/render`, { method: 'POST' }); setEditor(null); await load(); setMessage('Randarea este în coadă. Poți continua lucrul; progresul apare în proiecte.'); })}><Sparkles size={17} />{busy ? 'Se pregătește…' : 'Generează videoclipul'}</Button><p className="tt-render-note">Videoclipul se salvează în bibliotecă. Nu se publică automat.</p></section></fieldset>{message && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm">{message}</p>}</div></DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>}
    {publishing && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 p-6" role="dialog" aria-modal="true" aria-label="Publicare pe profil"><div className="mx-auto max-w-lg space-y-4 rounded-2xl bg-white p-6"><h2 className="text-xl font-semibold">Publică pe profilul @{publishing.creator.creator_username}</h2><video controls playsInline src={publishing.asset.url} className="mx-auto max-h-60 rounded-xl" /><Field label="Descriere"><textarea className={inputClass} value={publishing.text} disabled={!!publishing.draftId} onChange={event => setPublishing({ ...publishing, text: event.target.value })} /></Field><Field label="Cine poate vedea postarea"><select className={inputClass} value={publishing.privacy} disabled={!!publishing.draftId} onChange={event => setPublishing({ ...publishing, privacy: event.target.value })}><option value="">Alege vizibilitatea</option>{publishing.creator.privacy_level_options?.filter(option => !dashboard?.config?.privateModeOnly || option === 'SELF_ONLY').map(option => <option value={option} key={option}>{option}</option>)}</select></Field>{(['comments', 'duet', 'stitch'] as const).map(key => <label className="flex gap-2 text-sm" key={key}><input type="checkbox" checked={publishing[key]} disabled={!!publishing.draftId || (key === 'comments' ? publishing.creator.comment_disabled : key === 'duet' ? publishing.creator.duet_disabled : publishing.creator.stitch_disabled)} onChange={event => setPublishing({ ...publishing, [key]: event.target.checked })} />Permite {key === 'comments' ? 'comentarii' : key}</label>)}<Field label="Programează (opțional, ora dispozitivului)"><input className={inputClass} type="datetime-local" value={publishing.schedule} onChange={event => setPublishing({ ...publishing, schedule: event.target.value })} /></Field><p className="text-xs text-slate-500">{dashboard?.config?.privateModeOnly && 'Integrarea permite momentan numai postări private. '}Aceasta este o postare pe profil, separată de reclamele plătite.{publishing.asset.source === 'ai_generated' && ' Conținutul va fi marcat ca generat cu AI.'}</p>{message && <p role="alert" className="text-sm text-rose-700">{message}</p>}<div className="flex justify-between"><Button variant="outline" disabled={busy} onClick={() => setPublishing(null)}>Anulează</Button><Button disabled={busy || !publishing.privacy || !publishing.text.trim()} onClick={() => void run(publish)}>{publishing.schedule ? 'Confirmă programarea' : 'Confirmă publicarea'}</Button></div></div></div>}
  </div>;
}
