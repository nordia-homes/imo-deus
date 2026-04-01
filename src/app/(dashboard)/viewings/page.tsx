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
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#152A47] px-4 py-4 text-left transition-colors hover:bg-[#19304f]"
                    >
                        <span className="text-lg font-semibold text-white sm:text-xl">Vizionări Următoarele 7 Zile ({upcomingViewings.length})</span>
                        <ChevronDown className={cn("h-5 w-5 text-white/70 transition-transform duration-200", isUpcomingOpen && "rotate-180")} />
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
                        className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#152A47] px-4 py-4 text-left transition-colors hover:bg-[#19304f]"
                    >
                        <span className="text-lg font-semibold text-white sm:text-xl">Istoric Vizionări ({pastViewings.length})</span>
                        <ChevronDown className={cn("h-5 w-5 text-white/70 transition-transform duration-200", isPastOpen && "rotate-180")} />
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
