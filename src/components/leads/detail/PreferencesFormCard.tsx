'use client';

import { useState } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Contact, Agency } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link as LinkIcon, Loader2, RefreshCw, Send } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface PreferencesFormCardProps {
  contact: Contact;
  agency: Agency;
}

export function PreferencesFormCard({ contact, agency }: PreferencesFormCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const preferencesLink = contact.preferencesLinkId ? `${window.location.origin}/preferences/${contact.preferencesLinkId}` : '';

  const handleGenerateLink = async () => {
    setIsLoading(true);

    const contactRef = doc(firestore, 'agencies', agency.id, 'contacts', contact.id);

    try {
      const batch = writeBatch(firestore);
      const newLinkId = crypto.randomUUID();
      const newLinkRef = doc(firestore, 'buyer-preferences-links', newLinkId);
      
      const linkData = {
        contactId: contact.id,
        agencyId: agency.id,
        createdAt: new Date().toISOString(),
      };
      
      batch.set(newLinkRef, linkData);
      batch.update(contactRef, { preferencesLinkId: newLinkId });

      await batch.commit();
      
      toast({ title: 'Link generat!', description: 'Acum poți copia linkul și să-l trimiți clientului.' });

    } catch (e: any) {
        console.error("Failed to generate preferences link", e);
        toast({ variant: 'destructive', title: 'Eroare', description: e.message || 'Nu am putut genera linkul. Vă rugăm să reîncercați.' });
    } finally {
        setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(preferencesLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copiat!' });
  };

  return (
    <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
      <CardHeader className="p-4 pb-2 lg:p-6 lg:pb-4">
        <CardTitle className="flex items-center gap-2 text-base text-white">
          <Send className="h-5 w-5 text-primary" />
          <span>Formular Preferințe Client</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 lg:p-6 lg:pt-0">
        <p className="text-xs text-white/70">
          Trimite-i clientului un link personalizat pentru a completa sau actualiza preferințele de căutare.
        </p>
        {preferencesLink ? (
          <>
            <div>
              <Label htmlFor="preferences-link" className="text-xs text-white/70">Link Formular</Label>
              <div className="flex gap-2 mt-1">
                <Input id="preferences-link" readOnly value={preferencesLink} className="bg-white/10 border-white/20 h-9" />
                <Button variant="secondary" size="icon" onClick={handleCopy} className="agentfinder-sidebar-button agentfinder-sidebar-button--icon h-9 w-9 shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button variant="secondary" size="icon" onClick={handleGenerateLink} disabled={isLoading} className="agentfinder-sidebar-button agentfinder-sidebar-button--icon h-9 w-9 shrink-0">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </div>
            </div>
             <Button size="sm" variant="secondary" onClick={() => window.open(preferencesLink, '_blank')} disabled={isLoading} className="agentfinder-sidebar-button agentfinder-sidebar-button--full w-full">
                <LinkIcon className="mr-2 h-4 w-4" /> Deschide Formular
              </Button>
          </>
        ) : (
          <Button onClick={handleGenerateLink} disabled={isLoading} className="agentfinder-sidebar-button agentfinder-sidebar-button--full h-11 w-full rounded-full">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Generează Link Formular
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
