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
            "overflow-hidden rounded-2xl border border-emerald-300/14 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.1),transparent_34%),linear-gradient(180deg,#18304f_0%,#152A47_58%,#12233b_100%)] text-white shadow-[0_24px_70px_-36px_rgba(0,0,0,0.72)]"
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
                    className="h-9 rounded-full border border-emerald-300/16 bg-emerald-400/10 px-4 text-sm text-emerald-200 hover:bg-emerald-400/14 hover:text-emerald-100"
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
                                className="flex items-center justify-between rounded-2xl border border-emerald-300/12 bg-white/[0.03] p-3 hover:bg-white/[0.05]"
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
                                    className="rounded-full border border-emerald-300/16 bg-emerald-400/10 px-4 text-emerald-200 hover:bg-emerald-400/14 hover:text-emerald-100"
                                >
                                    <Link href={`/leads/${viewing.contactId}`}>
                                        Detalii
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="rounded-2xl border border-white/8 bg-white/[0.03] py-6 text-center text-sm text-white/70">
                        Nicio vizionare programată.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
