
'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Flame, Eye } from "lucide-react";

export function PublicInfoColumn({ property }: { property: Property }) {
    
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="bg-primary/10 border-primary text-primary hover:bg-primary/20">Prezentare generală</Button>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white/80 hover:bg-white/20">Vezi locația</Button>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white/80 hover:bg-white/20">RLV</Button>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white/80 hover:bg-white/20">Caracteristici</Button>
                <Button variant="outline" className="bg-white/10 border-white/20 text-white/80 hover:bg-white/20">Informații</Button>
            </div>
             <Card className="rounded-2xl shadow-2xl bg-transparent border-none text-white">
                <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-2xl font-bold">Descriere</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                     <p className="text-white/80 whitespace-pre-wrap leading-relaxed">
                        {property.description || 'Nicio descriere adăugată.'}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-white/80">
                        <div className="flex items-center gap-2">
                            <Flame className="h-5 w-5 text-primary" />
                            <span>12 persoane au salvat această proprietate</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Eye className="h-5 w-5 text-primary" />
                            <span>184 vizualizări în ultimele 7 zile</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
