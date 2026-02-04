'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Eye } from "lucide-react";
import type { Viewing } from "@/lib/types";
import Link from 'next/link';

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    const scheduledCount = viewings.filter(v => v.status === 'scheduled').length;

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardContent className="p-3">
                <div className="flex items-center justify-between h-10">
                    <div className="flex items-center gap-2">
                        <Eye className="h-5 w-5 text-muted-foreground" />
                        <span className="font-semibold text-base">Vizionări Programate:</span>
                        <span className="font-bold text-lg">{scheduledCount}</span>
                    </div>
                    <Button asChild variant="ghost" size="icon">
                        <Link href="/viewings" aria-label="Vezi calendarul de vizionări">
                            <CalendarCheck className="h-5 w-5 text-primary" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
