
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

export default function PipelinePage() {
  return (
    <div className="space-y-6 h-full flex flex-col">
       <div>
            <h1 className="text-3xl font-headline font-bold">Pipeline Vânzări</h1>
            <p className="text-muted-foreground">
                Urmărește progresul tranzacțiilor în timp real.
            </p>
        </div>
        <PipelineBoard />
    </div>
  );
}
