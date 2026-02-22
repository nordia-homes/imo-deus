'use client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";


export function AiPriceEvaluationDialog({ trigger }: { trigger: React.ReactNode }) {
    const isMobile = useIsMobile();
    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className={cn(isMobile && "bg-[#0F1E33] text-white border-none")}>
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI</DialogTitle>
                    <DialogDescription className={cn(isMobile && "text-white/70")}>
                        Această funcționalitate este în curs de dezvoltare.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
