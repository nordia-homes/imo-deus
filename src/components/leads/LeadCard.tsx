'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, User, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/lib/types';

function getScoreBadgeVariant(score: number) {
    if (score > 85) return 'success';
    if (score > 60) return 'warning';
    return 'destructive';
}

function getPriorityBadgeVariant(priority: Contact['priority']) {
    switch (priority) {
        case 'Ridicată': return 'destructive';
        case 'Medie': return 'warning';
        case 'Scăzută': return 'secondary';
        default: return 'outline';
    }
}

export function LeadCard({ lead: cumparator }: { lead: Contact }) {
  return (
    <Card className="shadow-lg rounded-2xl">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2.5">
            <Link href={`/leads/${cumparator.id}`} className="block">
              <h3 className="font-bold text-base hover:underline">{cumparator.name}</h3>
            </Link>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Buget:</span>
              <span className="font-semibold text-foreground">€{cumparator.budget?.toLocaleString() ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {cumparator.priority && <Badge variant={getPriorityBadgeVariant(cumparator.priority)}>{cumparator.priority}</Badge>}
              <Badge variant="outline">{cumparator.status}</Badge>
            </div>
          </div>

          <div className="flex flex-col items-end justify-between h-full">
            {typeof cumparator.leadScore === 'number' ? (
              <Badge variant={getScoreBadgeVariant(cumparator.leadScore)} className="mb-2">
                Scor AI: {cumparator.leadScore}
              </Badge>
            ) : (
                <Badge variant="outline" className="mb-2 border-dashed">
                    <Wand2 className="mr-1.5 h-3 w-3" />
                    N/A
                </Badge>
            )}
            <Link href={`/leads/${cumparator.id}`} className="mt-auto">
                <Button variant="ghost" size="icon">
                    <ArrowRight className="h-5 w-5" />
                </Button>
            </Link>
          </div>
        </div>
        
        {cumparator.agentName && (
            <div className="border-t mt-3 pt-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Agent</span>
                <div className="flex items-center gap-2 font-medium">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{cumparator.agentName}</span>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
