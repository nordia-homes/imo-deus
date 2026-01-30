'use client';

import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelinePage() {
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
