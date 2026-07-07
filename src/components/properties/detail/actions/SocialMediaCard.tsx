'use client';

import { signOut } from 'firebase/auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  ExternalLink,
  Globe2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Share2,
  ThumbsUp,
} from 'lucide-react';
import type { MetaFacebookPagePost, Property } from '@/lib/types';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useAgency } from '@/context/AgencyContext';
import { useAuth, useUser } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { ACTION_CARD_INTERACTIVE_CLASSNAME, ACTION_PILL_CLASSNAME } from './cardStyles';

async function authorizedFetch(
  user: NonNullable<ReturnType<typeof useUser>['user']>,
  auth: ReturnType<typeof useAuth>,
  input: RequestInfo,
  init?: RequestInit,
) {
  let token: string;
  try {
    token = await user.getIdToken(true);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message.includes('auth/invalid-credential') || message.includes('invalid-credential')) {
      await signOut(auth).catch(() => undefined);
      throw new Error('Sesiunea Firebase nu mai este valida. Autentifica-te din nou si reincearca.');
    }
    throw error;
  }

  return fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

function buildFacebookPreviewText(property: Property) {
  return [property.title, property.description]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n\n')
    .trim();
}

function FacebookImageGrid({ property }: { property: Property }) {
  const images = property.images?.filter((image) => image?.url).slice(0, 5) || [];
  const remainingCount = Math.max((property.images?.length || 0) - 5, 0);

  if (!images.length) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
        Fara fotografii
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <Image src={images[0].url} alt={images[0].alt || property.title} fill className="object-cover" sizes="520px" />
      </div>
    );
  }

  if (images.length === 2) {
    return (
      <div className="grid aspect-[1.6/1] grid-cols-2 gap-1 overflow-hidden bg-white">
        {images.map((image, index) => (
          <div key={`${image.url}-${index}`} className="relative bg-slate-100">
            <Image src={image.url} alt={image.alt || property.title} fill className="object-cover" sizes="260px" />
          </div>
        ))}
      </div>
    );
  }

  if (images.length === 3) {
    return (
      <div className="grid aspect-[1.2/1] grid-cols-2 gap-1 overflow-hidden bg-white">
        <div className="relative bg-slate-100">
          <Image src={images[0].url} alt={images[0].alt || property.title} fill className="object-cover" sizes="260px" />
        </div>
        <div className="grid grid-rows-2 gap-1">
          {images.slice(1).map((image, index) => (
            <div key={`${image.url}-${index}`} className="relative bg-slate-100">
              <Image src={image.url} alt={image.alt || property.title} fill className="object-cover" sizes="260px" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (images.length === 4) {
    return (
      <div className="grid aspect-square grid-cols-2 gap-1 overflow-hidden bg-white">
        {images.map((image, index) => (
          <div key={`${image.url}-${index}`} className="relative bg-slate-100">
            <Image src={image.url} alt={image.alt || property.title} fill className="object-cover" sizes="260px" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid aspect-[1.04/1] grid-cols-2 gap-1 overflow-hidden bg-white">
      <div className="relative min-h-0 bg-slate-100">
        <Image src={images[0].url} alt={images[0].alt || property.title} fill className="object-cover" sizes="260px" />
      </div>
      <div className="grid min-h-0 grid-cols-2 gap-1">
        {images.slice(1, 5).map((image, index) => {
          const showOverlay = index === 3 && remainingCount > 0;
          return (
            <div key={`${image.url}-${index}`} className="relative min-h-0 bg-slate-100">
              <Image src={image.url} alt={image.alt || property.title} fill className="object-cover" sizes="130px" />
              {showOverlay ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-4xl font-semibold text-white">
                  +{remainingCount}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SocialMediaCard({ property }: { property: Property }) {
  const { agency } = useAgency();
  const { user } = useUser();
  const auth = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPublishingFacebook, setIsPublishingFacebook] = useState(false);
  const [facebookPost, setFacebookPost] = useState<MetaFacebookPagePost | null>(property.metaFacebookPost || null);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const previewText = buildFacebookPreviewText(property);
  const pageName = facebookPost?.pageName || agency?.name || 'Pagina Facebook';

  const handlePublishFacebook = async () => {
    if (!user || !property.id || isPublishingFacebook) return;
    setIsPublishingFacebook(true);
    try {
      const response = await authorizedFetch(user, auth, '/api/marketing/meta/property-posts', {
        method: 'POST',
        body: JSON.stringify({ propertyId: property.id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Nu am putut publica proprietatea pe Facebook.');
      }
      setFacebookPost(payload.post as MetaFacebookPagePost);
      toast({
        title: 'Publicata pe Facebook',
        description: 'Proprietatea a fost publicata pe pagina agentiei, cu descrierea si pozele din anunt.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Publicare Facebook esuata',
        description: error instanceof Error ? error.message : 'Nu am putut publica proprietatea pe Facebook.',
      });
    } finally {
      setIsPublishingFacebook(false);
    }
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Card className={cn(`${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0 cursor-pointer`)}>
          <CardContent className="flex w-full items-center justify-between p-2">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', ACTION_PILL_CLASSNAME)}>
                <Share2 className="h-4 w-4 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-white">Publica pe pagina ta Facebook</p>
                <p className="text-xs text-white/60">Posteaza proprietatea cu descrierea si pozele din anunt.</p>
              </div>
            </div>
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
              <Send className="h-4 w-4 text-emerald-200" />
            </div>
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent
        className={cn(
          'border-none bg-white p-0 text-slate-950 shadow-2xl sm:max-w-[640px]',
          isMobile && 'h-screen w-screen max-w-full rounded-none',
        )}
      >
        <DialogHeader className="border-b border-slate-200 px-6 py-5 text-left">
          <DialogTitle className="text-2xl font-semibold tracking-tight">Publica pe pagina ta Facebook</DialogTitle>
          <DialogDescription className="text-slate-500">
            Verifica previzualizarea si publica postarea organic, fara buget de promovare.
          </DialogDescription>
        </DialogHeader>

        <div className={cn('max-h-[72vh] overflow-y-auto bg-slate-100/70 px-4 py-5', isMobile && 'max-h-[calc(100vh-190px)]')}>
          <div className="mx-auto overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-slate-200 sm:max-w-[520px]">
            <div className="flex items-start justify-between px-4 pb-3 pt-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border border-slate-200">
                  <AvatarImage src={agency?.logoUrl || undefined} alt={pageName} />
                  <AvatarFallback className="bg-slate-950 text-white">{pageName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[17px] font-bold leading-tight text-slate-950">{pageName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[15px] leading-tight text-slate-500">
                    Chiar acum
                    <span aria-hidden="true">·</span>
                    <Globe2 className="h-4 w-4" />
                  </p>
                </div>
              </div>
              <MoreHorizontal className="mt-1 h-7 w-7 text-slate-500" />
            </div>

            <div className="px-4 pb-3">
              <p className="whitespace-pre-wrap text-[21px] leading-[1.18] tracking-normal text-slate-950">
                {previewText || 'Descrierea proprietatii va aparea aici.'}
              </p>
            </div>

            <FacebookImageGrid property={property} />

            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 text-slate-600">
              <button type="button" className="flex items-center gap-2 text-[15px] font-semibold">
                <ThumbsUp className="h-6 w-6" />
                Apreciaza
              </button>
              <button type="button" className="flex items-center gap-2 text-[15px] font-semibold">
                <MessageCircle className="h-6 w-6" />
                Comenteaza
              </button>
              <button type="button" className="flex items-center gap-2 text-[15px] font-semibold">
                <Share2 className="h-6 w-6" />
                Distribuie
              </button>
            </div>
          </div>

          {facebookPost ? (
            <div className="mx-auto mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:max-w-[520px]">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className={cn(
                    'mt-0.5 h-5 w-5',
                    facebookPost.status === 'error' ? 'text-red-500' : 'text-emerald-600',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-950">
                    {facebookPost.status === 'error'
                      ? 'Eroare la publicare'
                      : facebookPost.status === 'publishing'
                        ? 'Se publica...'
                        : `Publicata pe ${facebookPost.pageName || 'Facebook'}`}
                  </p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {facebookPost.errorMessage || `${facebookPost.imageCount} fotografii au fost trimise catre pagina Facebook.`}
                  </p>
                </div>
                {facebookPost.permalinkUrl ? (
                  <Button asChild variant="outline" size="icon" className="h-10 w-10 rounded-full">
                    <a href={facebookPost.permalinkUrl} target="_blank" rel="noopener noreferrer" aria-label="Deschide postarea Facebook">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          {facebookPost?.permalinkUrl ? (
            <Button asChild variant="outline" className="rounded-full">
              <a href={facebookPost.permalinkUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Vezi postarea
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            className="rounded-full bg-[#1877F2] px-6 text-white hover:bg-[#166FE5]"
            onClick={() => void handlePublishFacebook()}
            disabled={isPublishingFacebook || !user}
          >
            {isPublishingFacebook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            {facebookPost?.status === 'published' ? 'Publica din nou' : 'Publica pe Facebook'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
