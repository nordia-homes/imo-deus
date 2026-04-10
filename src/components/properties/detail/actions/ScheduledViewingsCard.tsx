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
import { ACTION_CARD_CLASSNAME, ACTION_CARD_INNER_CLASSNAME, ACTION_PILL_CLASSNAME } from "./cardStyles";

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    const isMobile = useIsMobile();
    const scheduledViewings = (viewings || []).filter(v => v.status === 'scheduled').sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

    return (
        <Card className={cn(
            ACTION_CARD_CLASSNAME
        )}>
            <CardHeader className={cn(
                "flex flex-row items-center justify-between",
                isMobile ? "px-4 pt-4 pb-3" : "px-4 pt-4 pb-3"
            )}>
                <CardTitle className={cn(
                    "font-semibold flex items-center gap-2",
                    isMobile ? "text-base text-white" : "text-base text-white"
                )}>
                    <Eye className="h-4 w-4" />
                    Vizionări Programate ({scheduledViewings.length})
                </CardTitle>
                <Button
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn("h-9 rounded-full px-4 text-sm text-white", ACTION_PILL_CLASSNAME)}
                >
                    <Link href="/viewings" aria-label="Vezi calendarul de vizionări">
                        Vezi calendar
                    </Link>
                </Button>
            </CardHeader>
            <CardContent className={cn(
                "pt-0",
                isMobile ? "px-4 pb-4" : "px-4 pb-4"
            )}>
                {scheduledViewings.length > 0 ? (
                    <div className="space-y-3">
                        {scheduledViewings.slice(0, 3).map(viewing => (
                            <div
                                key={viewing.id}
                                className={cn("flex items-center justify-between rounded-2xl p-3 hover:bg-white/[0.06]", ACTION_CARD_INNER_CLASSNAME)}
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white">{viewing.contactName}</p>
                                    <p className="mt-1 flex items-center gap-1 text-xs text-white/65">
                                        <Calendar className="h-3 w-3" />
                                        {format(parseISO(viewing.viewingDate), "d MMM, HH:mm", { locale: ro })}
                                    </p>
                                </div>
                                <Button
                                    asChild
                                    variant="ghost"
                                    size="sm"
                                    className={cn("rounded-full px-4 text-white", ACTION_PILL_CLASSNAME)}
                                >
                                    <Link href={`/leads/${viewing.contactId}`}>
                                        Detalii
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className={cn("rounded-2xl py-6 text-center text-sm text-white/70", ACTION_CARD_INNER_CLASSNAME)}>
                        Nicio vizionare programată.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
