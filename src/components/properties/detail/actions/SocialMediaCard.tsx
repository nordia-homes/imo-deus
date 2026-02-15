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
import { Share2, Rocket, Loader2, Copy, Check } from "lucide-react";
import type { Property } from "@/lib/types";
import { generateSocialMediaPost } from "@/ai/flows/social-media-post-generator";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


export function SocialMediaCard({ property }: { property: Property }) {
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
        navigator.clipboard.writeText(post);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Postare copiată!' });
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Asistent Marketing Social Media</DialogTitle>
                    <DialogDescription>
                        Generează o postare atractivă pentru Facebook sau Instagram, gata de copiat.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
                        Generează Postare AI
                    </Button>

                    {post && (
                        <div className="space-y-2 pt-4 border-t relative">
                             <Textarea
                                readOnly
                                value={post}
                                className="h-64 bg-muted text-sm"
                                aria-label="Generated social media post"
                            />
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute top-6 right-2 h-8 w-8"
                                onClick={handleCopy}
                            >
                                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
