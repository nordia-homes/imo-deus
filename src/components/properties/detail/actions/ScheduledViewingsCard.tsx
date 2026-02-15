'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Calendar } from "lucide-react";
import type { Viewing } from "@/lib/types";
import Link from 'next/link';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { parseISO, format } from 'date-fns';
import { ro } from 'date-fns/locale';

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    const isMobile = useIsMobile();
    const scheduledViewings = (viewings || []).filter(v => v.status === 'scheduled').sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

    return (
        <Card className={cn(
            "rounded-2xl shadow-2xl",
            isMobile ? "bg-[#152A47] text-white border-none" : "bg-[#f8f8f9]"
        )}>
            <CardHeader className="p-3 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Vizionări Programate ({scheduledViewings.length})
                </CardTitle>
                <Button asChild variant="link" size="sm" className={cn("text-primary text-xs px-0", isMobile && "text-white")}>
                    <Link href="/viewings" aria-label="Vezi calendarul de vizionări">
                        Vezi calendar
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className="p-3 pt-0">
                {scheduledViewings.length > 0 ? (
                    <div className="space-y-2">
                        {scheduledViewings.slice(0, 3).map(viewing => (
                            <div key={viewing.id} className={cn("flex items-center justify-between p-2 rounded-lg border", isMobile ? "border-white/10" : "border-border")}>
                                <div>
                                    <p className="font-semibold text-sm">{viewing.contactName}</p>
                                    <p className={cn("text-xs flex items-center gap-1", isMobile ? "text-white/70" : "text-muted-foreground")}>
                                        <Calendar className="h-3 w-3" />
                                        {format(parseISO(viewing.viewingDate), "d MMM, HH:mm", { locale: ro })}
                                    </p>
                                </div>
                                <Button asChild variant="ghost" size="sm" className={cn(isMobile && "text-white hover:bg-white/20")}>
                                    <Link href={`/leads/${viewing.contactId}`}>
                                        Detalii
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className={cn("text-sm text-center py-4", isMobile ? "text-white/70" : "text-muted-foreground")}>Nicio vizionare programată.</p>
                )}
            </CardContent>
        </Card>
    );
}