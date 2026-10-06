'use client';
import { useRef, useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { uploadCrmFile } from '@/lib/crm/client-actions';
export function AssistantUploadButton({ user, disabled, onUpload, onError }: {
  user: { getIdToken(): Promise<string> } | null; disabled?: boolean;
  onUpload: (file: { uploadId: string; name: string }) => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false);
  return <><input ref={input} type="file" hidden accept=".pdf,.docx,.csv,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov" onChange={async event => {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !user) return;
    const video = ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type);
    if (file.size > (video ? 500 : 15) * 1024 * 1024) { onError(video ? 'Limita videoclipului este 500 MB.' : 'Limita fișierului este 15 MB.'); return; }
    setBusy(true);
    try {
      onUpload(await uploadCrmFile(user, file));
    } catch (error) { onError(error instanceof Error ? error.message : 'Upload neconfirmat.'); } finally { setBusy(false); }
  }} /><Button type="button" variant="outline" size="icon" aria-label="Atașează fișier" disabled={disabled || busy || !user} onClick={() => input.current?.click()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}</Button></>;
}
