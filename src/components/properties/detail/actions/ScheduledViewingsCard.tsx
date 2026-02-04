'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { Viewing } from "@/lib/types";
import Link from 'next/link';

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    const scheduledCount = viewings.filter(v => v.status === 'scheduled').length;

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardContent className="p-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Vizionări Programate:</span>
                    <span className="font-bold text-base">{scheduledCount}</span>
                </div>
                <Button asChild variant="link" size="sm" className="text-primary text-xs px-2">
                    <Link href="/viewings" aria-label="Vezi calendarul de vizionări">
                        Vezi tot
                    </Link>
                </Button>
            </CardContent>
        </Card>
    );
}
