'use client';

import { LeadCard } from "./LeadCard";
import { Skeleton } from "../ui/skeleton";
import type { Contact } from "@/lib/types";
import { Card, CardContent } from "../ui/card";

export function LeadList({
    contacts,
    isLoading,
    onUnarchive,
    showArchivedState = false,
}: {
    contacts: Contact[] | null,
    isLoading: boolean,
    onUnarchive?: (lead: Contact) => void,
    showArchivedState?: boolean,
}) {

    if (isLoading) {
        return (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Skeleton className="h-56 w-full rounded-2xl" />
                <Skeleton className="h-56 w-full rounded-2xl" />
                <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
        );
    }

    if (!contacts || contacts.length === 0) {
        return (
            <Card className="agentfinder-leads-empty-card shadow-lg rounded-2xl mt-4">
                <CardContent className="p-10 text-center text-muted-foreground">
                    Niciun cumpărător nu corespunde filtrelor selectate.
                </CardContent>
            </Card>
        )
    }
  
    return (
        <div className="agentfinder-leads-grid mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {contacts.map(cumparator => (
                <LeadCard
                    key={cumparator.id}
                    lead={cumparator}
                    onUnarchive={onUnarchive}
                    showArchivedState={showArchivedState}
                />
            ))}
        </div>
    );
}
