'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Property } from "@/lib/types";

export function AiPriceEvaluationDialog({ property }: { property: Property }) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full bg-transparent border-cyan-400/50 hover:bg-cyan-400/10 hover:border-cyan-400/70 glow-card" style={{ color: '#67e8f9' }}>
                    Evalueaza Pretul cu ImoDeus.ai
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI (Demo)</DialogTitle>
                    <DialogDescription>
                        Această funcționalitate este în dezvoltare. Într-o versiune viitoare, AI-ul va oferi o analiză comparativă a prețului proprietății.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    )
}
