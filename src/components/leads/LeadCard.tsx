
import Link from 'next/link';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { ArrowRight, Wand2, User } from 'lucide-react';
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

export function LeadCard({ lead }: { lead: Contact }) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <Link href={`/leads/${lead.id}`} className="hover:underline">{lead.name}</Link>
      </TableCell>
      <TableCell>
          {lead.priority && <Badge variant={getPriorityBadgeVariant(lead.priority)}>{lead.priority}</Badge>}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {lead.agentName ? (
            <>
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{lead.agentName}</span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Nealocat</span>
          )}
        </div>
      </TableCell>
      <TableCell>€{lead.budget?.toLocaleString() ?? 'N/A'}</TableCell>
      <TableCell><Badge variant="outline">{lead.status}</Badge></TableCell>
      <TableCell>
          {typeof lead.leadScore === 'number' ? (
            <Badge variant={getScoreBadgeVariant(lead.leadScore)}>{lead.leadScore}</Badge>
          ) : (
             <Button variant="outline" size="sm" asChild>
                 <Link href={`/leads/${lead.id}`}>
                    <Wand2 className="mr-2 h-4 w-4" />
                    Generează
                 </Link>
             </Button>
          )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" asChild>
             <Link href={`/leads/${lead.id}`} className="flex items-center justify-end" passHref>
                Detalii <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}
