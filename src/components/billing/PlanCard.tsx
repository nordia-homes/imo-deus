'use client';
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";


interface PlanCardProps {
    name: string;
    price: string;
    features: string[];
    recommended?: boolean;
    onChoosePlan: () => void;
}

export default function PlanCard({ name, price, features, recommended, onChoosePlan }: PlanCardProps) {
    const isCustom = price.toLowerCase() === 'custom';
    
    return (
        <Card className={cn(
            "agentfinder-billing-plan-card flex flex-col shadow-2xl rounded-2xl bg-[#152A47] border-none text-white",
            recommended && "agentfinder-billing-plan-card--recommended border-2 border-primary"
        )}>
            <CardHeader>
                {recommended && <p className="text-sm font-semibold text-primary mb-2">Recomandat</p>}
                <CardTitle className="text-white">{name}</CardTitle>
                <CardDescription className="text-white/90">
                    <span className="text-3xl font-bold text-white">{price}</span>
                    {!isCustom && <span className="text-white/70">/lună</span>}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 text-white/90">
                {features.map(feature => (
                    <div key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-400" />
                        <span>{feature}</span>
                    </div>
                ))}
            </CardContent>
            <CardFooter>
                <Button 
                    className={cn("w-full", !recommended && "bg-white/10 border-white/20 hover:bg-white/20 text-white")}
                    variant={recommended ? "default" : "outline"} 
                    onClick={onChoosePlan}
                >
                    {isCustom ? 'Contactează-ne' : 'Alege Planul'}
                </Button>
            </CardFooter>
        </Card>
    )
}
