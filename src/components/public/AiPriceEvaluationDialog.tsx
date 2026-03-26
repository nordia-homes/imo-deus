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
            <DialogContent className={cn(isMobile && "border-none bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_52%,_#eef4ff_100%)] text-slate-900")}>
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI</DialogTitle>
                    <DialogDescription className={cn(isMobile && "text-slate-600")}>
                        Această funcționalitate este în curs de dezvoltare.
                    </DialogDescription>
                </DialogHeader>
            </DialogContent>
        </Dialog>
    );
}
