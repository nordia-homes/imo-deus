
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

const getMatchedPropertyImageUrl = (property: Property, agencyId?: string | null) => {
  if (agencyId) {
    return `/api/public-property-image?agencyId=${encodeURIComponent(agencyId)}&propertyId=${encodeURIComponent(property.id)}`;
  }

  return property.images?.[0]?.url || 'https://placehold.co/800x600?text=Imagine+lipsa';
};

const isInternalPropertyImage = (imageUrl: string) => imageUrl.startsWith('/api/public-property-image?');


const MatchedPropertyCard = ({ property, onAddRecommendation, agencyId, contact }: { property: Property, onAddRecommendation: (property: Property) => void, agencyId: string | null | undefined, contact: Contact | null }) => {
  const imageUrl = getMatchedPropertyImageUrl(property, agencyId);
  const constructionYear = property.constructionYear;
  const scoreColor = (() => {
    const clamped = Math.max(0, Math.min(100, property.matchScore || 0));
    const hue = Math.round((clamped / 100) * 120);
    return `hsl(${hue} 78% 60%)`;
  })();
  
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
              unoptimized={isInternalPropertyImage(imageUrl)}
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, rgba(9, 17, 27, 0.04) 0%, rgba(9, 17, 27, 0.22) 48%, rgba(9, 17, 27, 0.78) 100%)' }}
          />
          <div
            className="agentfinder-recommended-image-label absolute right-4 top-4 shrink-0 rounded-2xl px-3 py-2 backdrop-blur-md shadow-[0_16px_40px_-18px_rgba(0,0,0,0.85)]"
            style={{ backgroundColor: 'rgba(8, 17, 27, 0.8)' }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#D7CCBC]/72">Scor</p>
            <p className="mt-0.5 text-base font-black leading-none" style={{ color: scoreColor }}>
              {property.matchScore}
              <span className="text-[11px] font-semibold text-[#D7CCBC]/82">/100</span>
            </p>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div
              className="agentfinder-recommended-image-label inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs text-white/92 backdrop-blur-md"
              style={{ backgroundColor: 'rgba(0, 0, 0, 0.35)' }}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
              <span className="truncate">{property.reasoning}</span>
            </div>
          </div>
      </div>
      <div className="flex flex-col gap-3 p-4 lg:gap-3.5">
        <div className="space-y-1.5">
          <div className="flex items-start gap-3">
            <Link href={`/properties/${property.id}`} className="block min-w-0 flex-1">
              <h4 className="truncate text-lg font-semibold leading-tight text-white transition-colors group-hover:text-emerald-200">{property.title}</h4>
            </Link>
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
            <p className="flex items-center justify-center text-sm font-semibold leading-none text-white">
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
          {property.zoneReasoning && (
            <div className="mt-2 flex flex-wrap gap-2">
              {property.zoneReasoning.split('·').map((item) => (
                <Badge
                  key={item}
                  variant="outline"
                  className="rounded-full border-emerald-300/16 bg-emerald-300/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-emerald-100"
                >
                  {item.trim()}
                </Badge>
              ))}
            </div>
          )}
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-white/88">{property.reasoning}</p>
        </div>

        <ZoneDebugPanel zoneDebug={property.zoneDebug} />

        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-white/45">Pret</p>
            <p className="mt-1 text-2xl font-black text-white">€{property.price.toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {contact?.phone && agencyId && (
              <Button onClick={handleWhatsAppShare} size="icon" className="agentfinder-button-secondary h-10 w-10 rounded-full border border-emerald-300/24 bg-emerald-500 text-white shadow-[0_12px_28px_-12px_rgba(34,197,94,0.8)] hover:bg-emerald-400">
                <WhatsappIcon className="h-5 w-5" />
              </Button>
            )}
            <Button onClick={handleAddClick} className="agentfinder-button-primary agentfinder-add-to-portal-button rounded-full bg-white px-3.5 text-sm text-slate-950 hover:bg-slate-100">
              Adauga in portal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ZoneDebugPanel = ({
  zoneDebug,
}: {
  zoneDebug?: { exact: number; adjacent: number; cluster: number; macro: number; penalty: number } | null;
}) => {
  if (!zoneDebug) return null;

  const toneForValue = (label: string, value: number) => {
    if (label === 'Penalty') {
      if (value <= 0.35) return 'border-rose-400/30 bg-rose-400/16 text-rose-100';
      if (value < 1) return 'border-amber-300/30 bg-amber-300/14 text-amber-100';
      return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100';
    }

    if (value >= 0.95) return 'border-emerald-300/30 bg-emerald-400/16 text-emerald-100';
    if (value >= 0.55) return 'border-sky-300/30 bg-sky-400/14 text-sky-100';
    if (value > 0) return 'border-violet-300/30 bg-violet-400/14 text-violet-100';
    return 'border-white/8 bg-white/5 text-white/55';
  };

  const items = [
    { label: 'Exact', value: zoneDebug.exact },
    { label: 'Adjacent', value: zoneDebug.adjacent },
    { label: 'Macro', value: zoneDebug.macro },
    { label: 'Penalty', value: zoneDebug.penalty },
  ];

  return (
    <div className="rounded-2xl border border-white/8 bg-[#07101a]/72 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">Debug zone</p>
      <div className="mt-2 grid grid-cols-[0.9fr_1.15fr_0.9fr_0.9fr] gap-2">
        {items.map((item) => (
          <div key={item.label} className={`rounded-xl border px-2 py-2 text-center ${toneForValue(item.label, item.value)}`}>
            <p className="text-[9px] uppercase tracking-[0.14em] opacity-70">{item.label}</p>
            <p className="mt-1 text-xs font-bold">{item.value}</p>
          </div>
        ))}
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
  const isAgentfinderTheme = agency?.themePreset === 'agentfinder';

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
    <Card
      className="agentfinder-recommendations-shell rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(52,211,153,0.16),transparent_32%),linear-gradient(180deg,#152A47_0%,#0C1828_100%)] text-white shadow-[0_32px_90px_-42px_rgba(0,0,0,0.95)] mx-2 lg:mx-0"
      style={isAgentfinderTheme ? { background: 'transparent', borderColor: 'transparent', boxShadow: 'none' } : undefined}
    >
        <div className="lg:hidden p-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">Selecție AI</p>
              <h3 className="font-semibold text-white text-base">Proprietăți Potrivite</h3>
            </div>
        </div>
        
        <CardContent
          className="agentfinder-recommendations-content px-4 pb-4 lg:p-0 relative"
          style={isAgentfinderTheme ? { background: 'transparent' } : undefined}
        >
             <div className="hidden lg:flex absolute top-5 left-5 z-10 items-start">
                <div className="agentfinder-recommended-image-label rounded-2xl border border-white/10 bg-[#09111b]/38 px-4 py-2.5 backdrop-blur-md">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/72">Selecție AI</p>
                  <p className="mt-1 text-sm font-semibold text-white">Proprietăți Potrivite</p>
                </div>
            </div>

            {singleProperty ? (
                <MatchedPropertyCard property={properties[0]} onAddRecommendation={onAddRecommendation} agencyId={agency?.id} contact={contact} />
            ) : (
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                  className="agentfinder-recommendations-carousel w-full"
                  style={isAgentfinderTheme ? { background: 'transparent' } : undefined}
                >
                  <CarouselContent
                    className="agentfinder-recommendations-track -ml-2 lg:-ml-3"
                    style={isAgentfinderTheme ? { background: 'transparent' } : undefined}
                  >
                    {properties.map((prop) => (
                      <CarouselItem key={prop.id} className="pl-2 md:basis-1/2 lg:basis-1/3 lg:pl-3">
                        <div className="h-full">
                          <MatchedPropertyCard property={prop} onAddRecommendation={onAddRecommendation} agencyId={agency?.id} contact={contact} />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-3 top-[26%] border-white/20 bg-[#09111b]/72 text-white shadow-lg hover:bg-[#09111b]/88" />
                  <CarouselNext className="right-3 top-[26%] border-white/20 bg-[#09111b]/72 text-white shadow-lg hover:bg-[#09111b]/88" />
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
