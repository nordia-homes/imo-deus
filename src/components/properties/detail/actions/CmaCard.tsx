'use client';
import { CmaAnalysisTab } from "../../CmaAnalysisTab";
import type { Property } from "@/lib/types";
import { useAgency } from "@/context/AgencyContext";
import { useIsMobile } from "@/hooks/use-mobile";

export function CmaCard({ property, allProperties }: { property: Property, allProperties: Property[] }) {
    const { agencyId } = useAgency();
    const isMobile = useIsMobile();

    if (!agencyId) return null;
    
    return <CmaAnalysisTab 
                subjectProperty={property} 
                allProperties={allProperties} 
                agencyId={agencyId} 
                isMobile={isMobile}
            />;
}
