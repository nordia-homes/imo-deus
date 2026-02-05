'use client';

import { useState } from 'react';
import type { Property } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useStorage, useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2, ExternalLink } from 'lucide-react';

interface RlvTabProps {
  property: Property;
}

export function RlvTab({ property }: RlvTabProps) {
  const { agencyId } = useAgency();
  const storage = useStorage();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !agencyId) return;

    if (file.type !== 'application/pdf') {
      toast({
        variant: 'destructive',
        title: 'Format invalid',
        description: 'Vă rugăm să încărcați un fișier PDF.',
      });
      return;
    }

    setIsUploading(true);
    toast({ title: 'Încărcare RLV...', description: 'Fișierul este trimis către server.' });

    try {
      const rlvRef = ref(storage, `properties/${agencyId}/${property.id}/rlv.pdf`);
      await uploadBytes(rlvRef, file);
      const downloadURL = await getDownloadURL(rlvRef);

      const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
      await updateDocumentNonBlocking(propertyRef, { rlvUrl: downloadURL });

      toast({ title: 'RLV încărcat cu succes!' });
    } catch (error) {
      console.error('RLV upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Încărcare eșuată',
        description: 'A apărut o eroare la încărcarea fișierului. Vă rugăm să reîncercați.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9]">
      <CardHeader>
        <CardTitle>Releveu Proprietate (RLV)</CardTitle>
        <CardDescription>
          Vizualizează sau încarcă releveul pentru această proprietate. Fișierul trebuie să fie în format PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {property.rlvUrl ? (
          <div className="space-y-4">
             <div className="p-8 border rounded-lg bg-background flex flex-col items-center justify-center">
                <FileText className="h-16 w-16 text-primary mb-4" />
                <h3 className="font-semibold">RLV-ul este disponibil.</h3>
             </div>
             <Button asChild>
                <a href={property.rlvUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Descarcă / Vizualizează RLV
                </a>
            </Button>
          </div>
        ) : (
          <div className="p-8 border-2 border-dashed rounded-lg">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">Niciun RLV încărcat pentru această proprietate.</p>
            <Button asChild variant="outline" disabled={isUploading}>
              <label htmlFor="rlv-upload" className="cursor-pointer">
                {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Upload className="mr-2 h-4 w-4" />
                )}
                Încarcă RLV (PDF)
                <Input id="rlv-upload" type="file" className="hidden" accept="application/pdf" onChange={handleFileChange} />
              </label>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
