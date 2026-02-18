
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property, Contact, MatchedProperty, Agency } from '@/lib/types';
import Image from 'next/image';
import { ArrowRight, BedDouble, Ruler, Calendar, Plus, Layers } from 'lucide-react';
import Link from 'next/link';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { useState } from 'react';
import { useFirestore, useUser, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Check, Copy, Link as LinkIcon, Loader2, RefreshCw, Star, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const sanitizeForWhatsapp = (phone?: string | null) => {
    if (!phone) return '';
    let sanitized = phone.replace(/\D/g, '');
    if (sanitized.length === 10 && sanitized.startsWith('07')) {
        return `40${sanitized.substring(1)}`;
    }
    return sanitized;
};


const MatchedPropertyCard = ({ property, onAddRecommendation, agencyId, contact }: { property: Property, onAddRecommendation: (property: Property) => void, agencyId: string | null | undefined, contact: Contact | null }) => {
  const imageUrl = property.images?.[0]?.url || 'https://placehold.co/800x600?text=Imagine+lipsa';
  const constructionYear = property.constructionYear;
  
  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAddRecommendation(property);
  }

  const handleWhatsAppShare = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!agencyId || !contact?.phone) return;

      const propertyUrl = `${window.location.origin}/agencies/${agencyId}/properties/${property.id}`;
      const message = `Salut, ${contact.name}! Cred că această proprietate ți s-ar potrivi: ${propertyUrl}`;
      const sanitizedPhone = sanitizeForWhatsapp(contact.phone);
      const whatsappUrl = `https://wa.me/${sanitizedPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-slate-900 text-white shadow-lg h-full flex flex-col">
      <div className="relative aspect-video lg:aspect-[16/6] w-full">
          <Image
              src={imageUrl}
              alt={property.title || 'Proprietate'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
          />
           <div className="hidden lg:flex absolute bottom-2 left-2 right-2 justify-start items-center gap-2">
                <Button variant="secondary" size="sm" className="pointer-events-none h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                    <BedDouble className="mr-1.5 h-4 w-4" /> {property.rooms} camere
                </Button>
                 <Button variant="secondary" size="sm" className="pointer-events-none h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                    <Ruler className="mr-1.5 h-4 w-4" /> {property.squareFootage} mp
                </Button>
                {property.floor && (
                    <Button variant="secondary" size="sm" className="pointer-events-none h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                        <Layers className="mr-1.5 h-4 w-4" /> Et. {property.floor}
                    </Button>
                )}
                {constructionYear && (
                    <Button variant="secondary" size="sm" className="pointer-events-none h-auto py-1 px-2 text-xs bg-black/50 text-white hover:bg-black/70">
                        <Calendar className="mr-1.5 h-4 w-4" /> {constructionYear}
                    </Button>
                )}
            </div>
      </div>
      <div className="relative p-4 space-y-3 flex-1 flex flex-col">
        <Link href={`/properties/${property.id}`} className="block">
          <h4 className="font-bold text-lg hover:underline break-words">{property.title}</h4>
        </Link>
        <p className="text-sm text-slate-300 break-words">{property.address}</p>
        
        <div className="lg:hidden flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300 pt-2">
            <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4 text-slate-400" /> {property.rooms}</span>
            <span className="flex items-center gap-1.5"><Ruler className="h-4 w-4 text-slate-400" /> {property.squareFootage} mp</span>
            {constructionYear && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-slate-400" /> {constructionYear}</span>}
        </div>
        
        <div className="pt-2 mt-auto flex justify-between items-end">
            <p className="text-2xl font-extrabold text-white">€{property.price.toLocaleString()}</p>
             <div className="flex items-center gap-2">
                 {contact?.phone && agencyId && (
                    <Button onClick={handleWhatsAppShare} size="icon" className="bg-green-500 hover:bg-green-600 text-white rounded-full h-10 w-10">
                        <WhatsappIcon className="h-5 w-5" />
                    </Button>
                 )}
                 <Button onClick={handleAddClick} size="icon" className="bg-blue-500 hover:bg-blue-600 text-white rounded-full h-10 w-10">
                    <Plus className="h-5 w-5" />
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};


export function MatchedProperties({ properties, onAddRecommendation, agency, contact, showPortalManager }: { properties: MatchedProperty[], onAddRecommendation: (property: Property) => void, agency: Agency | null, contact: Contact | null, showPortalManager?: boolean }) {
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isLoadingPortal, setIsLoadingPortal] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalLink = contact?.portalId ? `${window.location.origin}/portal/${contact.portalId}` : '';

  const handlePortalAction = (action: 'activate' | 'regenerate' | 'deactivate') => {
    if (!user || !agency || !contact) return;
    setIsLoadingPortal(true);

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
    
    setIsLoadingPortal(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Link copiat!' });
  };
  
  if (!properties || properties.length === 0) {
    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none mx-2 lg:mx-0">
            <CardHeader className="p-4">
                <CardTitle className="font-semibold text-white text-base">Proprietăți Potrivite</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-white/70 py-6">
            Nicio proprietate potrivită găsită.
            </CardContent>
            {showPortalManager && agency && contact && (
                <>
                    <Separator className="bg-white/20 mx-4" />
                    <div className="p-4">
                        <CardTitle className="flex items-center gap-2 text-white text-base mb-3">
                            <Star className="text-yellow-500" />
                            <span>Portalul Clientului</span>
                        </CardTitle>
                        <div className="space-y-3">
                            <p className="text-xs text-white/70">
                                Oferă clientului un link unde poate vedea proprietățile recomandate și oferi feedback.
                            </p>
                            {contact.portalId ? (
                            <>
                                <div>
                                <Label htmlFor="portal-link-empty" className="text-xs text-white/70">Link Unic Portal</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input id="portal-link-empty" readOnly value={portalLink} className="bg-white/10 border-white/20 h-9" />
                                    <Button variant="secondary" size="icon" onClick={handleCopy} className="h-9 w-9 shrink-0 bg-white/20 hover:bg-white/30">
                                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                    </Button>
                                </div>
                                </div>
                                <div className="flex items-center gap-2">
                                <Button size="sm" variant="secondary" onClick={() => window.open(portalLink, '_blank')} disabled={isLoadingPortal} className="bg-white/90 text-black hover:bg-white flex-1">
                                    <LinkIcon className="mr-2 h-4 w-4" /> Deschide
                                </Button>
                                <Button size="icon" variant="secondary" onClick={() => handlePortalAction('regenerate')} disabled={isLoadingPortal} className="bg-white/20 hover:bg-white/30">
                                    {isLoadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                </Button>
                                <Button size="icon" variant="destructive" onClick={() => handlePortalAction('deactivate')} disabled={isLoadingPortal}>
                                    {isLoadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                                </div>
                            </>
                            ) : (
                            <Button onClick={() => handlePortalAction('activate')} disabled={isLoadingPortal} className="w-full bg-primary hover:bg-primary/90 text-white">
                                {isLoadingPortal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                                Activează Portalul
                            </Button>
                            )}
                        </div>
                    </div>
                </>
            )}
      </Card>
    );
  }
  
  const singleProperty = properties.length === 1;

  return (
    <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none mx-2 lg:mx-0">
        <div className="lg:hidden p-4 flex flex-row items-center justify-between">
            <h3 className="font-semibold text-white text-base">Proprietăți Potrivite</h3>
            <Button variant="link" size="sm" asChild className="text-white">
              <Link href="/matching">
                  Vezi toate
              </Link>
            </Button>
        </div>
        
        <CardContent className="px-4 pb-4 lg:p-0 relative">
             <div className="hidden lg:flex absolute top-4 left-4 right-4 z-10 justify-between items-start">
                <Button variant="secondary" className="bg-black/50 text-white hover:bg-black/70 pointer-events-none">
                  Proprietăți Potrivite
                </Button>
                <Button variant="secondary" asChild className="bg-black/50 text-white hover:bg-black/70">
                  <Link href="/matching">
                      Vezi toate
                  </Link>
                </Button>
            </div>

            {singleProperty ? (
                <MatchedPropertyCard property={properties[0]} onAddRecommendation={onAddRecommendation} agencyId={agency?.id} contact={contact} />
            ) : (
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                  className="w-full"
                >
                  <CarouselContent className="lg:m-0">
                    {properties.map((prop) => (
                      <CarouselItem key={prop.id} className="md:basis-1/2 lg:basis-full lg:p-0">
                        <div className="h-full">
                          <MatchedPropertyCard property={prop} onAddRecommendation={onAddRecommendation} agencyId={agency?.id} contact={contact} />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-2 bg-white/20 border-white/30 text-white hover:bg-white/30" />
                  <CarouselNext className="right-2 bg-white/20 border-white/30 text-white hover:bg-white/30" />
                </Carousel>
            )}
        </CardContent>
         {showPortalManager && agency && contact && (
            <>
                <Separator className="bg-white/20 mx-4" />
                <div className="p-4">
                    <CardTitle className="flex items-center gap-2 text-white text-base mb-3">
                        <Star className="text-yellow-500" />
                        <span>Portalul Clientului</span>
                    </CardTitle>
                    <div className="space-y-3">
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
                            <Button size="sm" variant="secondary" onClick={() => window.open(portalLink, '_blank')} disabled={isLoadingPortal} className="bg-white/90 text-black hover:bg-white flex-1">
                                <LinkIcon className="mr-2 h-4 w-4" /> Deschide
                            </Button>
                            <Button size="icon" variant="secondary" onClick={() => handlePortalAction('regenerate')} disabled={isLoadingPortal} className="bg-white/20 hover:bg-white/30">
                                {isLoadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            </Button>
                            <Button size="icon" variant="destructive" onClick={() => handlePortalAction('deactivate')} disabled={isLoadingPortal}>
                                {isLoadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                            </div>
                        </>
                        ) : (
                        <Button onClick={() => handlePortalAction('activate')} disabled={isLoadingPortal} className="w-full bg-primary hover:bg-primary/90 text-white">
                            {isLoadingPortal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Star className="mr-2 h-4 w-4" />}
                            Activează Portalul
                        </Button>
                        )}
                    </div>
                </div>
            </>
        )}
    </Card>
  );
}
