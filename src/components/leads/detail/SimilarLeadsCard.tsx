'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface SimilarLeadsCardProps {
    leads: Contact[];
}

export function SimilarLeadsCard({ leads }: SimilarLeadsCardProps) {

    if (leads.length === 0) {
        return null; // Don't render the card if there are no similar leads
    }

    return (
        <Card className="rounded-2xl shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <span>Lead-uri Similare</span>
                </CardTitle>
                <CardDescription>
                    Alți clienți cu bugete și zone de interes similare.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {leads.map(lead => (
                    <Link href={`/leads/${lead.id}`} key={lead.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent group">
                        <div>
                            <p className="font-semibold text-sm group-hover:text-primary">{lead.name}</p>
                            <p className="text-xs text-muted-foreground">Buget: €{lead.budget?.toLocaleString()}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </Link>
                ))}
            </CardContent>
        </Card>
    );
}
