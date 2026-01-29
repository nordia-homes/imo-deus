
import Link from 'next/link';
import { TableCell, TableRow } from '@/components/ui/table';
import { Badge } from '../ui/badge';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';


type Lead = {
    id: string;
    name: string;
    phone: string;
    source: string;
    budget: number;
    status: string;
    aiScore: number;
    urgency: string;
}

function getScoreBadgeVariant(score: number) {
    if (score > 85) return 'success';
    if (score > 60) return 'warning';
    return 'destructive';
}

function getUrgencyBadgeVariant(urgency: string) {
    if (urgency === 'Ridicata') return 'destructive';
    if (urgency === 'Medie') return 'warning';
    return 'secondary';
}

export function LeadCard({ lead }: { lead: Lead }) {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/50">
      <TableCell className="font-medium">
        <Link href={`/leads/${lead.id}`} className="hover:underline">{lead.name}</Link>
      </TableCell>
      <TableCell>{lead.phone}</TableCell>
      <TableCell>{lead.source}</TableCell>
      <TableCell>€{lead.budget.toLocaleString()}</TableCell>
      <TableCell><Badge variant="outline">{lead.status}</Badge></TableCell>
      <TableCell>
          <Badge variant={getScoreBadgeVariant(lead.aiScore)}>{lead.aiScore}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant={getUrgencyBadgeVariant(lead.urgency)}>{lead.urgency}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <Link href={`/leads/${lead.id}`} className="text-primary hover:underline flex items-center justify-end" passHref>
            <Button variant="ghost" size="sm">
                Detalii <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
        </Link>
      </TableCell>
    </TableRow>
  );
}

// Note: you may need to add 'success' and 'warning' variants to your Badge component for this to work as intended.
// e.g. in badgeVariants in src/components/ui/badge.tsx
// success: "border-transparent bg-green-500 text-white",
// warning: "border-transparent bg-yellow-500 text-white",
