'use client';

import type { MatchedBuyer } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface MatchedLeadsTabProps {
  matchedBuyers: MatchedBuyer[];
}

export function MatchedLeadsTab({ matchedBuyers }: MatchedLeadsTabProps) {
  if (matchedBuyers.length === 0) {
    return (
      <div className="text-center py-10 lg:text-white/70">
        <p className="text-muted-foreground lg:text-white/70">
          Nu au fost găsiți cumpărători compatibili cu această proprietate.
        </p>
      </div>
    );
  }

  return (
    <Card className="rounded-2xl shadow-2xl bg-[#f8f8f9] lg:border lg:border-white/10 lg:bg-[#152A47] lg:shadow-none">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="lg:border-white/10">
              <TableHead className="lg:text-white/80">Nume Client</TableHead>
              <TableHead className="lg:text-white/80">Buget</TableHead>
              <TableHead className="lg:text-white/80">Scor</TableHead>
              <TableHead className="lg:text-white/80">Agent</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matchedBuyers.map((lead) => (
              <TableRow key={lead.id} className="lg:border-white/10">
                <TableCell className="font-medium lg:text-white">
                  <div>
                    <p>{lead.name}</p>
                    <p className="text-xs text-muted-foreground lg:text-white/60">{lead.reasoning}</p>
                  </div>
                </TableCell>
                <TableCell className="lg:text-white/90">€{lead.budget?.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="lg:border-white/10 lg:bg-white/8 lg:text-white">
                    {lead.matchScore}/100
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {lead.agentName ? (
                      <>
                        <User className="h-4 w-4 text-muted-foreground lg:text-white/70" />
                        <span className="text-sm lg:text-white/90">{lead.agentName}</span>
                      </>
                    ) : (
                      <span className="text-sm text-muted-foreground lg:text-white/70">Nealocat</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild variant="ghost" size="sm" className="lg:text-emerald-200 lg:hover:bg-emerald-400/10 lg:hover:text-emerald-100">
                    <Link href={`/leads/${lead.id}`}>
                      Vezi Cumpărător
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
