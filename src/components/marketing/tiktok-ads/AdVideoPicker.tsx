'use client';
import { useState } from 'react';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useStorage, useUser } from '@/firebase';
import { Upload, Film } from 'lucide-react';
import { inputClass, type Api, type Workspace } from './workspace-types';
export type AdVideo = Workspace['assets'][number] & { requiresImport?: boolean; mimeType?: string | null; sizeBytes?: number | null; source?: string };

export function AdVideoPicker({ api, videos, propertyId, value, disabled, onSelected, onBusy }: { api: Api; videos: AdVideo[]; propertyId: string; value: string; disabled: boolean; onSelected: (asset: AdVideo) => void; onBusy: (busy: boolean) => void }) {
  const storage = useStorage(); const { user } = useUser();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const choices = videos.filter(video => video.propertyId === propertyId);
  async function run(action: () => Promise<AdVideo>) {
    setLoading(true); onBusy(true); setError('');
    try { onSelected(await action()); }
    catch (error) { setError(error instanceof Error ? error.message : 'Videoclipul nu a putut fi încărcat.'); }
    finally { setLoading(false); onBusy(false); }
  }
  async function select(id: string) {
    const video = choices.find(item => item.id === id); if (!video) return;
    await run(async () => {
      if (!video.requiresImport) return video;
      const result = await api<{ asset: AdVideo }>('/api/marketing/tiktok/studio-assets', { method: 'POST', body: JSON.stringify({ propertyId, type: 'video', name: video.name, url: video.url, thumbnailUrl: video.thumbnailUrl, mimeType: video.mimeType, sizeBytes: video.sizeBytes, source: video.source }) });
      return result.asset;
    });
  }
  async function upload(file: File) {
    await run(async () => {
      if (!propertyId || !user || !storage) throw new Error('Selectează proprietatea și verifică autentificarea înainte de încărcare.');
      if (!file.type.startsWith('video/') || file.size === 0 || file.size > 500 * 1024 * 1024) throw new Error('Alege un videoclip de maximum 500 MB.');
      const target = ref(storage, `users/${user.uid}/tiktok-studio/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`);
      await uploadBytes(target, file, { contentType: file.type });
      const url = await getDownloadURL(target);
      return (await api<{ asset: AdVideo }>('/api/marketing/tiktok/studio-assets', { method: 'POST', body: JSON.stringify({ propertyId, type: 'video', name: file.name, url, mimeType: file.type, sizeBytes: file.size, source: 'upload' }) })).asset;
    });
  }
  return <div className="space-y-3"><label className="tt-field"><span>Videoclipul proprietății</span><select className={inputClass} value={value} disabled={disabled || loading || !propertyId} onChange={event => void select(event.target.value)}><option value="">Selectează un videoclip</option>{choices.map(video => <option key={video.id} value={video.id}>{video.name}</option>)}</select></label>
    {!choices.length && <p className="text-sm text-slate-500"><Film size={16} className="mr-2 inline" />{propertyId ? 'Proprietatea nu are încă un videoclip disponibil. Încarcă unul mai jos sau creează-l cu Video AI.' : 'Alege mai întâi proprietatea.'}</p>}
    <label className="tt-video-upload"><Upload size={20} /><span><strong>{loading ? 'Se pregătește videoclipul…' : 'Încarcă videoclip pentru această proprietate'}</strong><small>Video AI și videoclipurile încărcate sunt disponibile aici. Fișiere de maximum 500 MB.</small></span><input aria-label="Încarcă videoclip" type="file" accept="video/*" disabled={disabled || loading || !propertyId} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /></label>
    {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
  </div>;
}
