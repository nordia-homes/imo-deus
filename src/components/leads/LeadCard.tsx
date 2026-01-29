
import Link from 'next/link';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { ArrowRight, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/lib/types';


function getScoreBadgeVariant(score: number) {
    if (score > 85) return 'success';
    if (score > 60) return 'warning';
    return 'destructive';
}

export function LeadCard({ lead }: { lead: Contact }) {
  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">
        <Link href={`/leads/${lead.id}`} className="hover:underline">{lead.name}</Link>
      </TableCell>
      <TableCell>{lead.phone}</TableCell>
      <TableCell>{lead.source}</TableCell>
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
