'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function FacebookPromotionCard() {
    const { toast } = useToast();

    const handlePromote = () => {
        toast({
            title: "Promovare în curs...",
            description: "Proprietatea este trimisă către Facebook.",
        });
        // In a real app, this would trigger a backend process.
        setTimeout(() => {
             toast({
                title: "Promovare activă!",
                description: "Proprietatea este acum promovată pe Facebook.",
            });
        }, 2000);
    };

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardContent className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Facebook className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-sm">Promovare Facebook</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handlePromote} aria-label="Promovează pe Facebook">
                    <Rocket className="h-4 w-4 text-primary" />
                </Button>
            </CardContent>
        </Card>
    );
}
