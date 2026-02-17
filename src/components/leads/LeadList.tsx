'use client';

import { LeadCard } from "./LeadCard";
import { Skeleton } from "../ui/skeleton";
import type { Contact } from "@/lib/types";
import { Card, CardContent } from "../ui/card";

export function LeadList({ contacts, isLoading }: { contacts: Contact[] | null, isLoading: boolean }) {

    if (isLoading) {
        return (
            <div className="space-y-4 mt-4">
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
                <Skeleton className="h-32 w-full rounded-2xl" />
            </div>
        );
    }

    if (!contacts || contacts.length === 0) {
        return (
            <Card className="shadow-lg rounded-2xl mt-4">
                <CardContent className="p-10 text-center text-muted-foreground">
                    Niciun cumpărător nu corespunde filtrelor selectate.
                </CardContent>
            </Card>
        )
    }
  
    return (
        <div className="space-y-4 mt-4">
            {contacts.map(cumparator => (
                <LeadCard key={cumparator.id} lead={cumparator} />
            ))}
        </div>
    );
}
