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
        <Card className={cn("flex flex-col", recommended && "border-primary")}>
            <CardHeader>
                {recommended && <p className="text-sm font-semibold text-primary mb-2">Recomandat</p>}
                <CardTitle>{name}</CardTitle>
                <CardDescription>
                    <span className="text-3xl font-bold">{price}</span>
                    {!isCustom && <span className="text-muted-foreground">/lună</span>}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
                {features.map(feature => (
                    <div key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                    </div>
                ))}
            </CardContent>
            <CardFooter>
                <Button className="w-full" variant={recommended ? "default" : "outline"} onClick={onChoosePlan}>
                    {isCustom ? 'Contactează-ne' : 'Alege Planul'}
                </Button>
            </CardFooter>
        </Card>
    )
}
