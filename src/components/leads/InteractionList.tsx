'use client';

import {
  Activity,
  Phone,
  Mail,
  Users,
  Eye,
  FileText,
} from 'lucide-react';
import type { Interaction } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';

const interactionIcons = {
  'Apel telefonic': <Phone className="h-5 w-5" />,
  'Email': <Mail className="h-5 w-5" />,
  'Întâlnire': <Users className="h-5 w-5" />,
  'Vizionare': <Eye className="h-5 w-5" />,
  'Ofertă': <FileText className="h-5 w-5" />,
};

export function InteractionList({ interactions }: { interactions: Interaction[] }) {
  if (!interactions || interactions.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-8">
        <Activity className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-2">Niciun istoric de interacțiuni.</p>
        <p>Adaugă o notă mai jos pentru a începe.</p>
      </div>
    );
  }
  
  // Sort interactions descending by date
  const sortedInteractions = [...interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6">
      {sortedInteractions.map((item) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            {interactionIcons[item.type] || <Activity className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{item.type}</p>
              <p className="text-xs text-muted-foreground" title={new Date(item.date).toLocaleString('ro-RO')}>
                {formatDistanceToNow(new Date(item.date), { addSuffix: true, locale: ro })}
              </p>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
