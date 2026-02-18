'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { useIsMobile } from '@/hooks/use-mobile';

export default function PipelinePage() {
    const isMobile = useIsMobile();
    const router = useRouter();

    useEffect(() => {
        if (isMobile) {
            router.replace('/dashboard');
        }
    }, [isMobile, router]);

    if (isMobile) {
        return null; // Or a loading component
    }

    return (
      <div className="space-y-6 h-full flex flex-col">
         <div>
              <h1 className="text-3xl font-headline font-bold">Pipeline Vânzări</h1>
              <p className="text-muted-foreground">
                  Urmărește și mută tranzacțiile prin etapele de vânzare cu un simplu drag-and-drop.
              </p>
          </div>
          <PipelineBoard />
      </div>
    );
  }
