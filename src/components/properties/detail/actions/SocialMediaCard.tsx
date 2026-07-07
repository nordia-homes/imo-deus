'use client';
import { signOut } from "firebase/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, Rocket, Loader2, Copy, Check, ThumbsUp, MessageCircle, Share, Globe, Send, ExternalLink } from "lucide-react";
import type { MetaFacebookPagePost, Property } from "@/lib/types";
import { generateSocialMediaPost } from "@/ai/flows/social-media-post-generator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useAgency } from "@/context/AgencyContext";
import { useAuth, useUser } from "@/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Skeleton } from "../../../ui/skeleton";
import { ACTION_CARD_INTERACTIVE_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";

async function authorizedFetch(
    user: NonNullable<ReturnType<typeof useUser>['user']>,
    auth: ReturnType<typeof useAuth>,
    input: RequestInfo,
    init?: RequestInit
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


export function SocialMediaCard({ property }: { property: Property }) {
    const { agency } = useAgency();
    const { user } = useUser();
    const auth = useAuth();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPublishingFacebook, setIsPublishingFacebook] = useState(false);
    const [facebookPost, setFacebookPost] = useState<MetaFacebookPagePost | null>(property.metaFacebookPost || null);
    const [post, setPost] = useState('');
    const [copied, setCopied] = useState(false);
    const { toast } = useToast();
    const isMobile = useIsMobile();

    const handleGenerate = async () => {
        setIsGenerating(true);
        setPost('');
        try {
            const result = await generateSocialMediaPost({
                title: property.title,
                price: property.price,
                transactionType: property.transactionType,
                location: property.location,
                rooms: property.rooms,
                squareFootage: property.squareFootage,
            });
            setPost(result.post);
        } catch (error) {
            console.error("Failed to generate social media post", error);
            toast({
                variant: "destructive",
                title: "Eroare la generare",
                description: "Nu am putut crea postarea. Vă rugăm să reîncercați."
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!post) return;
        navigator.clipboard.writeText(post);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Textul postării a fost copiat!' });
    };

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
                 <Card
                    className={cn(
                        `${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0 cursor-pointer`
                    )}
                 >
                    <CardContent className="p-2 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center justify-center rounded-full",
                                `h-10 w-10 ${ACTION_PILL_CLASSNAME}`
                            )}>
                                <Share2 className="h-4 w-4 text-emerald-200" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-base font-semibold text-white">
                                    Promovare Social Media
                                </p>
                                <p className="text-xs text-white/60">
                                    Genereaza continut si publica pe Facebook.
                                </p>
                            </div>
                        </div>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
                            <Rocket className="h-4 w-4 text-emerald-200" />
                        </div>
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className={cn(
                "sm:max-w-lg bg-[#0F1E33] text-white",
                isMobile && "h-screen w-screen max-w-full rounded-none border-none flex flex-col p-0"
            )}>
                <DialogHeader className={cn(
                    "p-6",
                    isMobile && "p-4 border-b border-white/10 text-center shrink-0"
                )}>
                    <DialogTitle>Asistent Marketing Social Media</DialogTitle>
                    <DialogDescription className="text-white/70">
                        Generează o postare atractivă pentru Facebook sau Instagram, gata de copiat.
                    </DialogDescription>
                </DialogHeader>
                <div className={cn("space-y-4 py-4", isMobile ? "p-4 flex-1 overflow-y-auto" : "px-6")}>
                    {/* Facebook Post Mockup */}
                    <div className="bg-white/5 rounded-lg shadow-lg p-3 font-sans text-sm overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={agency?.logoUrl || undefined} alt={agency?.name || 'Agency'} />
                                <AvatarFallback>{agency?.name?.charAt(0) ?? 'A'}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-semibold text-white">{agency?.name || 'Numele Agenției'}</p>
                                <p className="text-xs text-white/70">Chiar acum · <Globe className="inline h-3 w-3" /></p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="mb-4 min-h-[60px]">
                            {isGenerating && (
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full bg-white/20" />
                                    <Skeleton className="h-4 w-5/6 bg-white/20" />
                                    <Skeleton className="h-4 w-3/4 bg-white/20" />
                                </div>
                            )}
                            {!isGenerating && post && (
                                <p className="whitespace-pre-wrap text-white/90">{post}</p>
                            )}
                            {!isGenerating && !post && (
                                <p className="text-white/50">Apasă pe "Generează Postare AI" pentru a vedea conținutul aici.</p>
                            )}
                        </div>

                        {/* Image */}
                        <div className="relative -mx-3 aspect-[1.91/1] w-[calc(100%+24px)] rounded-none overflow-hidden border-y border-white/20 bg-muted">
                            {property.images && property.images.length > 0 && (
                                <Image src={property.images[0].url} alt="Property image" fill className="object-cover" sizes="100vw" />
                            )}
                        </div>
                        
                        {/* Actions */}
                        <div className="flex justify-around items-center mt-3 pt-2 border-t font-medium border-white/20 text-white/80">
                            <Button variant="ghost" className="gap-2 px-1 text-white/80 hover:bg-white/10 hover:text-white/90">
                                <ThumbsUp className="h-4 w-4" /> Apreciază
                            </Button>
                            <Button variant="ghost" className="gap-2 px-1 text-white/80 hover:bg-white/10 hover:text-white/90">
                                <MessageCircle className="h-4 w-4" /> Comentează
                            </Button>
                            <Button variant="ghost" className="gap-2 px-1 text-white/80 hover:bg-white/10 hover:text-white/90">
                                <Share className="h-4 w-4" /> Distribuie
                            </Button>
                        </div>
                    </div>
                    
                    <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                        Generează Postare AI
                    </Button>

                    {post && !isGenerating && (
                        <Button onClick={handleCopy} className="w-full">
                          {copied ? <Check className="mr-2 h-4 w-4 text-green-400" /> : <Copy className="mr-2 h-4 w-4" />}
                          Copiază textul postării
                        </Button>
                    )}
                    <div className="rounded-2xl border border-sky-300/15 bg-sky-300/[0.07] p-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-white">Publicare pe pagina Facebook</p>
                                <p className="mt-1 text-xs leading-5 text-white/60">
                                    Posteaza direct proprietatea pe pagina Facebook a agentiei, fara buget de promovare.
                                </p>
                            </div>
                            {facebookPost?.status === 'published' ? (
                                <span className="rounded-full border border-emerald-300/25 bg-emerald-400/12 px-3 py-1 text-xs font-semibold text-emerald-100">
                                    Publicata
                                </span>
                            ) : null}
                        </div>

                        {facebookPost ? (
                            <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
                                <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">Ultima postare</p>
                                <p className="mt-1 text-sm font-medium text-white">
                                    {facebookPost.status === 'error'
                                        ? 'Eroare la publicare'
                                        : facebookPost.status === 'publishing'
                                            ? 'Se publica...'
                                            : `${facebookPost.imageCount} fotografii pe ${facebookPost.pageName || 'pagina Facebook'}`}
                                </p>
                                {facebookPost.errorMessage ? (
                                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-red-100/80">{facebookPost.errorMessage}</p>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="mt-3 flex gap-2">
                            <Button
                                type="button"
                                className="flex-1 rounded-full border border-sky-200/24 bg-sky-300/14 text-sky-50 hover:bg-sky-300/20"
                                onClick={() => void handlePublishFacebook()}
                                disabled={isPublishingFacebook || !user}
                            >
                                {isPublishingFacebook ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                {facebookPost?.status === 'published' ? 'Publica din nou' : 'Publica pe Facebook'}
                            </Button>
                            {facebookPost?.permalinkUrl ? (
                                <Button asChild variant="ghost" size="icon" className={`h-10 w-10 rounded-full ${ACTION_PILL_CLASSNAME}`}>
                                    <a href={facebookPost.permalinkUrl} target="_blank" rel="noopener noreferrer" aria-label="Deschide postarea Facebook">
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
