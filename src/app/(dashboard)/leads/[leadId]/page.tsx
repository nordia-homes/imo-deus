'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { propertyMatcher } from '@/ai/flows/property-matcher';

import type { Contact, Property, Task, UserProfile, Interaction, Agency, Viewing, MatchedProperty, ContactPreferences, PortalRecommendation, Offer } from '@/lib/types';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import Image from 'next/image';
import { cn } from "@/lib/utils";

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { LeadHeader } from '@/components/leads/detail/Header';
import { LeadTimeline } from '@/components/leads/detail/LeadTimeline';
import { MatchedProperties } from '@/components/leads/detail/MatchedProperties';
import { LeadInfoCard } from '@/components/leads/detail/LeadInfoCard';
import { LeadSettingsCard } from '@/components/leads/detail/LeadSettingsCard';
import { ClientPortalManager } from '@/components/leads/detail/ClientPortalManager';
import { LeadDescriptionCard } from '@/components/leads/detail/LeadDescriptionCard';
import { ScheduledViewingsCard } from '@/components/leads/detail/ScheduledViewingsCard';
import { SourcePropertyCard } from '@/components/leads/detail/SourcePropertyCard';
import { SimilarLeadsCard } from '@/components/leads/detail/SimilarLeadsCard';
import { AiLeadScoreCard } from '@/components/leads/detail/AiLeadScoreCard';
import { FinancialStatusCard } from '@/components/leads/detail/FinancialStatusCard';
import { PreferencesCard } from '@/components/leads/detail/PreferencesCard';
import { EditLeadInfoDialog } from '@/components/leads/detail/EditLeadInfoDialog';
import { OfferManagementCard } from '@/components/leads/detail/OfferManagementCard';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Plus, Check, CheckSquare } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';


const PageSkeleton = () => (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            <Skeleton className="h-10 w-48" />
            <div className="flex gap-2 flex-wrap">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-64" />
            </div>
            <div className="lg:col-span-6 space-y-4">
                <Skeleton className="h-96" />
                <Skeleton className="h-56" />
            </div>
            <div className="lg:col-span-3 space-y-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-40" />
                <Skeleton className="h-48" />
                <Skeleton className="h-72" />
            </div>
        </div>
    </div>
)

const CircularProgress = ({ score, className }: { score: number, className?: string }) => {
    const size = 60;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className={cn("relative", className)} style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle
                    className="text-white/20"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className="text-green-400"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                {score}
            </span>
        </div>
    );
};

