
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
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{used} / {total}</p>
            </div>
            <Progress value={percentage} />
        </div>
    )
}
