'use client';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { ArrowRight, User, Wand2, Calendar, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/lib/types';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

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
    <Card className="shadow-lg rounded-2xl bg-[#152A47] text-white border-none">
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1 space-y-2.5 min-w-0">
            <Link href={`/leads/${cumparator.id}`} className="block">
              <h3 className="font-bold text-base hover:underline truncate">{cumparator.name}</h3>
            </Link>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <span>Buget:</span>
              <span className="font-semibold text-white">€{cumparator.budget?.toLocaleString() ?? 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {cumparator.priority && <Badge variant={getPriorityBadgeVariant(cumparator.priority)}>{cumparator.priority}</Badge>}
              <Badge variant="outline" className="bg-white/10 text-white border-none">{cumparator.status}</Badge>
            </div>
          </div>

          <div className="flex flex-col items-end justify-between h-full shrink-0">
            {typeof cumparator.leadScore === 'number' ? (
              <Badge variant={getScoreBadgeVariant(cumparator.leadScore)} className="mb-2">
                Scor AI: {cumparator.leadScore}
              </Badge>
            ) : (
                <Badge variant="outline" className="mb-2 border-dashed bg-white/10 text-white border-none">
                    <Wand2 className="mr-1.5 h-3 w-3" />
                    N/A
                </Badge>
            )}
            <Link href={`/leads/${cumparator.id}`} className="mt-auto">
                <Button variant="ghost" size="icon" className="text-white/80 hover:text-white">
                    <ArrowRight className="h-5 w-5" />
                </Button>
            </Link>
          </div>
        </div>
        
        {(cumparator.createdAt || (cumparator.zones && cumparator.zones.length > 0)) && (
            <div className="border-t border-white/10 mt-3 pt-3 space-y-2 text-xs">
                {cumparator.createdAt && (
                    <div className="flex items-center gap-2 text-white/70">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Adăugat: {format(new Date(cumparator.createdAt), 'd MMM yyyy', { locale: ro })}</span>
                    </div>
                )}
                {cumparator.zones && cumparator.zones.length > 0 && (
                    <div className="flex items-center gap-2 text-white/70">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="truncate">Zone: {cumparator.zones.slice(0, 4).join(', ')}{cumparator.zones.length > 4 ? '...' : ''}</span>
                    </div>
                )}
            </div>
        )}

        {cumparator.agentName && (
            <div className="border-t border-white/10 mt-3 pt-3 flex items-center justify-between text-sm">
                <span className="text-white/70">Agent</span>
                <div className="flex items-center gap-2 font-medium text-white">
                    <User className="h-4 w-4 text-white/70" />
                    <span>{cumparator.agentName}</span>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
