'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarCheck } from "lucide-react";
import type { Viewing } from "@/lib/types";
import Link from 'next/link';

export function ScheduledViewingsCard({ viewings }: { viewings: Viewing[] }) {
    const scheduledCount = viewings.filter(v => v.status === 'scheduled').length;

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Vizionări programate</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarCheck className="h-6 w-6 text-primary" />
                        <span className="text-2xl font-bold">{scheduledCount}</span>
                    </div>
                    <Button asChild variant="outline">
                        <Link href="/viewings">Vezi Calendar</Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
