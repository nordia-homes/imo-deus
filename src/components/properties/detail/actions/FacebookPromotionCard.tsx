'use client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, ExternalLink, Rocket } from "lucide-react";
import Link from 'next/link';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const facebookGroups = [
    "https://www.facebook.com/groups/proprietardirect/",
    "https://www.facebook.com/groups/direct.proprietar.bucuresti",
    "https://www.facebook.com/groups/1641351206103083/",
    "https://www.facebook.com/groups/258889259180994/",
    "https://www.facebook.com/groups/1730657617186760/",
    "https://www.facebook.com/groups/713711863981114/",
    "https://www.facebook.com/groups/118204592204043/",
    "https://www.facebook.com/groups/358979851113612/",
    "https://www.facebook.com/groups/3188029944804073/",
    "https://www.facebook.com/groups/5730550950403049/",
    "https://www.facebook.com/groups/269598638382777/",
    "https://www.facebook.com/groups/imobiliare.particulari/"
];

export function FacebookPromotionCard() {
    const isMobile = useIsMobile();
    return (
        <Dialog>
            <DialogTrigger asChild>
                 <Card className="rounded-2xl shadow-2xl p-0 h-12 flex items-center cursor-pointer transition-colors bg-[#152A47] text-white border-none hover:bg-[#152A47]/90">
                    <CardContent className="p-2 flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Facebook className="h-4 w-4 text-blue-500" />
                            <span className="font-semibold text-sm">Promovare Facebook</span>
                        </div>
                        <Rocket className="h-4 w-4 text-white/70" />
                    </CardContent>
                </Card>
            </DialogTrigger>
            <DialogContent className={cn(
                "sm:max-w-md bg-[#0F1E33] text-white",
                isMobile && "h-screen w-screen max-w-full rounded-none border-none flex flex-col p-0"
            )}>
                <DialogHeader className={cn(
                    "p-6",
                    isMobile && "p-4 border-b border-white/10 text-center shrink-0"
                )}>
                    <DialogTitle>Grupuri de Promovare Facebook</DialogTitle>
                    <DialogDescription className="text-white/70">
                        Postează anunțul în grupurile relevante pentru o vizibilitate maximă.
                    </DialogDescription>
                </DialogHeader>
                <div className={cn(isMobile ? "flex-1 overflow-y-auto" : "max-h-80 overflow-y-auto pr-4")}>
                    <div className={cn("space-y-2", isMobile ? "p-4" : "")}>
                        {facebookGroups.map((group, index) => (
                            <Button asChild key={index} variant="outline" className="w-full justify-between bg-white/10 hover:bg-white/20 text-white border-white/20">
                                <Link href={group} target="_blank" rel="noopener noreferrer">
                                    Grup Facebook {index + 1}
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                            </Button>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
