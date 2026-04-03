'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, getDoc, doc, addDoc } from 'firebase/firestore';
import type { Property, Contact, Viewing, UserProfile } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, ChevronDown } from 'lucide-react';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { ViewingsCalendar } from '@/components/viewings/ViewingsCalendar';
import { ViewingList } from '@/components/viewings/ViewingList';
import { parseISO, addDays, startOfDay } from 'date-fns';
import { EditViewingDialog } from '@/components/viewings/EditViewingDialog';
import { DeleteViewingAlert } from '@/components/viewings/DeleteViewingAlert';
import { cn } from '@/lib/utils';

export default function ViewingsPage() {
    const { agencyId, agency, userProfile } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);
    const [editingViewing, setEditingViewing] = useState<Viewing | null>(null);
    const [deletingViewing, setDeletingViewing] = useState<Viewing | null>(null);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);
    const [isUpcomingOpen, setIsUpcomingOpen] = useState(false);
    const [isPastOpen, setIsPastOpen] = useState(false);

    // Data fetching
    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'properties'));
    }, [firestore, agencyId]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'desc'));
    }, [firestore, agencyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const { upcomingViewings, pastViewings } = useMemo(() => {
        if (!viewings) {
            return { upcomingViewings: [], pastViewings: [] };
        }
        const now = new Date();
        const tomorrowStart = startOfDay(addDays(now, 1));
        const sevenDaysLimit = startOfDay(addDays(now, 8));
        const upcoming = viewings
            .filter(v => {
                const viewingDate = parseISO(v.viewingDate);
                return viewingDate >= tomorrowStart && viewingDate < sevenDaysLimit;
            })
            .sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());
        
        const past = viewings
            .filter(v => parseISO(v.viewingDate) < now)
            .sort((a, b) => parseISO(b.viewingDate).getTime() - parseISO(a.viewingDate).getTime());
            
        return { upcomingViewings: upcoming, pastViewings: past };
    }, [viewings]);

    useEffect(() => {
        if (!agency?.agentIds || agency.agentIds.length === 0) {
            setAreAgentsLoading(false);
            return;
        }

        const fetchAgents = async () => {
            setAreAgentsLoading(true);
            try {
                const agentPromises = agency.agentIds.map(id => getDoc(doc(firestore, 'users', id)));
                const agentDocs = await Promise.all(agentPromises);
                const agentProfiles = agentDocs
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
                setAgents(agentProfiles);
            } catch (error) {
                console.error("Error fetching agent profiles:", error);
            } finally {
                setAreAgentsLoading(false);
            }
        };

        fetchAgents();
    }, [agency, firestore]);

    const handleAddViewing = async (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agencyId || !user) return;

        const selectedProperty = properties?.find(p => p.id === viewingData.propertyId);
        if (!selectedProperty) {
             toast({ variant: 'destructive', title: 'Proprietate invalidă.' });
             return;
        };
        
        const viewingToAdd: Omit<Viewing, 'id'> = {
            ...viewingData,
            propertyTitle: selectedProperty.title,
            propertyAddress: selectedProperty.address,
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
            createdAt: new Date().toISOString(),
        };

        try {
            await addDoc(collection(firestore, `agencies/${agencyId}/viewings`), viewingToAdd);

            await fetch('/api/viewings/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agencyId,
                    agentId: viewingToAdd.agentId,
                    contactName: viewingToAdd.contactName,
                    propertyTitle: viewingToAdd.propertyTitle,
                    viewingDate: viewingToAdd.viewingDate,
                }),
            }).catch((error) => {
                console.error('Viewing push notification request failed:', error);
            });

            toast({ title: 'Vizionare programată!', description: 'Vizionarea a fost adăugată în calendar.' });
        } catch (error) {
            console.error('Failed to add viewing:', error);
            toast({ variant: 'destructive', title: 'Eroare', description: 'Vizionarea nu a putut fi salvată.' });
        }
    };

    const handleUpdateViewing = (updatedViewing: Omit<Viewing, 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress'>) => {
        if (!agencyId || !editingViewing) return;
        const viewingRef = doc(firestore, 'agencies', agencyId, 'viewings', editingViewing.id);
        const { id, ...dataToUpdate } = updatedViewing;
        updateDocumentNonBlocking(viewingRef, dataToUpdate);
        toast({ title: "Vizionare actualizată!" });
        setEditingViewing(null);
    };

    const handleDeleteViewing = () => {
        if (!agencyId || !deletingViewing) return;
        const viewingRef = doc(firestore, 'agencies', agencyId, 'viewings', deletingViewing.id);
        deleteDocumentNonBlocking(viewingRef);
        toast({
            variant: 'destructive',
            title: "Vizionare ștearsă!",
        });
        setDeletingViewing(null);
    };

    const isLoading = arePropertiesLoading || areContactsLoading || areViewingsLoading || areAgentsLoading;

    if (isLoading) {
        return (
             <div className="min-w-0 w-full max-w-full overflow-x-hidden space-y-6 bg-[#0F1E33] px-2 py-2 sm:p-2">
                <Skeleton className="h-12 w-full bg-white/10"/>
                <Skeleton className="h-[70vh] w-full bg-white/10"/>
             </div>
        )
    }

    return (
        <div className="flex h-full min-w-0 w-full max-w-full flex-col gap-4 overflow-x-hidden bg-[#0F1E33] px-2 py-2 text-white sm:gap-6 sm:p-2">
            <Button onClick={() => setIsAddViewingOpen(true)} variant="outline" className="w-full h-12 text-base bg-white/10 border-white/20 hover:bg-white/20 hover:text-white">
                <PlusCircle className="mr-2 h-4 w-4"/>
                Programează Vizionare
            </Button>
            
            <ViewingsCalendar 
                viewings={viewings} 
                agents={agents} 
                properties={properties}
                contacts={contacts}
                onEdit={setEditingViewing}
                onDelete={setDeletingViewing}
            />

            <div className="mt-8 space-y-6">
                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setIsUpcomingOpen((current) => !current)}
                        className="group flex w-full items-center justify-between rounded-[26px] border border-white/10 bg-gradient-to-r from-[#152A47] via-[#183252] to-[#132A44] px-5 py-5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(0,0,0,0.24)]"
                    >
                        <div className="min-w-0 flex-1 pr-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Program viitor</p>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                                <span className="text-lg font-semibold leading-tight text-white sm:text-2xl">Vizionări Următoarele 7 Zile</span>
                                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/75">
                                    {upcomingViewings.length}
                                </span>
                            </div>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors group-hover:bg-white/10">
                            <ChevronDown className={cn("h-5 w-5 text-white/70 transition-transform duration-200", isUpcomingOpen && "rotate-180")} />
                        </div>
                    </button>
                    {isUpcomingOpen && (
                        <ViewingList 
                            title="Vizionări Următoarele 7 Zile" 
                            viewings={upcomingViewings} 
                            agents={agents}
                            properties={properties}
                            contacts={contacts}
                            onEdit={setEditingViewing}
                            onDelete={setDeletingViewing}
                        />
                    )}
                </div>

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={() => setIsPastOpen((current) => !current)}
                        className="group flex w-full items-center justify-between rounded-[26px] border border-white/10 bg-gradient-to-r from-[#152A47] via-[#183252] to-[#132A44] px-5 py-5 text-left shadow-[0_18px_44px_rgba(0,0,0,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_24px_56px_rgba(0,0,0,0.24)]"
                    >
                        <div className="min-w-0 flex-1 pr-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Arhivă</p>
                            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-3">
                                <span className="text-lg font-semibold leading-tight text-white sm:text-2xl">Istoric Vizionări</span>
                                <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/75">
                                    {pastViewings.length}
                                </span>
                            </div>
                        </div>
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors group-hover:bg-white/10">
                            <ChevronDown className={cn("h-5 w-5 text-white/70 transition-transform duration-200", isPastOpen && "rotate-180")} />
                        </div>
                    </button>
                    {isPastOpen && (
                        <ViewingList 
                            title="Istoric Vizionări" 
                            viewings={pastViewings} 
                            agents={agents}
                            properties={properties}
                            contacts={contacts}
                            onEdit={setEditingViewing}
                            onDelete={setDeletingViewing}
                        />
                    )}
                </div>
            </div>
            
            <AddViewingDialog
                isOpen={isAddViewingOpen}
                onOpenChange={setIsAddViewingOpen}
                onAddViewing={handleAddViewing}
                contacts={contacts || []}
                properties={properties || []}
            />

            <EditViewingDialog
                isOpen={!!editingViewing}
                onOpenChange={(isOpen) => !isOpen && setEditingViewing(null)}
                viewing={editingViewing}
                onUpdateViewing={handleUpdateViewing}
                properties={properties || []}
                contacts={contacts || []}
            />

            <DeleteViewingAlert
                isOpen={!!deletingViewing}
                onOpenChange={(isOpen) => !isOpen && setDeletingViewing(null)}
                viewing={deletingViewing}
                onDelete={handleDeleteViewing}
            />

        </div>
    );
}
