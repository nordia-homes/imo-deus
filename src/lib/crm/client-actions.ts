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
  if (file.size > 15 * 1024 * 1024) throw new Error('Limita fișierului este 15 MB.');
  const form = new FormData(); form.set('file', file);
  const response = await fetch('/api/ai-assistant/uploads', { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}` }, body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Upload neconfirmat.');
  return result as { uploadId: string; name: string };
}

export async function attachPropertyFile(user: { getIdToken(): Promise<string> } | null, file: File, propertyId: string, destination: 'property_image' | 'property_rlv') {
  if (!user) throw new Error('Autentificare necesară.');
  const upload = await uploadCrmFile(user, file);
  const response = await fetch(`/api/ai-assistant/uploads/${upload.uploadId}/apply`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ destination, propertyId }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Atașarea nu a fost confirmată.');
  return result;
}

export async function attachBrandFile(user: { getIdToken(): Promise<string> } | null, file: File, destination: 'profile_photo' | 'agency_logo') {
  if (!user) throw new Error('Autentificare necesară.');
  const upload = await uploadCrmFile(user, file);
  const response = await fetch(`/api/ai-assistant/uploads/${upload.uploadId}/apply`, { method: 'POST', headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ destination }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || result.message || 'Atașarea nu a fost confirmată.');
  return result as { imageUrl: string };
}
