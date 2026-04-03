
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Property, Contact, MatchedProperty, Agency } from '@/lib/types';
import Image from 'next/image';
import { BedDouble, Ruler, Calendar, Plus, Layers, MapPin, Sparkles } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';

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
  const scoreTone =
    property.matchScore >= 85
      ? 'from-emerald-300 to-emerald-500 text-emerald-950'
      : property.matchScore >= 70
        ? 'from-sky-300 to-cyan-500 text-slate-950'
        : 'from-amber-200 to-orange-400 text-amber-950';
  
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
    <div className="group relative h-full overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(22,42,71,0.98)_0%,rgba(10,20,34,1)_100%)] text-white shadow-[0_28px_70px_-30px_rgba(0,0,0,0.85)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
          <Image
              src={imageUrl}
              alt={property.title || 'Proprietate'}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#09111b] via-[#09111b]/45 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-xs text-white/92 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="truncate">{property.reasoning}</span>
            </div>
          </div>
      </div>
      <div className="flex flex-col gap-3 p-4 lg:gap-3.5">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/properties/${property.id}`} className="block min-w-0 flex-1">
              <h4 className="line-clamp-2 text-lg font-semibold leading-tight text-white transition-colors group-hover:text-emerald-200">{property.title}</h4>
            </Link>
            <div className={`shrink-0 rounded-full bg-gradient-to-r px-3 py-1.5 text-sm font-black shadow-lg ${scoreTone}`}>
              {property.matchScore}/100
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm text-slate-300">
            <MapPin className="h-4 w-4 text-slate-400" />
            <span className="line-clamp-1">{property.address || property.location}</span>
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl border border-white/8 bg-white/6 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-none text-white">
              <BedDouble className="h-3 w-3 text-white/60" />
              <span>{property.rooms || '-'}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/6 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-none text-white">
              <Ruler className="h-3 w-3 text-white/60" />
              <span>{property.squareFootage || '-'} mp</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/6 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-none text-white">
              <Layers className="h-3 w-3 text-white/60" />
              <span>{property.floor || '-'}</span>
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-white/6 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold leading-none text-white">
              <Calendar className="h-3 w-3 text-white/60" />
              <span>{constructionYear || '-'}</span>
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-300/12 bg-emerald-400/8 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">De ce se potriveste</p>
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-white/88">{property.reasoning}</p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Pret</p>
            <p className="mt-1 text-2xl font-black text-white">€{property.price.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {contact?.phone && agencyId && (
              <Button onClick={handleWhatsAppShare} size="icon" className="h-10 w-10 rounded-full border border-emerald-300/24 bg-emerald-500 text-white shadow-[0_12px_28px_-12px_rgba(34,197,94,0.8)] hover:bg-emerald-400">
                <WhatsappIcon className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={handleAddClick} className="rounded-full bg-white px-3.5 text-sm text-slate-950 hover:bg-slate-100">
              Adauga in portal
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
                    <Separator className="bg-white/20" />
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
    <Card className="rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.16),transparent_32%),linear-gradient(180deg,#152A47_0%,#0C1828_100%)] text-white shadow-[0_32px_90px_-42px_rgba(0,0,0,0.95)] mx-2 lg:mx-0">
        <div className="lg:hidden p-4 flex flex-row items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">Selecție AI</p>
              <h3 className="font-semibold text-white text-base">Proprietăți Potrivite</h3>
            </div>
            <Button variant="link" size="sm" asChild className="text-emerald-100">
              <Link href="/matching">
                  Cautare aprofundata
              </Link>
            </Button>
        </div>
        
        <CardContent className="px-4 pb-4 lg:p-0 relative">
             <div className="hidden lg:flex absolute top-5 left-5 right-5 z-10 justify-between items-start">
                <div className="rounded-2xl border border-white/10 bg-[#09111b]/38 px-4 py-2.5 backdrop-blur-md">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">Selecție AI</p>
                  <p className="mt-1 text-sm font-semibold text-white">Proprietăți Potrivite</p>
                </div>
                <Button variant="secondary" asChild className="rounded-full border border-white/10 bg-black/28 text-white backdrop-blur-md hover:bg-black/40">
                  <Link href="/matching">
                      Cautare aprofundata
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
                  <CarouselContent className="-ml-2 lg:-ml-3">
                    {properties.map((prop) => (
                      <CarouselItem key={prop.id} className="pl-2 md:basis-1/2 lg:basis-1/3 lg:pl-3">
                        <div className="h-full">
                          <MatchedPropertyCard property={prop} onAddRecommendation={onAddRecommendation} agencyId={agency?.id} contact={contact} />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-3 top-[30%] border-white/20 bg-[#09111b]/72 text-white shadow-lg hover:bg-[#09111b]/88" />
                  <CarouselNext className="right-3 top-[30%] border-white/20 bg-[#09111b]/72 text-white shadow-lg hover:bg-[#09111b]/88" />
                </Carousel>
            )}
        </CardContent>
         {showPortalManager && agency && contact && (
            <>
                <Separator className="bg-white/20 px-4" />
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
