
import { AiChat } from "@/components/ai/AiChat";

export default function AiAssistantPage() {
  return (
    <div className="h-full flex flex-col">
       <div>
            <h1 className="text-3xl font-headline font-bold">Asistent AI</h1>
            <p className="text-muted-foreground">
                Asistentul tău personal pentru orice întrebare imobiliară.
            </p>
        </div>
        <AiChat />
    </div>
  );
}
