'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy, getDoc, doc } from 'firebase/firestore';
import type { Property, Contact, Viewing, UserProfile } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle } from 'lucide-react';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { ViewingsCalendar } from '@/components/viewings/ViewingsCalendar';
import { ViewingList } from '@/components/viewings/ViewingList';
import { parseISO, addDays, startOfDay } from 'date-fns';
import { EditViewingDialog } from '@/components/viewings/EditViewingDialog';
import { DeleteViewingAlert } from '@/components/viewings/DeleteViewingAlert';

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

    const handleAddViewing = (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
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
        
        addDocumentNonBlocking(collection(firestore, `agencies/${agencyId}/viewings`), viewingToAdd);

        toast({ title: 'Vizionare programată!', description: 'Vizionarea a fost adăugată în calendar.' });
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
                <ViewingList 
                    title="Vizionări Următoarele 7 Zile" 
                    viewings={upcomingViewings} 
                    agents={agents}
                    properties={properties}
                    contacts={contacts}
                    onEdit={setEditingViewing}
                    onDelete={setDeletingViewing}
                    collapsible
                    defaultOpen={false}
                />
                <ViewingList 
                    title="Istoric Vizionări" 
                    viewings={pastViewings} 
                    agents={agents}
                    properties={properties}
                    contacts={contacts}
                    onEdit={setEditingViewing}
                    onDelete={setDeletingViewing}
                    collapsible
                    defaultOpen={false}
                />
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
