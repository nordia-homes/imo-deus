
'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDocs, getDoc, arrayUnion, arrayRemove, orderBy } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { propertyMatcher } from '@/ai/flows/property-matcher';

import type { Contact, Property, Task, UserProfile, Interaction, Agency, Viewing, MatchedProperty, PortalRecommendation, Offer, FinancialStatus, ContactPreferences } from '@/lib/types';
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
import { EditLeadDialog } from '@/components/leads/detail/EditLeadDialog';
import { OfferManagementCard } from '@/components/leads/detail/OfferManagementCard';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Plus, Check, CheckSquare, Edit, Calendar, Wand2 } from 'lucide-react';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { EditPreferencesForm } from '@/components/leads/detail/EditPreferencesForm';


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
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);
    const [isEditingPreferences, setIsEditingPreferences] = useState(false);


    // --- DATA FETCHING ---
    const contactDocRef = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        return doc(firestore, 'agencies', agency.id, 'contacts', cumparatorId);
    }, [firestore, agency?.id, cumparatorId]);

    const { data: contact, isLoading: isContactLoading, error: contactError } = useDoc<Contact>(contactDocRef);

    // Fetch ALL tasks and viewings for the agency, then filter locally.
    // This avoids security rule issues with `where` clauses on subcollections.
    const allTasksQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return collection(firestore, 'agencies', agency.id, 'tasks');
    }, [firestore, agency?.id]);
    const { data: allTasks, isLoading: areTasksLoading } = useCollection<Task>(allTasksQuery);

    const allViewingsQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return query(collection(firestore, 'agencies', agency.id, 'viewings'), orderBy('viewingDate', 'asc'));
    }, [firestore, agency?.id]);
    const { data: allViewings, isLoading: areViewingsLoading } = useCollection<Viewing>(allViewingsQuery);
    
    // Client-side filtering
    const tasks = useMemo(() => {
        if (!allTasks || !cumparatorId) return [];
        return allTasks.filter(task => task.contactId === cumparatorId);
    }, [allTasks, cumparatorId]);
    
    const viewings = useMemo(() => {
        if (!allViewings || !cumparatorId) return [];
        return allViewings.filter(viewing => viewing.contactId === cumparatorId);
    }, [allViewings, cumparatorId]);


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
            const clientPrefs = contact.preferences || {
                desiredPriceRangeMin: (contact.budget || 0) * 0.8,
                desiredPriceRangeMax: (contact.budget || 0) * 1.2,
                desiredRooms: 2,
                desiredBathrooms: 1,
                desiredSquareFootageMin: 50,
                desiredSquareFootageMax: 100,
                desiredFeatures: '',
                locationPreferences: contact.city || '',
            };
            // Ensure required fields are present
            const fullClientPrefs = {
                ...{
                    desiredRooms: 0,
                    desiredBathrooms: 0,
                    desiredSquareFootageMin: 0,
                    desiredSquareFootageMax: 99999,
                    desiredFeatures: '',
                    locationPreferences: '',
                    desiredPriceRangeMin: 0,
                    desiredPriceRangeMax: 9999999,
                },
                ...clientPrefs
            };
            propertyMatcher({
                clientPreferences: fullClientPrefs,
                properties: matcherProperties,
            }).then(result => {
                if (result.matchedProperties && properties) {
                  const enrichedMatchedProperties = result.matchedProperties.map(matchedProp => {
                    const originalProperty = properties.find(p => p.id === (matchedProp as any).id);
                    return {
                      ...originalProperty, // This has the full 'images' array
                      ...matchedProp,     // This adds matchScore, reasoning, etc.
                    };
                  });
                  setMatchedProperties(enrichedMatchedProperties as MatchedProperty[]);
                } else {
                  setMatchedProperties([]);
                }
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
    
    const handleAddRecommendation = (property: Property) => {
        if (!contact?.portalId || !contactDocRef) {
            toast({
                variant: "destructive",
                title: "Portal neactivat",
                description: "Activați portalul clientului înainte de a adăuga proprietăți.",
            });
            return;
        }

        const recommendation: Omit<PortalRecommendation, 'id'> = {
            propertyId: property.id,
            addedAt: new Date().toISOString(),
            clientFeedback: 'none',
        };

        // Add to portal subcollection. The ID is the property ID.
        const recRef = doc(firestore, 'portals', contact.portalId, 'recommendations', property.id);
        setDocumentNonBlocking(recRef, recommendation, {});

        // Add to contact's history
        updateDocumentNonBlocking(contactDocRef, {
            [`recommendationHistory.${property.id}`]: { ...recommendation, id: property.id },
        });
        
        toast({
            title: "Proprietate adăugată!",
            description: `${property.title} a fost adăugată în portalul clientului.`,
        });
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
            if (result.matchedProperties && properties) {
              const enrichedMatchedProperties = result.matchedProperties.map(matchedProp => {
                const originalProperty = properties.find(p => p.id === (matchedProp as any).id);
                return {
                  ...originalProperty,
                  ...matchedProp,
                };
              });
              setMatchedProperties(enrichedMatchedProperties as MatchedProperty[]);
            } else {
              setMatchedProperties([]);
            }

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
            setIsEditingPreferences(false);
        }
    }

    const handleAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => {
        if (!agency?.id || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
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
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
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
    
    const scheduledViewings = useMemo(() => {
        if (!viewings) return [];
        return viewings
            .filter(v => v.status === 'scheduled')
            .sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());
    }, [viewings]);

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

    if (isEditingPreferences) {
        return (
            <EditPreferencesForm
                contact={contact}
                onUpdateContact={handleUpdateContact}
                onRematch={handleRematch}
                isMatching={isMatching}
                onClose={() => setIsEditingPreferences(false)}
            />
        );
    }

    return (
        <div className="h-full flex flex-col">
             {/* Mobile View: Dark, app-like */}
            <div className='lg:hidden bg-[#0F1E33] -mt-6 pb-4'>
                <div className="pt-4 space-y-4">
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl p-4 space-y-4">
                        <div className='flex justify-between items-start'>
                             <div>
                                <div className='flex items-center gap-2'>
                                    <h2 className='text-xl font-bold'>{contact.name}</h2>
                                    <Button size="icon" variant="ghost" className="text-white/70 hover:text-white h-7 w-7" onClick={() => setIsEditDialogOpen(true)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Badge className='bg-white/10 text-white border-none'>{contact.status}</Badge>
                                </div>
                                {contact.budget && <p className="mt-2">Buget: €{contact.budget.toLocaleString()}</p>}
                                {contact.zones && contact.zones.length > 0 && <p className='text-sm text-white/80'>Zone: {contact.zones.join(', ')}</p>}
                            </div>
                            {typeof contact.leadScore === 'number' && (
                                <CircularProgress score={contact.leadScore} />
                            )}
                        </div>

                        <div className="space-y-2">
                             <div className="grid grid-cols-2 gap-2">
                                <Button asChild variant='secondary' className="bg-white/90 text-black hover:bg-white">
                                    <a href={`tel:${contact.phone}`}><Phone className='mr-2' /> Apel</a>
                                </Button>
                                <Button asChild variant='secondary' className="bg-white/90 text-black hover:bg-white">
                                    <a href={`https://wa.me/${contact.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="mr-2 h-5 w-5" /> WhatsApp</a>
                                </Button>
                            </div>
                            <Button variant='secondary' className="bg-[#0B1319] text-white hover:bg-[#0B1319]/90 w-full" onClick={() => setIsEditingPreferences(true)}>
                                <Wand2 className='mr-2 h-4 w-4' /> Actualizare Preferinte
                            </Button>
                        </div>
                        <Button className='w-full bg-primary hover:bg-primary/90 text-white' onClick={() => setIsAddViewingOpen(true)}>Programează Vizionare</Button>
                    </Card>

                    <Card className="bg-[#152A47] text-white border-none rounded-2xl mx-2">
                        <CardHeader className="p-4">
                            <CardTitle className="font-semibold text-white text-base">Vizionări Programate</CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                            {scheduledViewings.length > 0 ? (
                                <div className="space-y-3">
                                    {scheduledViewings.map(viewing => (
                                        <Link href={`/properties/${viewing.propertyId}`} key={viewing.id} className="block p-3 rounded-lg border border-white/20 hover:bg-white/10">
                                            <p className="font-semibold text-sm truncate">{viewing.propertyTitle}</p>
                                            <p className="text-xs text-white/80 flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {format(parseISO(viewing.viewingDate), "d MMM yyyy, HH:mm", { locale: ro })}
                                            </p>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-white/70 text-center py-2">
                                    Nicio vizionare programată.
                                </p>
                            )}
                        </CardContent>
                    </Card>
                    
                    <MatchedProperties
                        properties={matchedProperties}
                        onAddRecommendation={handleAddRecommendation}
                        agencyId={agency?.id}
                        contact={contact}
                    />

                    <ClientPortalManager contact={contact} agency={agency} />
                    
                    <div className="pt-2">
                        <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                    </div>

                    <div className="pt-4">
                      <SourcePropertyCard 
                          property={sourceProperty} 
                          isLoading={isSourcePropertyLoading}
                          allProperties={properties || []}
                          onUpdateContact={handleUpdateContact}
                      />
                    </div>
                    
                    <div className="pt-4 space-y-4">
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

                    <Accordion type="multiple" className="w-full space-y-4 px-2">
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <AccordionItem value="timeline" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">
                                    Cronologie & Acțiuni
                                </AccordionTrigger>
                                <AccordionContent className="px-2 pb-2 pt-0">
                                    <LeadTimeline 
                                        interactions={contact.interactionHistory || []} 
                                        tasks={tasks || []}
                                        onAddInteraction={handleAddInteraction}
                                        onAddTask={handleAddTask}
                                        contacts={[contact]}
                                        onToggleTask={handleToggleTask}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Card>
                         <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                             <AccordionItem value="settings" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">
                                    Setări & Asocieri
                                </AccordionTrigger>
                                <AccordionContent className="px-2 pt-0 pb-2 space-y-2">
                                    <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                                    <SimilarLeadsCard leads={similarCumparatori} />
                                </AccordionContent>
                            </AccordionItem>
                        </Card>

                    </Accordion>

                </div>
            </div>
            
            {/* Desktop View */}
            <div className="hidden lg:block h-full bg-[#0F1E33] pb-2 pt-5 text-white">
                 <LeadHeader 
                    contact={contact} 
                    onUpdateContact={handleUpdateContact}
                    onAddTask={handleAddTask}
                    onTriggerAddViewing={() => setIsAddViewingOpen(true)}
                    properties={properties || []}
                    onTriggerEditPreferences={() => setIsEditingPreferences(true)}
                 />
                 <main className="grid lg:grid-cols-12 gap-6 items-start mt-6 px-6">
                    <div className="lg:col-span-3 space-y-6">
                        <LeadInfoCard contact={contact} onEdit={() => setIsEditDialogOpen(true)} onUpdateContact={handleUpdateContact} />
                        <SourcePropertyCard property={sourceProperty} isLoading={isSourcePropertyLoading} allProperties={properties || []} onUpdateContact={handleUpdateContact} />
                         <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []}
                            onAddInteraction={handleAddInteraction}
                            onAddTask={handleAddTask}
                            contacts={[contact]}
                            onToggleTask={handleToggleTask}
                        />
                    </div>

                    <div className="lg:col-span-6 space-y-6">
                        <MatchedProperties
                            properties={matchedProperties}
                            onAddRecommendation={handleAddRecommendation}
                            agencyId={agency?.id}
                            contact={contact}
                        />
                        <ScheduledViewingsCard viewings={scheduledViewings} />
                        <SimilarLeadsCard leads={similarCumparatori} />
                        <OfferManagementCard
                            contact={contact}
                            properties={properties || []}
                            onAddOffer={handleAddOffer}
                            onUpdateOffer={handleUpdateOffer}
                            onDeleteOffer={handleDeleteOffer}
                        />
                    </div>

                    <div className="lg:col-span-3 space-y-6">
                        <ClientPortalManager contact={contact} agency={agency} />
                        <FinancialStatusCard 
                            contact={contact} 
                            onUpdateContact={handleUpdateContact}
                            recommendations={recommendations}
                            properties={properties}
                            portalId={contact.portalId || null}
                            onUpdateRecommendation={handleUpdateRecommendation}
                        />
                         <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                    </div>
                </main>
            </div>

             <EditLeadDialog 
                contact={contact}
                isOpen={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                onUpdateContact={handleUpdateContact}
                properties={properties || []}
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
