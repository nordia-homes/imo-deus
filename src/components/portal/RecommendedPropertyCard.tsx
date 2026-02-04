'use client';
import { useState } from 'react';
import type { Property, PortalRecommendation } from '@/lib/types';
import { useFirestore, updateDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import Image from 'next/image';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from '../ui/badge';
import Link from 'next/link';

interface RecommendedPropertyCardProps {
  property: Property;
  recommendation: PortalRecommendation;
  portalId: string;
  agencyId: string;
  contactId: string;
}

export function RecommendedPropertyCard({ property, recommendation, portalId, agencyId, contactId }: RecommendedPropertyCardProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const [comment, setComment] = useState(recommendation.clientComment || '');
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | 'none'>(recommendation.clientFeedback);

  const recommendationRef = doc(firestore, 'portals', portalId, 'recommendations', recommendation.id);
  const contactRef = doc(firestore, 'agencies', agencyId, 'contacts', contactId);

  const handleFeedback = (newFeedback: 'liked' | 'disliked') => {
    const finalFeedback = feedback === newFeedback ? 'none' : newFeedback;
    setFeedback(finalFeedback);
    
    // Update live portal
    updateDocumentNonBlocking(recommendationRef, { clientFeedback: finalFeedback });
    // Update permanent history on contact
    updateDocumentNonBlocking(contactRef, {
      [`recommendationHistory.${recommendation.id}.clientFeedback`]: finalFeedback,
    });

    toast({ title: 'Feedback trimis!', description: 'Mulțumim pentru părerea ta.' });
  };

  const handleSaveComment = () => {
    // Update live portal
    updateDocumentNonBlocking(recommendationRef, { clientComment: comment });
    // Update permanent history on contact
    updateDocumentNonBlocking(contactRef, {
      [`recommendationHistory.${recommendation.id}.clientComment`]: comment,
    });
    
    toast({ title: 'Comentariu salvat!', description: 'Agentul tău a fost notificat.' });
  };
  
  const hasImages = property.images && property.images.length > 0;
  
  return (
    <Card className="overflow-hidden shadow-2xl rounded-2xl">
      <Carousel opts={{ loop: hasImages }} className="relative group">
        <CarouselContent>
          {hasImages ? property.images.map((image, index) => (
            <CarouselItem key={index}>
              <div className="aspect-video relative bg-muted">
                <Image
                  src={image.url}
                  alt={image.alt || property.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
            </CarouselItem>
          )) : (
            <CarouselItem>
              <div className="aspect-video relative bg-muted flex items-center justify-center">
                  <p className="text-muted-foreground">Imagine indisponibilă</p>
              </div>
            </CarouselItem>
          )}
        </CarouselContent>
        {hasImages && property.images.length > 1 && (
            <>
            <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
            <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </>
        )}
      </Carousel>
      <CardHeader>
        <CardTitle>{property.title}</CardTitle>
        <CardDescription>{property.address}</CardDescription>
        <div className="flex justify-between items-center pt-2">
            <p className="text-2xl font-bold text-primary">€{property.price.toLocaleString()}</p>
            <Link href={`/agencies/${property.agentId}/properties/${property.id}`} passHref target="_blank">
                <Button variant="outline" size="sm">Vezi Detalii</Button>
            </Link>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{property.description}</p>
      </CardContent>
      <CardFooter className="bg-muted/50 p-4 flex flex-col items-start gap-4">
        <div>
          <h4 className="font-semibold mb-2">Părerea ta despre această proprietate:</h4>
          <div className="flex gap-2">
            <Button
              variant={feedback === 'liked' ? 'default' : 'outline'}
              size="icon"
              onClick={() => handleFeedback('liked')}
              className={cn(feedback === 'liked' && 'bg-green-600 hover:bg-green-700')}
            >
              <ThumbsUp />
            </Button>
            <Button
              variant={feedback === 'disliked' ? 'default' : 'outline'}
              size="icon"
              onClick={() => handleFeedback('disliked')}
               className={cn(feedback === 'disliked' && 'bg-red-600 hover:bg-red-700')}
            >
              <ThumbsDown />
            </Button>
          </div>
        </div>
        <div className="w-full space-y-2">
            <h4 className="font-semibold">Lasă un comentariu pentru agent:</h4>
            <Textarea 
                placeholder="Ex: Îmi place locația, dar aș prefera un etaj superior..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
            />
            <Button onClick={handleSaveComment} size="sm" disabled={!comment}>Salvează Comentariul</Button>
        </div>
      </CardFooter>
    </Card>
  );
}
