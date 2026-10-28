'use client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Property } from "@/lib/types";
import { PublicPropertyStory } from './PublicPropertyStory';
import { Button } from "../ui/button";
import { useState } from 'react';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { getAgencyThemePreset } from '@/lib/theme';
import { cn } from '@/lib/utils';
import styles from './PublicPropertyDetail.module.css';


export function PublicInfoColumn({ property, isMobile = false }: { property: Property, isMobile?: boolean }) {
    const { agency } = usePublicAgency();
    const isAgentfinderTheme = getAgencyThemePreset(agency) === 'agentfinder';
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const displaySurface = property.totalSurface ?? property.squareFootage;
    const TRUNCATION_LENGTH = 250;
    const DESCRIPTION_BOLD_CHARS = 60;
    const rawDescription = property.description || 'Nicio descriere adăugată.';
    const previewDescription =
        rawDescription.length > TRUNCATION_LENGTH
            ? `${rawDescription.slice(0, TRUNCATION_LENGTH).trimEnd()}...`
            : rawDescription;
    const displayedDescription = isDescriptionExpanded ? rawDescription : previewDescription;
    const boldCutIndex = (() => {
        if (displayedDescription.length <= DESCRIPTION_BOLD_CHARS) return displayedDescription.length;
        const nextSpaceIndex = displayedDescription.indexOf(' ', DESCRIPTION_BOLD_CHARS);
        return nextSpaceIndex === -1 ? displayedDescription.length : nextSpaceIndex;
    })();
    const descriptionIntro = displayedDescription.slice(0, boldCutIndex).trimEnd();
    const descriptionBody = displayedDescription.slice(boldCutIndex).trimStart();
    const panelClassName = cn("overflow-hidden rounded-[2rem] border shadow-[0_30px_90px_-40px_rgba(0,0,0,0.9)]", isAgentfinderTheme ? "public-premium-panel" : "[border-color:var(--public-card-border)] [background:var(--public-card-bg)]");
    const detailsCardClassName = cn("overflow-hidden rounded-[2rem] border shadow-[0_24px_70px_-42px_rgba(0,0,0,0.82)]", isAgentfinderTheme ? "public-premium-soft-panel" : "border-white/8 bg-[var(--public-header-bg)]");
    const panelHeaderClassName = "p-4 md:p-6";
    const panelTitleClassName = isAgentfinderTheme ? "text-slate-950" : "text-white";
    const panelBodyClassName = "px-4 pb-4 pt-0 md:px-6 md:pb-6";

    const DescriptionText = ({ mobile = false }: { mobile?: boolean }) => (
        <div className={cn(styles.descriptionText, isAgentfinderTheme ? 'text-slate-600' : 'text-emerald-50/85')}>
            <span className={cn("font-semibold", isAgentfinderTheme ? "text-slate-950" : "text-white")}>{descriptionIntro}</span>
            {descriptionBody ? ` ${descriptionBody}` : null}
        </div>
    );

    if (!isMobile) {
        return (
            <div className="space-y-6">
                <Card className={cn(styles.description, "overflow-hidden rounded-[2rem] shadow-[0_34px_94px_-44px_rgba(0,0,0,0.92)]", isAgentfinderTheme ? "public-premium-soft-panel" : "border border-emerald-400/18 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.08),transparent_24%),linear-gradient(145deg,rgba(5,8,7,0.98)_0%,rgba(8,10,10,0.99)_52%,rgba(10,16,12,0.98)_100%)]")}>
                    <CardHeader className={panelHeaderClassName}>
                        <CardTitle className={cn("max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl", panelTitleClassName)}>Descriere</CardTitle>
                    </CardHeader>
                    <CardContent className={panelBodyClassName}>
                        <div>
                            <DescriptionText />
                            {property.description && property.description.length > TRUNCATION_LENGTH && (
                                <Button
                                    variant="link"
                                    className={cn("mt-2 h-auto p-0", isAgentfinderTheme ? "text-sky-700 hover:text-sky-800" : "text-[#22c55e] hover:text-[#86efac]")}
                                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                >
                                    {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <PublicPropertyStory property={property} />
            </div>
        )
    }

    return (
        <div className="space-y-4">
                <Card className={cn(styles.description, detailsCardClassName)}>
                <CardHeader className="p-4">
                    <CardTitle className={cn("text-2xl font-semibold tracking-tight", panelTitleClassName)}>Descriere</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <div>
                        <DescriptionText mobile />
                        {property.description && property.description.length > TRUNCATION_LENGTH && (
                            <Button
                                variant="link"
                                className={cn("mt-2 h-auto p-0", isAgentfinderTheme ? "text-sky-700 hover:text-sky-800" : "text-[#22c55e] hover:text-[#86efac]")}
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            >
                                {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <PublicPropertyStory property={property} />
        </div>
    );
}
