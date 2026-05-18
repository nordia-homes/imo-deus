
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Property, PropertyStatusEvent } from '@/lib/types';
import { Edit, FileText, Rocket, Globe, MoreVertical, Calendar, Clock, CalendarCheck } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddPropertyDialog } from '../add-property-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAgency } from '@/context/AgencyContext';
import { useFirestore, useUser, updateDocumentNonBlocking } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { ACTION_CARD_CLASSNAME, ACTION_PILL_CLASSNAME } from './actions/cardStyles';
import {
  PropertyStatusChangeDialog,
  type PropertyStatusChangePayload,
} from '@/components/properties/PropertyStatusChangeDialog';

export function PropertyHeader({ property, onTriggerAddViewing }: { property: Property; onTriggerAddViewing: () => void; }) {
    const { agencyId, agency } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<'Rezervat' | 'Vândut' | null>(null);
    const [isStatusUpdating, setIsStatusUpdating] = useState(false);
    const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);

    const persistSimpleStatusChange = (newStatus: Property['status']) => {
        if (!agencyId || !property) return;

        if (agencyId && firestore) {
            const propertyDocRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
            updateDocumentNonBlocking(propertyDocRef, {
                status: newStatus,
                statusUpdatedAt: new Date().toISOString()
            });
        }

        toast({
            title: "Status actualizat!",
            description: `Proprietatea este acum: ${newStatus}.`,
        });
    };

    const handleStatusChange = (newStatus: Property['status']) => {
        if (newStatus === 'Rezervat' || newStatus === 'Vândut') {
            setPendingStatus(newStatus);
            return;
        }

        persistSimpleStatusChange(newStatus);
    };

    const handleStructuredStatusChange = async (payload: PropertyStatusChangePayload) => {
        if (!agencyId || !property || isStatusUpdating) return;

        setIsStatusUpdating(true);

        try {
            const changedAt = new Date().toISOString();
            const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
            const statusEventRef = doc(collection(firestore, 'agencies', agencyId, 'propertyStatusEvents'));
            const nextPropertySnapshot: Property = {
                ...property,
                status: payload.nextStatus,
                statusUpdatedAt: changedAt,
                soldPrice: payload.nextStatus === 'Vândut' ? payload.soldPrice ?? null : property.soldPrice ?? null,
            };

            const statusEvent: PropertyStatusEvent = {
                id: statusEventRef.id,
                agencyId,
                propertyId: property.id,
                changedAt,
                previousStatus: property.status ?? null,
                nextStatus: payload.nextStatus,
                reason: payload.reason,
                reasonLabel: payload.reasonLabel,
                agentMessage: payload.agentMessage,
                soldPrice: payload.nextStatus === 'Vândut' ? payload.soldPrice ?? null : null,
                marketAnalysisEligible: payload.nextStatus === 'Vândut',
                propertySnapshot: nextPropertySnapshot,
            };

            const batch = writeBatch(firestore);
            batch.update(propertyRef, {
                status: payload.nextStatus,
                statusUpdatedAt: changedAt,
                soldPrice: payload.nextStatus === 'Vândut' ? payload.soldPrice ?? null : null,
            });
            batch.set(statusEventRef, statusEvent);
            await batch.commit();

            toast({
                title: 'Status actualizat!',
                description:
                    payload.nextStatus === 'Vândut'
                        ? `Proprietatea este acum Vândut, iar pretul final a fost salvat pentru analiza de piata.`
                        : `Proprietatea este acum Rezervat.`,
            });
            setPendingStatus(null);
        } catch (error) {
            console.error('Failed to update property status:', error);
            toast({
                variant: 'destructive',
                title: 'Actualizarea a esuat',
                description: 'Nu am reusit sa actualizam statusul proprietatii.',
            });
        } finally {
            setIsStatusUpdating(false);
        }
    };

    const handleGeneratePresentation = async () => {
        if (!user || isGeneratingPresentation) return;

        setIsGeneratingPresentation(true);

        try {
            const token = await user.getIdToken(true);
            const response = await fetch(`/api/properties/${property.id}/presentation`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.message || 'Nu am putut genera prezentarea PDF.');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeTitle = property.title
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 90) || 'prezentare-proprietate';

            link.href = url;
            link.download = `${safeTitle}-prezentare.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            toast({
                title: 'Prezentare generata',
                description: 'PDF-ul A4 cu 2 pagini a fost descarcat.',
            });
        } catch (error) {
            console.error('Failed to generate property presentation:', error);
            toast({
                variant: 'destructive',
                title: 'Generarea a esuat',
                description: error instanceof Error ? error.message : 'Nu am putut genera prezentarea PDF.',
            });
        } finally {
            setIsGeneratingPresentation(false);
        }
    };

    const creationDate = property.createdAt ? new Date(property.createdAt) : new Date();
    const ageInDays = differenceInDays(new Date(), creationDate);
    const displaySurface = property.totalSurface ?? property.squareFootage;
    const desktopMetaItems = [
        { icon: <Calendar className="h-4 w-4 text-emerald-300" />, value: creationDate.toLocaleDateString('ro-RO') },
        { icon: <Clock className="h-4 w-4 text-emerald-300" />, value: `Vechime: ${ageInDays} ${ageInDays === 1 ? 'zi' : 'zile'}` },
        { icon: null, value: property.location },
        { icon: null, value: `${property.rooms} camere` },
        { icon: null, value: `${property.bathrooms} ${property.bathrooms === 1 ? 'baie' : 'băi'}` },
        { icon: null, value: `${displaySurface} mp` },
        ...(property.constructionYear ? [{ icon: null, value: String(property.constructionYear) }] : []),
        ...(property.floor ? [{ icon: null, value: `Et. ${property.floor}` }] : []),
    ];

  return (
    <>
        <header className="px-4 md:px-6 lg:px-0 py-4 border-b bg-background/95 backdrop-blur-sm lg:bg-transparent lg:border-white/10 lg:mb-2">
            <div className="flex h-full flex-col gap-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
                <div className="min-w-0 lg:col-span-8">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2 flex-wrap">
                        <div
                            className={`inline-block h-auto w-full truncate rounded-lg border bg-[#f8f8f9] p-3 text-xl font-bold text-card-foreground shadow-lg md:max-w-lg lg:max-w-2xl lg:rounded-[1.6rem] lg:border-0 lg:px-5 lg:py-4 lg:text-[1.65rem] lg:tracking-tight lg:text-emerald-50 lg:shadow-none ${ACTION_CARD_CLASSNAME}`}
                            title={property.title}
                        >
                            {property.title}
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground lg:hidden lg:text-white/70">
                        <Badge variant="outline" className="font-normal lg:rounded-full lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100"><Calendar className="mr-1.5 h-3.5 w-3.5" /> {creationDate.toLocaleDateString('ro-RO')}</Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100"><Clock className="mr-1.5 h-3.5 w-3.5" /> Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}</Badge>
                        <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.location}
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.rooms} camere
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {property.bathrooms} {property.bathrooms === 1 ? 'baie' : 'băi'}
                        </Badge>
                        <Badge variant="secondary" className="lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                            {displaySurface} mp
                        </Badge>
                        {property.constructionYear && (
                            <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                                {property.constructionYear}
                            </Badge>
                        )}
                        {property.floor && (
                            <Badge variant="secondary" className="hidden sm:inline-flex lg:rounded-full lg:border lg:border-emerald-300/16 lg:bg-emerald-400/10 lg:px-3.5 lg:py-1.5 lg:text-sm lg:text-emerald-100">
                                Et. {property.floor}
                            </Badge>
                        )}
                    </div>
                    <div className={`${ACTION_CARD_CLASSNAME} mt-4 hidden rounded-[1.45rem] p-3 lg:block`}>
                        <div className="flex min-w-0 items-center gap-4 overflow-hidden px-2 py-1">
                            {desktopMetaItems.map((item, index) => (
                                <div key={`${item.value}-${index}`} className="flex min-w-0 shrink-0 items-center gap-2">
                                    {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                                    <p className="truncate whitespace-nowrap text-sm font-semibold text-white">
                                        {item.value}
                                    </p>
                                    {index < desktopMetaItems.length - 1 ? (
                                        <span className="ml-2 h-5 w-px shrink-0 bg-white/10" />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap lg:col-span-4 lg:flex-nowrap">
                    <div className={`${ACTION_CARD_CLASSNAME} w-full rounded-[1.7rem] p-4`}>
                        <div className="flex items-center gap-3">
                            <Select onValueChange={(value) => handleStatusChange(value as Property['status'])} defaultValue={property.status}>
                                <SelectTrigger className="h-12 min-w-[132px] rounded-[1.15rem] border border-white/8 bg-[#1a3046] px-4 text-sm font-semibold text-emerald-200 hover:bg-[#203850]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Activ">Activ</SelectItem>
                                    <SelectItem value="Rezervat">Rezervat</SelectItem>
                                    <SelectItem value="Vândut">Vândut</SelectItem>
                                    <SelectItem value="Închiriat">Închiriat</SelectItem>
                                    <SelectItem value="Inactiv">Inactiv</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button className={`h-12 rounded-[1.15rem] px-5 text-white ${ACTION_PILL_CLASSNAME}`} onClick={onTriggerAddViewing}>
                                <CalendarCheck className="mr-2 h-4 w-4"/> 
                                Vizionare
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="icon" className={`h-12 w-12 rounded-[1.15rem] text-white ${ACTION_PILL_CLASSNAME}`}>
                                        <MoreVertical className="h-4 w-4"/>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => setIsEditDialogOpen(true)}>
                                        <Edit className="mr-2 h-4 w-4"/> 
                                        Editează
                                    </DropdownMenuItem>
                                     <DropdownMenuItem asChild>
                                        <Link href={buildAgencyPublicUrl(agency ?? (agencyId ? { id: agencyId } : null), `/properties/${property.id}`)} target="_blank" rel="noopener noreferrer">
                                            <Globe className="mr-2 h-4 w-4"/> 
                                            Vezi pe Website
                                        </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={handleGeneratePresentation} disabled={isGeneratingPresentation}>
                                        <FileText className="mr-2 h-4 w-4"/>
                                        {isGeneratingPresentation ? 'Se generează...' : 'Generează PDF'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem><Rocket className="mr-2 h-4 w-4"/> Promovează</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </div>
            </div>
        </header>
        <AddPropertyDialog 
            property={property}
            isOpen={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
        />
        <PropertyStatusChangeDialog
            property={property}
            targetStatus={pendingStatus}
            isOpen={!!pendingStatus}
            isSubmitting={isStatusUpdating}
            onOpenChange={(open) => !open && setPendingStatus(null)}
            onConfirm={handleStructuredStatusChange}
        />
    </>
  );
}
