
import { Progress } from "../ui/progress";

interface UsageMeterProps {
    title: string;
    used: number;
    total: number;
}

export default function UsageMeter({ title, used, total }: UsageMeterProps) {
    const percentage = (used / total) * 100;
    return (
        <div>
            <div className="flex justify-between items-baseline mb-1">
                <p className="font-semibold text-white">{title}</p>
                <p className="text-sm text-white/70">{used} / {total}</p>
            </div>
            <Progress value={percentage} className="bg-white/20" />
        </div>
    )
}