// Main Component
export default function LeadDetailPage() {
    const params = useParams();
    const cumparatorId = params.leadId as string;
    
    const { agency, userProfile, isAgencyLoading: isContextLoading } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // --- Component State ---
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);
    const [isMatching, setIsMatching] = useState(false);
    const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
    const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);

    // --- DATA FETCHING ---
    const contactDocRef = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        return doc(firestore, 'agencies', agency.id, 'contacts', cumparatorId);
    }, [firestore, agency?.id, cumparatorId]);

    const { data: contact, isLoading: isContactLoading, error: contactError } = useDoc<Contact>(contactDocRef);

    const tasksQuery = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        return query(tasksCollection, where('contactId', '==', cumparatorId));
    }, [firestore, agency?.id, cumparatorId]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const viewingsQuery = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        const viewingsCollection = collection(firestore, 'agencies', agency.id, 'viewings');
        return query(viewingsCollection, where('contactId', '==', cumparatorId), orderBy('viewingDate', 'asc'));
    }, [firestore, agency?.id, cumparatorId]);

    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return collection(firestore, 'agencies', agency.id, 'properties');
    }, [firestore, agency?.id]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const sourcePropertyDocRef = useMemoFirebase(() => {
        if (!agency?.id || !contact?.sourcePropertyId) return null;
        return doc(firestore, 'agencies', agency.id, 'properties', contact.sourcePropertyId);
    }, [firestore, agency?.id, contact?.sourcePropertyId]);
    const { data: sourceProperty, isLoading: isSourcePropertyLoading } = useDoc<Property>(sourcePropertyDocRef);

    // Fetch all contacts to find similar ones
    const allContactsQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return collection(firestore, 'agencies', agency.id, 'contacts');
    }, [firestore, agency?.id]);
    const { data: allContacts, isLoading: areAllContactsLoading } = useCollection<Contact>(allContactsQuery);

    const recommendations = useMemo(() => {
        if (!contact?.recommendationHistory) return [];
        // Convert the recommendationHistory map to an array for the component
        return Object.values(contact.recommendationHistory);
    }, [contact?.recommendationHistory]);
    const areRecsLoading = isContactLoading; // Loading is now tied to the contact loading


    // --- Side Effects & Memoization ---
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
                toast({ variant: 'destructive', title: 'Eroare la încărcare', description: 'Nu am putut încărca lista de agenți.' });
            } finally {
                setAreAgentsLoading(false);
            }
        };

        fetchAgents();
    }, [agency, firestore, toast]);

    useEffect(() => {
        if (properties && contact) {
            const matcherProperties = properties.map(p => ({
                ...p,
                address: p.address || p.location || '',
                price: p.price || 0,
                rooms: p.rooms || 0,
                bathrooms: p.bathrooms || 0,
                squareFootage: p.squareFootage || 0,
                description: p.description || p.title || '',
                image: p.images?.[0]?.url || `https://picsum.photos/seed/${p.id}/400/300`,
            }));
            propertyMatcher({
                clientPreferences: contact.preferences || {
                    desiredPriceRangeMin: (contact.budget || 0) * 0.8,
                    desiredPriceRangeMax: (contact.budget || 0) * 1.2,
                    desiredRooms: 2,
                    desiredBathrooms: 1,
                    desiredSquareFootageMin: 50,
                    desiredSquareFootageMax: 100,
                    desiredFeatures: '',
                    locationPreferences: contact.city || '',
                },
                properties: matcherProperties,
            }).then(result => {
                setMatchedProperties(result.matchedProperties as MatchedProperty[]);
            });
        }
    }, [properties, contact]);
    
    // --- MUTATION HANDLERS ---
    const handleUpdateContact = (data: Partial<Omit<Contact, 'id'>>) => {
        if (!contactDocRef) return;
        
        let finalData = { ...data };
        if (data.preferences && contact?.preferences) {
            finalData.preferences = { ...contact.preferences, ...data.preferences };
        }
        
        updateDocumentNonBlocking(contactDocRef, finalData);
        
        toast({ title: 'Cumpărător actualizat', description: 'Modificările au fost salvate.' });
    };
    
    const handleUpdateRecommendation = (recommendationId: string, data: Partial<Omit<PortalRecommendation, 'id'>>) => {
        if (!contact?.portalId || !contactDocRef) return;

        // Also update the live portal for the client
        const recRef = doc(firestore, 'portals', contact.portalId, 'recommendations', recommendationId);
        updateDocumentNonBlocking(recRef, data);
        
        // Update the historical record on the contact
        const existingRec = contact.recommendationHistory?.[recommendationId];
        if (existingRec) {
            const updatedRec = { ...existingRec, ...data };
            updateDocumentNonBlocking(contactDocRef, {
                [`recommendationHistory.${recommendationId}`]: updatedRec
            });
        }
    };

    const handleRematch = async (preferences: ContactPreferences) => {
        if (!contact || !properties) {
            toast({ variant: "destructive", title: "Date lipsă", description: "Nu s-au putut încărca proprietățile."});
            return;
        }

        setIsMatching(true);
        
        const matcherProperties = properties.map(p => ({
            ...p,
            address: p.address || p.location || '',
            price: p.price || 0,
            rooms: p.rooms || 0,
            bathrooms: p.bathrooms || 0,
            squareFootage: p.squareFootage || 0,
            description: p.description || p.title || '',
            image: p.images?.[0]?.url || `https://picsum.photos/seed/${p.id}/400/300`,
        }));

        try {
            const result = await propertyMatcher({
                clientPreferences: preferences,
                properties: matcherProperties,
            });
            setMatchedProperties(result.matchedProperties as MatchedProperty[]);
            if (result.matchedProperties.length === 0) {
                toast({
                    title: 'Nicio potrivire perfectă găsită',
                    description: 'AI-ul nu a găsit nicio proprietate care să corespundă noilor criterii.',
                });
            }
        } catch (error) {
            console.error('Property matching failed:', error);
            toast({ variant: "destructive", title: "A apărut o eroare", description: "Nu am putut găsi proprietăți potrivite."});
        } finally {
            setIsMatching(false);
        }
    }

    const handleAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => {
        if (!agency?.id || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || user.email,
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({ title: "Task adăugat!" });
    };
    
    const handleAddViewing = (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agency?.id || !user) return;

        const selectedProperty = properties?.find(p => p.id === viewingData.propertyId);
        if (!selectedProperty) return;
        
        const viewingsCollection = collection(firestore, 'agencies', agency.id, 'viewings');
        const viewingToAdd: Omit<Viewing, 'id'> = {
            ...viewingData,
            propertyTitle: selectedProperty.title,
            propertyAddress: selectedProperty.address,
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || user.email,
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(viewingsCollection, viewingToAdd);
        toast({ title: "Vizionare programată!" });
    };

    const handleAddInteraction = async (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => {
        if (!contactDocRef || !user) return Promise.reject("User or contact not available");
        
        const newInteraction: Interaction = {
            ...interactionData,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            agent: {
                name: userProfile?.name || user.displayName || user.email || 'Nespecificat',
            }
        };
        
        await updateDocumentNonBlocking(contactDocRef, {
            interactionHistory: arrayUnion(newInteraction)
        });
    };

     const handleToggleTask = (task: Task) => {
        if (!agency?.id) return;
        const taskRef = doc(firestore, 'agencies', agency.id, 'tasks', task.id);
        const newStatus = task.status === 'completed' ? 'open' : 'completed';
        updateDocumentNonBlocking(taskRef, { status: newStatus });
        toast({
            title: `Task ${newStatus === 'completed' ? 'completat' : 'redeschis'}!`,
            description: `"${task.description}" a fost actualizat.`,
        });
    };

    const similarCumparatori = useMemo(() => {
        if (!contact || !allContacts || allContacts.length <= 1) return [];

        const hasFilterCriteria = (contact.zones && contact.zones.length > 0) || contact.budget;
        if (!hasFilterCriteria) {
            return [];
        }

        const budgetFlexibility = 0.20; // 20% flexibility
        const minBudget = contact.budget ? contact.budget * (1 - budgetFlexibility) : 0;
        const maxBudget = contact.budget ? contact.budget * (1 + budgetFlexibility) : Infinity;

        return allContacts.filter(otherLead => {
            if (otherLead.id === contact.id) return false;

            const budgetMatch = contact.budget && otherLead.budget 
                ? (otherLead.budget >= minBudget && otherLead.budget <= maxBudget)
                : false;
            
            const zoneMatch = contact.zones && contact.zones.length > 0 && otherLead.zones && otherLead.zones.length > 0
                ? contact.zones.some(zone => otherLead.zones!.includes(zone))
                : false;
            
            return budgetMatch || zoneMatch;
        }).slice(0, 5);
    }, [contact, allContacts]);

    const handleAddOffer = (offerData: Omit<Offer, 'id' | 'date' | 'status'>) => {
        if (!contactDocRef) return;
        const newOffer: Offer = {
            ...offerData,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            status: 'În așteptare',
        };
        updateDocumentNonBlocking(contactDocRef, {
            offers: arrayUnion(newOffer)
        });
        toast({ title: 'Ofertă adăugată!' });
    };

    const handleUpdateOffer = (offerId: string, data: Partial<Omit<Offer, 'id'>>) => {
        if (!contactDocRef || !contact || !contact.offers) return;

        const updatedOffers = contact.offers.map(offer => {
            if (offer.id === offerId) {
                return { ...offer, ...data };
            }
            return offer;
        });

        updateDocumentNonBlocking(contactDocRef, { offers: updatedOffers });
        toast({ title: 'Status ofertă actualizat!' });
    };

    const handleDeleteOffer = (offerId: string) => {
        if (!contactDocRef || !contact || !contact.offers) return;

        const offerToDelete = contact.offers.find(offer => offer.id === offerId);
        if (offerToDelete) {
             updateDocumentNonBlocking(contactDocRef, {
                offers: arrayRemove(offerToDelete)
            });
            toast({ title: 'Ofertă ștearsă!', variant: 'destructive' });
        }
    };

    const upcomingViewing = useMemo(() => {
        if (!viewings) return null;
        const now = new Date();
        return viewings.find(v => v.status === 'scheduled' && parseISO(v.viewingDate) >= now);
    }, [viewings]);

    const upcomingViewingProperty = useMemo(() => {
        if (!upcomingViewing || !properties) return null;
        return properties.find(p => p.id === upcomingViewing.propertyId);
    }, [upcomingViewing, properties]);

    const timelineItems = useMemo(() => {
        if (!tasks && !contact?.interactionHistory) return [];
        const combined: ({ type: 'task' } & Task | { type: 'interaction' } & Interaction)[] = [];
        (tasks || []).forEach(t => combined.push({ ...t, type: 'task' }));
        (contact?.interactionHistory || []).forEach(i => combined.push({ ...i, type: 'interaction' }));
        return combined.sort((a, b) => {
            const dateA = new Date(a.type === 'task' ? a.dueDate : a.date);
            const dateB = new Date(b.type === 'task' ? b.dueDate : b.date);
            return dateB.getTime() - dateA.getTime();
        });
    }, [tasks, contact?.interactionHistory]);


    const isLoading = isContactLoading || isContextLoading || areAgentsLoading || areTasksLoading || arePropertiesLoading || areViewingsLoading || isSourcePropertyLoading || areAllContactsLoading || areRecsLoading;

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (contactError || !contact || !agency) {
        notFound();
        return null;
    }

    return (
        <div className="h-full flex flex-col">
            <div className='lg:hidden bg-[#0F1E33] min-h-full -mx-4 -mt-6 -mb-20'>
                <div className="p-4 space-y-4 text-white">
                    <h1 className="text-2xl font-bold pt-12">Cumpărători</h1>
                    
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl p-4 space-y-4">
                        <p className='text-sm text-white/60'>Bună {userProfile?.name?.split(' ')[0]}! Detalii cumpărător</p>
                        <div className='flex justify-between items-start'>
                            <div>
                                <div className='flex items-center gap-2'>
                                    <h2 className='text-xl font-bold'>{contact.name}</h2>
                                    <Badge className='bg-white/10 text-white border-none'>{contact.status}</Badge>
                                </div>
                                {contact.budget && <p>Buget: €{contact.budget.toLocaleString()}</p>}
                                {contact.zones && contact.zones.length > 0 && <p className='text-sm text-white/80'>Zone: {contact.zones.join(', ')}</p>}
                            </div>
                            {typeof contact.leadScore === 'number' && (
                                <CircularProgress score={contact.leadScore} />
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                             <Button asChild variant='secondary' className="bg-white/90 text-black hover:bg-white">
                                <a href={`tel:${contact.phone}`}><Phone className='mr-2' /> Apel</a>
                             </Button>
                             <Button asChild variant='secondary' className="bg-white/90 text-black hover:bg-white">
                                <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="mr-2 h-5 w-5" /> WhatsApp</a>
                             </Button>
                             <Button asChild variant='secondary' className="bg-white/90 text-black hover:bg-white">
                                <a href={`mailto:${contact.email}`}><Mail className='mr-2'/> Email</a>
                             </Button>
                            <AddTaskDialog onAddTask={handleAddTask} contacts={[contact]}>
                                <Button variant='secondary' className="bg-white/90 text-black hover:bg-white w-full"><Plus className='mr-2'/> Task</Button>
                            </AddTaskDialog>
                        </div>
                        <Button className='w-full bg-green-500 hover:bg-green-600 text-white' onClick={() => handleUpdateContact({ status: 'Câștigat' })}>Marchează Vândut</Button>
                    </Card>

                    {upcomingViewing && (
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <CardContent className='p-0'>
                                <div className='p-4'>
                                    <div className='flex justify-between items-center'>
                                        <h3 className='font-semibold'>Vizionări Programate</h3>
                                        <p className='text-xs text-white/60'>{format(parseISO(upcomingViewing.viewingDate), "eeee, d MMM", { locale: ro })}</p>
                                    </div>
                                </div>
                                <div className='relative h-32'>
                                    {upcomingViewingProperty?.images?.[0]?.url && (
                                        <Image src={upcomingViewingProperty.images[0].url} alt={upcomingViewingProperty.title} fill className='object-cover'/>
                                    )}
                                    <div className='absolute inset-0 bg-black/50 flex flex-col justify-end p-4'>
                                        <h4 className='font-bold text-white'>{upcomingViewing.propertyTitle}</h4>
                                        <p className='text-sm text-white/80'>{format(parseISO(upcomingViewing.viewingDate), "d MMM, HH:mm", { locale: ro })} cu: {upcomingViewing.contactName}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                     {matchedProperties && matchedProperties.length > 0 && (
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                            <CardContent className='p-4 space-y-2'>
                                <h3 className='font-semibold'>Proprietăți Potrivite</h3>
                                {matchedProperties.slice(0, 2).map(p => (
                                    <div key={p.id} className='bg-white/5 p-3 rounded-lg'>
                                        <p className='font-semibold text-sm'>{p.title}</p>
                                        <p className='text-xs text-white/70'>{p.rooms} camere • €{p.price.toLocaleString()}</p>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                     )}

                    {timelineItems && timelineItems.length > 0 && (
                         <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                            <CardContent className='p-4 space-y-3'>
                                <h3 className='font-semibold'>Cronologie</h3>
                                {timelineItems.slice(0, 4).map((item, index) => (
                                    <div key={index} className='flex justify-between items-center text-sm'>
                                        <div className='flex items-center gap-2'>
                                            {item.type === 'task' ? <CheckSquare className='h-4 w-4 text-white/60'/> : <WhatsappIcon className='h-4 w-4 text-white/60'/>}
                                            <div>
                                                <p>{item.type === 'task' ? `Task: ${item.description}` : item.type}</p>
                                                {item.type === 'task' && item.agentName && <p className='text-xs text-white/60'>Agent: {item.agentName}</p>}
                                            </div>
                                        </div>
                                        <p className='text-xs text-white/60'>{formatDistanceToNow(new Date(item.type === 'task' ? item.dueDate : item.date), { locale: ro, addSuffix: true })}</p>
                                    </div>
                                ))}
                            </CardContent>
                         </Card>
                    )}

                </div>
            </div>
            
            {/* Desktop View: Grid */}
            <div className="hidden lg:block h-full">
                <LeadHeader 
                    contact={contact} 
                    onUpdateContact={handleUpdateContact}
                    onAddTask={handleAddTask}
                    onTriggerAddViewing={() => setIsAddViewingOpen(true)}
                    properties={properties || []}
                />
                <main className="pt-6 grid lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-3 space-y-6">
                        <LeadInfoCard contact={contact} onEdit={() => setIsEditInfoOpen(true)} />
                        <AiLeadScoreCard contact={contact} onUpdateContact={handleUpdateContact} />
                        <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                        <ClientPortalManager contact={contact} agency={agency} />
                    </div>

                    <div className="lg:col-span-5 space-y-6">
                        <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []}
                            onAddInteraction={handleAddInteraction}
                            onAddTask={handleAddTask}
                            contacts={[contact]}
                            onToggleTask={handleToggleTask}
                        />
                        <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                        <FinancialStatusCard 
                            contact={contact} 
                            onUpdateContact={handleUpdateContact}
                            recommendations={recommendations}
                            properties={properties}
                            portalId={contact.portalId || null}
                            onUpdateRecommendation={handleUpdateRecommendation}
                        />
                         <OfferManagementCard
                            contact={contact}
                            properties={properties || []}
                            onAddOffer={handleAddOffer}
                            onUpdateOffer={handleUpdateOffer}
                            onDeleteOffer={handleDeleteOffer}
                        />
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                         <PreferencesCard contact={contact} onUpdateContact={handleUpdateContact} onRematch={handleRematch} isMatching={isMatching} />
                         <MatchedProperties properties={matchedProperties} contact={contact} />
                         <SourcePropertyCard 
                            property={sourceProperty} 
                            isLoading={isSourcePropertyLoading}
                            allProperties={properties || []}
                            onUpdateContact={handleUpdateContact}
                        />
                        <ScheduledViewingsCard viewings={viewings || []} />
                        <SimilarLeadsCard leads={similarCumparatori} />
                    </div>
                </main>
            </div>

             <EditLeadInfoDialog 
                contact={contact}
                isOpen={isEditInfoOpen}
                onOpenChange={setIsEditInfoOpen}
                onUpdateContact={handleUpdateContact}
            />
            <AddViewingDialog
                isOpen={isAddViewingOpen}
                onOpenChange={setIsAddViewingOpen}
                onAddViewing={handleAddViewing}
                properties={properties || []}
                contacts={allContacts || []}
            />
        </div>
    );
}
