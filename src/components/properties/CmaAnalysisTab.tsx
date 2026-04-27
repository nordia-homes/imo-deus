'use client';

import Link from 'next/link';
import { ArrowRight, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Property } from '@/lib/types';
import { ACTION_CARD_CLASSNAME, ACTION_PILL_CLASSNAME } from './detail/actions/cardStyles';

interface CmaAnalysisTabProps {
  subjectProperty: Property;
  allProperties: Property[];
  agencyId: string;
  isMobile?: boolean;
}

export function CmaAnalysisTab({ subjectProperty }: CmaAnalysisTabProps) {
  return (
    <Card className={`${ACTION_CARD_CLASSNAME} p-0`}>
      <CardContent className="w-full p-4">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/8 bg-[#1a2a40]">
              <Calculator className="h-4 w-4 text-sky-100" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-sky-100/62">Analiza pietei</p>
              <p className="truncate text-sm font-semibold text-white">Analiza dedicata de pret</p>
            </div>
          </div>

          <div className="space-y-3 rounded-[1.1rem] border border-white/8 bg-white/[0.03] p-4">
            <p className="text-sm leading-6 text-white/76">
              Vezi un pret recomandat calculat din proprietati `Vandut` similare din platforma, comparabile active din agentie si oferta online disponibila pe portal.
            </p>
            <Button asChild size="sm" className={`h-10 rounded-full px-4 text-white ${ACTION_PILL_CLASSNAME}`}>
              <Link href={`/properties/${subjectProperty.id}/analiza-pret`}>
                Deschide analiza
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
