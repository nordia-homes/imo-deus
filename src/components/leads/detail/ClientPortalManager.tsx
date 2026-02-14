'use client';

import { useState } from 'react';
import { useFirestore, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Contact, Agency } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link as LinkIcon, Loader2, RefreshCw, Star, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ClientPortalManagerProps {
  contact: Contact;
  agency: Agency;
}

export function ClientPortalManager({ contact, agency }: ClientPortalManagerProps) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalLink = contact.portalId ? `${window.location.origin}/portal/${contact.portalId}` : '';

  const handlePortalAction = (action: 'activate' | 'regenerate' | 'deactivate') => {
    if (!user) return;
    setIsLoading(true);

    const contactRef = doc(firestore, 'agencies', agency.id, 'contacts', contact.id);

    if (action === 'activate' || action === 'regenerate') {
      if (action === 'regenerate' && contact.portalId) {
        const oldPortalRef = doc(firestore, 'portals', contact.portalId);
        deleteDocumentNonBlocking(oldPortalRef);
      }

      const newPortalToken = crypto.randomUUID();
      const newPortalRef = doc(firestore, 'portals', newPortalToken);
      
      const portalData = {
        contactId: contact.id,
        agencyId: agency.id,
        contactName: contact.name,
        agentName: user.displayName || user.email,
        createdAt: new Date().toISOString(),
      };
      
      setDocumentNonBlocking(newPortalRef, portalData, {}); 
      updateDocumentNonBlocking(contactRef, { portalId: newPortalToken });
      
      toast({ title: 'Portal activat!', description: 'Linkul unic pentru client a fost generat.' });

    } else if (action === 'deactivate' && contact.portalId) {
      const portalRef = doc(firestore, 'portals', contact.portalId);
      deleteDocumentNonBlocking(portalRef);
      updateDocumentNonBlocking(contactRef, { portalId: null });
      toast({ title: 'Portal dezactivat!', variant: 'destructive' });
    }
    
    setIsLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copiat!' });
  };

  return (
    <Card className="mx-2 bg-[#152A47] text-white border-none rounded-2xl lg:mx-0 shadow-2xl">
      <CardHeader className="p-4 pb-2 lg:pb-2">
        <CardTitle className="flex items-center gap-2 text-white text-base">
            <Star className="text-yellow-500" />
            <span>Portalul Clientului</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 lg:p-6 lg:pt-0">
        <p className="text-xs text-white/70">
          Oferă clientului un link unde poate vedea proprietățile recomandate și oferi feedback.
        </p>
        {contact.portalId ? (
          <>
            <div>
              <Label htmlFor="portal-link" className="text-xs text-white/70">Link Unic Portal</Label>
              <div className="flex gap-2 mt-1">
                <Input id="portal-link" readOnly value={portalLink} className="bg-white/10 border-white/20 h-9" />
                <Button variant="secondary" size="icon" onClick={handleCopy} className="h-9 w-9 shrink-0 bg-white/20 hover:bg-white/30">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => window.open(portalLink, '_blank')} disabled={isLoading} className="bg-white/90 text-black hover:bg-white flex-1">
                <LinkIcon className="mr-2 h-4 w-4" /> Deschide
              </Button>
              <Button size="icon" variant="secondary" onClick={() => handlePortalAction('regenerate')} disabled={isLoading} className="bg-white/20 hover:bg-white/30">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="destructive" onClick={() => handlePortalAction('deactivate')} disabled={isLoading}>
                 {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={() => handlePortalAction('activate')} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-white">
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
            Activează Portalul
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
