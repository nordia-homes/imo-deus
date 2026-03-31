'use client';
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
import { Share2, Rocket, Loader2, Copy, Check, ThumbsUp, MessageCircle, Share, Globe } from "lucide-react";
import type { Property } from "@/lib/types";
import { generateSocialMediaPost } from "@/ai/flows/social-media-post-generator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useAgency } from "@/context/AgencyContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";
import { Skeleton } from "../../../ui/skeleton";


export function SocialMediaCard({ property }: { property: Property }) {
    const { agency } = useAgency();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
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

    return (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                 <Card
                    className={cn(
                        "overflow-hidden rounded-2xl border border-emerald-300/14 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.1),transparent_34%),linear-gradient(180deg,#18304f_0%,#152A47_58%,#12233b_100%)] p-0 cursor-pointer text-white transition-colors shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)] hover:bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.13),transparent_34%),linear-gradient(180deg,#1b3558_0%,#162c4b_58%,#13253e_100%)]"
                    )}
                 >
                    <CardContent className="p-2 flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex items-center justify-center rounded-full",
                                "h-10 w-10 border border-emerald-300/16 bg-emerald-400/10 text-emerald-200"
                            )}>
                                <Share2 className="h-4 w-4 text-emerald-200" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-base font-semibold text-white">
                                    Promovare Social Media
                                </p>
                                <p className="text-xs text-white/60">
                                    Genereaza rapid continut pentru social media.
                                </p>
                            </div>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/16 bg-emerald-400/10 text-emerald-200">
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
                </div>
            </DialogContent>
        </Dialog>
    );
}
