'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { WhatsappIcon } from "@/components/icons/WhatsappIcon";
import type { Property } from "@/lib/types";

export function OwnerCard({ property }: { property: Property }) {
    const ownerName = property.ownerName;
    const ownerPhone = property.ownerPhone;
    const sanitizedPhone = ownerPhone?.replace(/\D/g, '') || '';

    if (!ownerName && !ownerPhone) {
        return null;
    }

    return (
        <Card className="rounded-2xl shadow-2xl p-0 flex items-center bg-[#f8f8f9] lg:bg-[#152A47] lg:border-none lg:text-white">
            <CardContent className="p-2 w-full">
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div>
                             <p className="text-xs text-muted-foreground lg:text-white/70">Proprietar:</p>
                             <p className="font-semibold text-sm leading-tight">{ownerName || 'Nespecificat'}</p>
                             {ownerPhone && <p className="text-xs text-white/70">{ownerPhone}</p>}
                        </div>
                    </div>

                    <div className="flex items-center">
                        {ownerPhone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 lg:text-white/80" asChild>
                                <a href={`tel:${ownerPhone}`} aria-label="Call owner">
                                    <Phone className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                         {sanitizedPhone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 lg:text-white/80" asChild>
                                <a href={`https://wa.me/${sanitizedPhone}`} target="_blank" rel="noopener noreferrer" aria-label="Message owner on WhatsApp">
                                    <WhatsappIcon className="h-4 w-4" />
                                </a>
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
