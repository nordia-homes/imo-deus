'use client';

import { Activity } from 'lucide-react';
import type { Property } from '@/lib/types';

type PropertyTimelineProps = {
  property: Property;
};

export function PropertyTimeline({ property }: PropertyTimelineProps) {

  return (
    <div className="space-y-4">
        <div className="text-center text-sm text-muted-foreground py-8">
            <Activity className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2">Cronologia proprietății.</p>
            <p>Aici vor aparea modificările de status, preț și task-urile asociate.</p>
      </div>
    </div>
  );
}
