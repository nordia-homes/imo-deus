
'use client';
import { useMemo } from 'react';
import type { Property, UserProfile } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PublicContactForm } from "./PublicContactForm";
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Star, Eye, CheckCircle2, Phone, Wand2 } from 'lucide-react';

export function PublicActionsColumn({ property, agentProfile }: { property: Property, agentProfile: UserProfile | null }) {
    const { agencyId } = usePublicAgency();

    const pricePerSqm = useMemo(() => {
        if (!property.price || !property.squareFootage) return null;
        return (property.price / property.squareFootage).toFixed(0);
    }, [property.price, property.squareFootage]);

    const getInitials = (name?: string | null) => {
        if (!name) return 'A';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }
    
    const agentForCard = {
        name: agentProfile?.name || property.agentName || "Nespecificat",
        email: agentProfile?.email || null,
        phone: agentProfile?.phone || null,
        avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
    };

    return (
        <Card className="glow-card bg-slate-900/50 backdrop-blur-lg border border-cyan-400/20 shadow-2xl rounded-2xl text-white">
            <CardContent className="p-4 space-y-5">
                {/* Price Section */}
                <div className="text-center">
                    <div className="flex items-baseline justify-center gap-2">
                        <h2 className="text-4xl font-bold">€{property.price.toLocaleString()}</h2>
                        {pricePerSqm && <span className="text-base text-white/70">€{pricePerSqm}/m²</span>}
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                        <Badge variant="secondary" className="bg-green-500/20 border-green-500/30 text-green-300">Negociabil</Badge>
                        <Badge variant="secondary" className="bg-cyan-500/20 border-cyan-500/30 text-cyan-300">
                           <Wand2 className="mr-1.5 h-3 w-3" />
                            Preț evaluat automat
                        </Badge>
                    </div>
                </div>

                {/* Agent Section */}
                <div className="text-center">
                    <div className="flex justify-center mb-2">
                        <Avatar className="h-16 w-16 border-2 border-cyan-400/50">
                            <AvatarImage src={agentForCard.avatarUrl || undefined} alt={agentForCard.name} />
                            <AvatarFallback className="bg-slate-700 text-xl">{getInitials(agentForCard.name)}</AvatarFallback>
                        </Avatar>
                    </div>
                    <h3 className="font-semibold text-lg">{agentForCard.name}</h3>
                    <p className="text-sm text-white/70">Agent Imobiliar</p>
                    <div className="flex justify-center items-center gap-4 text-sm text-white/80 mt-2">
                        <div className="flex items-center gap-1"><Star className="h-4 w-4 text-yellow-400" /> 4.9</div>
                        <div className="flex items-center gap-1"><Eye className="h-4 w-4 text-cyan-400" /> 120</div>
                        <div className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-green-400" /> 20 vândute</div>
                    </div>
                </div>

                {/* Form Section */}
                <div>
                    <h4 className="font-bold text-center mb-3 text-lg">Programează o vizionare</h4>
                    <PublicContactForm propertyId={property.id} agencyId={agencyId!} />
                </div>
                
                 {/* Call Button */}
                {agentForCard.phone && (
                    <Button variant="outline" className="w-full h-12 bg-cyan-500/10 border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200" asChild>
                       <a href={`tel:${agentForCard.phone}`}>
                         <Phone className="mr-2 h-4 w-4" />
                         Sună acum
                       </a>
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
