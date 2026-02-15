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
                 <Card className={cn(
                    "rounded-2xl shadow-2xl p-0 h-12 flex items-center cursor-pointer hover:bg-muted/80 transition-colors",
                    isMobile ? "bg-[#152A47] text-white border-none" : "bg-[#f8f8f9]"
                )}>
                    <CardContent className="p-2 flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Share2 className="h-4 w-4 text-orange-500" />
                            <span className="font-semibold text-sm">Marketing Social Media</span>
                        </div>
                        <Rocket className="h-4 w-4 text-muted-foreground" />
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className={cn(
                "sm:max-w-lg",
                isMobile && "h-screen w-screen max-w-full rounded-none border-none bg-[#0F1E33] text-white flex flex-col p-0"
            )}>
                <DialogHeader className={cn(
                    "p-6",
                    isMobile && "p-4 border-b border-white/10 text-center shrink-0"
                )}>
                    <DialogTitle>Asistent Marketing Social Media</DialogTitle>
                    <DialogDescription className={cn(isMobile && "text-white/70")}>
                        Generează o postare atractivă pentru Facebook sau Instagram, gata de copiat.
                    </DialogDescription>
                </DialogHeader>
                <div className={cn("space-y-4 py-4", isMobile ? "p-4 flex-1 overflow-y-auto" : "px-6")}>
                    {/* Facebook Post Mockup */}
                    <div className={cn("bg-white rounded-lg shadow-lg p-3 font-sans text-sm text-gray-800", isMobile && "bg-white/5")}>
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                            <Avatar className="h-10 w-10">
                                <AvatarImage src={agency?.logoUrl || undefined} alt={agency?.name || 'Agency'} />
                                <AvatarFallback>{agency?.name?.charAt(0) ?? 'A'}</AvatarFallback>
                            </Avatar>
                            <div>
                                <p className={cn("font-semibold", isMobile ? "text-white" : "text-gray-900")}>{agency?.name || 'Numele Agenției'}</p>
                                <p className={cn("text-xs", isMobile ? "text-white/70" : "text-gray-500")}>Chiar acum · <Globe className="inline h-3 w-3" /></p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="mb-4 min-h-[60px]">
                            {isGenerating && (
                                <div className="space-y-2">
                                    <Skeleton className={cn("h-4 w-full", isMobile && "bg-white/20")} />
                                    <Skeleton className={cn("h-4 w-5/6", isMobile && "bg-white/20")} />
                                    <Skeleton className={cn("h-4 w-3/4", isMobile && "bg-white/20")} />
                                </div>
                            )}
                            {!isGenerating && post && (
                                <p className={cn("whitespace-pre-wrap", isMobile && "text-white/90")}>{post}</p>
                            )}
                            {!isGenerating && !post && (
                                <p className={cn("text-muted-foreground", isMobile && "text-white/50")}>Apasă pe "Generează Postare AI" pentru a vedea conținutul aici.</p>
                            )}
                        </div>

                        {/* Image */}
                        <div className="relative -mx-3 aspect-[1.91/1] w-[calc(100%+24px)] rounded-none overflow-hidden border-y border-gray-200 dark:border-white/20 bg-muted">
                            {property.images && property.images.length > 0 && (
                                <Image src={property.images[0].url} alt="Property image" fill className="object-cover" sizes="100vw" />
                            )}
                        </div>
                        
                        {/* Actions */}
                        <div className={cn("flex justify-between items-center mt-3 pt-2 border-t font-medium", isMobile ? "border-white/20 text-white/80" : "border-gray-200 text-gray-600" )}>
                            <Button variant="ghost" className={cn("w-full gap-2", isMobile && "text-white/80 hover:bg-white/10 hover:text-white/90")}>
                                <ThumbsUp className="h-4 w-4" /> Apreciază
                            </Button>
                            <Button variant="ghost" className={cn("w-full gap-2", isMobile && "text-white/80 hover:bg-white/10 hover:text-white/90")}>
                                <MessageCircle className="h-4 w-4" /> Comentează
                            </Button>
                            <Button variant="ghost" className={cn("w-full gap-2", isMobile && "text-white/80 hover:bg-white/10 hover:text-white/90")}>
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
