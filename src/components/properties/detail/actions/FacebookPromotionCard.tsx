'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Facebook } from "lucide-react";
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
    }

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-4">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Facebook className="h-5 w-5 text-blue-600" />
                    Promovare Facebook
                </CardTitle>
            </CardHeader>
            <CardContent>
                 <Button className="w-full" onClick={handlePromote}>
                    Promovează Acum
                </Button>
            </CardContent>
        </Card>
    );
}
