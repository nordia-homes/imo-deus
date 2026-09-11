'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import type { Property } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ExternalLink, FileText, ImageIcon, Loader2, Upload } from 'lucide-react';
import Image from 'next/image';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore, useStorage } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useToast } from '@/hooks/use-toast';

interface RlvTabProps {
  property: Property;
}

const getDecodedFilePath = (url?: string) => {
  const path = url?.split(/[?#]/, 1)[0] || '';

  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
};

export function RlvTab({ property }: RlvTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const decodedRlvUrl = getDecodedFilePath(property.rlvUrl);
  const isImage = Boolean(
    property.rlvFileType?.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(decodedRlvUrl)
  );

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!agencyId) {
      toast({
        variant: 'destructive',
        title: 'Agenția nu este disponibilă',
        description: 'Nu am putut identifica agenția pentru această proprietate.',
      });
      return;
    }

    const isAcceptedType =
      file.type === 'application/pdf' ||
      file.type.startsWith('image/');

    if (!isAcceptedType) {
      toast({
        variant: 'destructive',
        title: 'Fișier neacceptat',
        description: 'Poți încărca doar imagini sau documente PDF.',
      });
      return;
    }

    try {
      setIsUploading(true);

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storageRef = ref(
        storage,
        `agencies/${agencyId}/properties/${property.id}/rlv/${Date.now()}-${sanitizedName}`
      );

      await uploadBytes(storageRef, file, {
        contentType: file.type || undefined,
      });

      const downloadUrl = await getDownloadURL(storageRef);
      const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
      await updateDoc(propertyRef, {
        rlvUrl: downloadUrl,
        rlvFileType: file.type,
      });

      toast({
        title: 'RLV încărcat',
        description: 'Fișierul a fost salvat cu succes.',
      });
    } catch (error) {
      console.error('RLV upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Încărcarea a eșuat',
        description: 'Nu am putut încărca fișierul. Încearcă din nou.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="text-center text-card-foreground dark:text-white">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,application/pdf"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {property.rlvUrl ? (
        <div className="space-y-4">
           <div className="flex flex-col items-center justify-center overflow-hidden rounded-2xl border bg-muted p-3 dark:border-white/10 dark:bg-white/5">
              {isImage ? (
                   <div className="relative min-h-[320px] w-full sm:min-h-[460px] lg:min-h-[560px]">
                      <Image
                        src={property.rlvUrl}
                        alt={`Releveu pentru ${property.title}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 768px"
                        className="rounded-xl object-contain"
                      />
                   </div>
              ) : (
                  <>
                    <FileText className="mb-4 h-16 w-16 text-primary" />
                    <h3 className="font-semibold">Releveul PDF este disponibil.</h3>
                  </>
              )}
           </div>
           {!isImage && (
             <Button asChild>
                <a href={property.rlvUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Descarcă / Vizualizează
                </a>
             </Button>
           )}
          <Button type="button" variant="outline" onClick={handleUploadClick} disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Înlocuiește fișierul
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="p-8 border-2 border-dashed rounded-lg border-muted-foreground/30 dark:border-white/20">
            <ImageIcon className="h-16 w-16 text-muted-foreground/70 dark:text-white/70 mx-auto mb-4" />
            <p className="text-muted-foreground dark:text-white/70 mb-4">Niciun releveu încărcat pentru această proprietate.</p>
            <p className="text-sm text-muted-foreground/80 dark:text-white/55">
              Poți încărca o imagine sau un document PDF.
            </p>
          </div>
          <Button type="button" onClick={handleUploadClick} disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Încarcă RLV
          </Button>
        </div>
      )}
    </div>
  );
}
