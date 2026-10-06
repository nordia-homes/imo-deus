'use client';
import type { AssistantAction } from '@/lib/ai-assistant/contracts';
import type { Task } from '@/lib/types';

export function manualTaskDetails(row: Partial<Task>) {
  return { ...(row.startTime ? { startTime: row.startTime } : {}), ...(row.duration !== undefined ? { duration: row.duration } : {}),
    ...(row.participantName !== undefined ? { participantName: row.participantName } : {}), ...(row.participantPhone !== undefined ? { participantPhone: row.participantPhone } : {}) };
}

export async function executeCrmAction(user: { getIdToken(): Promise<string> } | null, action: AssistantAction, requestId = crypto.randomUUID()): Promise<Record<string, any>> {
  if (!user) throw new Error('Autentificare necesară.');
  const response = await fetch('/api/crm/actions', { method: 'POST', headers: {
    Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ requestId, action }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || result.error || 'Operația nu a fost confirmată.');
  return result;
}

export function createManualViewing(user: { getIdToken(): Promise<string> } | null, row: { contactId: string; propertyId: string; viewingDate: string; duration?: number; notes?: string }) {
  return executeCrmAction(user, { kind: 'schedule_viewing', contactId: row.contactId, propertyId: row.propertyId,
    viewingDate: row.viewingDate, duration: row.duration || 60, notes: row.notes || '' });
}

export async function uploadCrmFile(user: { getIdToken(): Promise<string> } | null, file: File) {
  if (!user) throw new Error('Autentificare necesară.');
  if (['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) {
    if (!file.size || file.size > 500 * 1024 * 1024) throw new Error('Videoclipul trebuie să fie MP4/WebM/MOV, maximum 500 MB.');
    const headers = { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' };
    const start = await fetch('/api/ai-assistant/uploads/initialize', { method: 'POST', headers, body: JSON.stringify({ name: file.name.slice(0,120), mimeType: file.type, size: file.size }) });
    const session = await start.json(); if (!start.ok) throw new Error(session.error || session.message || 'Uploadul video nu a fost autorizat.');
    const { getStorage, ref, uploadBytesResumable } = await import('firebase/storage');
    await uploadBytesResumable(ref(getStorage(), session.storagePath), file, { contentType: file.type, customMetadata: { uploadId: session.uploadId } });
    const finalized = await fetch(`/api/ai-assistant/uploads/${session.uploadId}/finalize`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
    const result = await finalized.json(); if (!finalized.ok) throw new Error(result.error || result.message || 'Videoclipul nu a trecut validarea.');
    return result as { uploadId: string; name: string };
  }
  if (file.size > 15 * 1024 * 1024) throw new Error('Limita fișierului este 15 MB.');
  const form = new FormData(); form.set('file', file);
  const response = await fetch('/api/ai-assistant/uploads', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Upload neconfirmat.');
  return result as { uploadId: string; name: string };
}

export async function prepareCrmMedia(user: { getIdToken(): Promise<string> } | null, file: File, purpose: 'property_media' | 'meta_media' | 'tiktok_media' | 'video_tour', targetId?: string, createTarget = false) {
  if (!user) throw new Error('Autentificare necesară.');
  const upload = await uploadCrmFile(user, file);
  const response = await fetch(`/api/ai-assistant/uploads/${upload.uploadId}/prepare-media`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ purpose, ...(targetId ? { targetId } : {}), createTarget }) });
  const result = await response.json(); if (!response.ok) throw new Error(result.error || result.message || 'Materialul nu a fost pregătit.');
  return result as { uploadId: string; targetId: string | null; name: string; url: string; mimeType: string; type: 'image' | 'video'; sizeBytes: number; storagePath: string };
}

export async function previewContractFile(user: { getIdToken(): Promise<string> } | null, file: File) {
  if (!user) throw new Error('Autentificare necesară.');
  const upload = await uploadCrmFile(user, file);
  const response = await fetch(`/api/ai-assistant/uploads/${upload.uploadId}/docx-preview`, { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Importul Word nu a fost confirmat.');
  return result as { content: string; warnings: string[]; note: string };
}

export async function attachPropertyFile(user: { getIdToken(): Promise<string> } | null, file: File, propertyId: string, destination: 'property_image' | 'property_rlv', expectedUpdatedAt?: string | null) {
  if (!user) throw new Error('Autentificare necesară.');
  const upload = await uploadCrmFile(user, file);
  const response = await fetch(`/api/ai-assistant/uploads/${upload.uploadId}/apply`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ destination, propertyId, ...(destination === 'property_rlv' && expectedUpdatedAt !== undefined ? { expectedUpdatedAt } : {}) }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Atașarea nu a fost confirmată.');
  return result;
}

export async function attachBrandFile(user: { getIdToken(): Promise<string> } | null, file: File, destination: 'profile_photo' | 'agency_logo' | 'agency_share_image') {
  if (!user) throw new Error('Autentificare necesară.');
  const upload = await uploadCrmFile(user, file);
  const response = await fetch(`/api/ai-assistant/uploads/${upload.uploadId}/apply`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ destination }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Atașarea nu a fost confirmată.');
  return result as { imageUrl: string };
}
