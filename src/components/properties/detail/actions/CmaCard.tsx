'use client';
import { CmaAnalysisTab } from "../../CmaAnalysisTab";
import type { Property } from "@/lib/types";
import { allSampleProperties } from "@/lib/data";
import { useAgency } from "@/context/AgencyContext";

export function CmaCard({ property }: { property: Property }) {
    const { agencyId } = useAgency();

    if (!agencyId) return null;
    
    // Using CmaAnalysisTab directly as a self-contained card
    return <CmaAnalysisTab subjectProperty={property} allProperties={allSampleProperties} agencyId={agencyId} />;
}
