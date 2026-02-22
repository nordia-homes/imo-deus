'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutList, Users, FileText, Info, CalendarCheck, ArrowRight, Menu, Building, Handshake, Calendar as CalendarIcon, Layers, Maximize, BedDouble, Bath, Star, Paintbrush, Sofa, Thermometer, Car, Key, AlertTriangle, Compass, ArrowUpDown } from "lucide-react";
import type { Property, Contact, Viewing } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { MatchedLeadsTab } from "../properties/detail/MatchedLeadsTab";
import { format, parseISO } from "date-fns";
import { ro } from "date-fns/locale";
import Link from 'next/link';
import { RlvTab } from "../properties/detail/RlvTab";
import { useState } from 'react';
import { InfoDialog } from '../properties/detail/InfoDialog';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { PropertyNotesCard } from "../properties/detail/actions/PropertyNotesCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function PublicInfoColumn({ property, isMobile }: { property: Property, isMobile: boolean }) {
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const TRUNCATION_LENGTH = 250;
    
    const InfoItem = ({ label, value }: { label: string, value: string | number | undefined | null }) => {
        if (!value && value !== 0) return null;
        return (
             <Button variant="outline" className="w-full justify-between pointer-events-none bg-[#0F1E33] border-cyan-400/50 shadow-[0_0_15px_-10px_rgba(100,220,255,0.6)]"><span>{label}</span><span className="font-semibold">{value}{label.includes("Suprafață") ? " mp" : ""}</span></Button>
        )
    };

    if (isMobile) {
        return (
            <div className="space-y-4">
                 <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base">Descriere</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                            {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded) 
                                ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                : property.description || 'Nicio descriere adăugată.'
                            }
                        </p>
                        {property.description && property.description.length > TRUNCATION_LENGTH && (
                            <Button 
                                variant="link" 
                                className="p-0 h-auto mt-2 text-primary"
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            >
                                {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                            </Button>
                        )}
                    </CardContent>
                </Card>

                 <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-base">Informații detaliate</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-2">
                        <InfoItem label="Compartimentare" value={property.partitioning} />
                        <InfoItem label="Nr camere" value={property.rooms} />
                        <InfoItem label="An construcție" value={property.constructionYear} />
                        <InfoItem label="Etaj" value={property.floor} />
                        <InfoItem label="Suprafață utilă" value={property.squareFootage} />
                        <InfoItem label="Suprafață cu balcon" value={property.totalSurface} />
                        <InfoItem label="Stare interior" value={property.interiorState} />
                        <InfoItem label="Bucătărie" value={property.kitchen} />
                        <InfoItem label="Balcon/Terasă" value={property.balconyTerrace} />
                        <InfoItem label="Lift" value={property.lift} />
                        <InfoItem label="Sistem încălzire" value={property.heatingSystem} />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    return (
        <div className="space-y-6">
             <Card className="rounded-2xl shadow-2xl bg-[#152A47] text-white border-none">
                <CardHeader><CardTitle>Descriere</CardTitle></CardHeader>
                <CardContent>
                     <div>
                        <p className="text-white/70 whitespace-pre-wrap">
                            {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded) 
                                ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                : property.description || 'Nicio descriere adăugată.'
                            }
                        </p>
                        {property.description && property.description.length > TRUNCATION_LENGTH && (
                            <Button 
                                variant="link" 
                                className="p-0 h-auto mt-2 text-primary"
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                            >
                                {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
