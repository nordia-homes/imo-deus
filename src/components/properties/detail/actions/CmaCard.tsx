'use client';
import { CmaAnalysisTab } from "../../CmaAnalysisTab";
import type { Property } from "@/lib/types";
import { useAgency } from "@/context/AgencyContext";

export function CmaCard({ property, allProperties }: { property: Property, allProperties: Property[] }) {
    const { agencyId } = useAgency();

    if (!agencyId) return null;
    
    // CmaAnalysisTab component already looks like a card, so we can use it directly.
    return <CmaAnalysisTab subjectProperty={property} allProperties={allProperties} agencyId={agencyId} />;
}
