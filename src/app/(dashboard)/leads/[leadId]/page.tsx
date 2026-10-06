
'use client';
import { executeCrmAction, manualTaskDetails } from '@/lib/crm/client-actions';
import { createManualViewing } from '@/lib/crm/client-actions';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDocs, arrayUnion, arrayRemove, addDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { propertyMatcher, propertyMatcherFromContact } from '@/ai/flows/property-matcher';

import type { Contact, Property, Task, Interaction, Agency, Viewing, MatchedProperty, PortalRecommendation, Offer, FinancialStatus, ContactPreferences } from '@/lib/types';
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
import { EditLeadDialog } from '@/components/leads/detail/EditLeadDialog';
import { BuyerFinanceAndOffersCard } from '@/components/leads/detail/BuyerFinanceAndOffersCard';
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
import { PreferencesFormCard } from '@/components/leads/detail/PreferencesFormCard';
import { PreferencesChatHistoryCard } from '@/components/leads/detail/PreferencesChatHistoryCard';
import { useAgencyAgents } from '@/hooks/use-agency-agents';


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
    const params = useParams<{ leadId: string }>();
    const cumparatorId = typeof params?.leadId === 'string' ? params.leadId : '';
    
    const { agency, userProfile, isAgencyLoading: isContextLoading } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { agents, isLoading: areAgentsLoading, error: agentsError } = useAgencyAgents();

    // --- Component State ---
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

    // Fetch tasks and viewings filtered for this specific contact
    const tasksQuery = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        return query(
            collection(firestore, 'agencies', agency.id, 'tasks'),
            where('contactId', '==', cumparatorId)
        );
    }, [firestore, agency?.id, cumparatorId]);
    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        return query(
            collection(firestore, 'agencies', agency.id, 'viewings'),
            where('contactId', '==', cumparatorId)
        );
    }, [firestore, agency?.id, cumparatorId]);
    const { data: viewingsById, isLoading: areViewingsByIdLoading } = useCollection<Viewing>(viewingsQuery);

    const viewingsByNameQuery = useMemoFirebase(() => {
        if (!agency?.id || !contact?.name) return null;
        return query(
            collection(firestore, 'agencies', agency.id, 'viewings'),
            where('contactName', '==', contact.name)
        );
    }, [firestore, agency?.id, contact?.name]);
    const { data: viewingsByName, isLoading: areViewingsByNameLoading } = useCollection<Viewing>(viewingsByNameQuery);


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

    const viewings = useMemo(() => {
        const sortViewings = (items: Viewing[] | null) =>
            (items || []).slice().sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

        if (viewingsById && viewingsById.length > 0) {
            return sortViewings(viewingsById);
        }

        if (viewingsByName && viewingsByName.length > 0) {
            return sortViewings(viewingsByName);
        }

        return sortViewings(viewingsById || viewingsByName || []);
    }, [viewingsById, viewingsByName]);


    // --- Side Effects & Memoization ---
    useEffect(() => {
        if (!agentsError) return;

        console.error('Error fetching agent profiles:', agentsError);
        toast({
            variant: 'destructive',
            title: 'Eroare la încărcare',
            description: agentsError.message || 'Nu am putut încărca lista de agenți.',
        });
    }, [agentsError, toast]);

    useEffect(() => {
        if (!user || !contactDocRef || !contact || !properties || viewings.length === 0) {
            return;
        }

        const sortedViewings = [...viewings].sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());
        const firstViewing = sortedViewings[0];
        const firstViewingProperty = properties.find((property) => property.id === firstViewing.propertyId);
        const updates: { sourcePropertyId?: string; budget?: number; city?: string; zones?: string[]; description?: string } = {};

        if (!contact.sourcePropertyId && firstViewing.propertyId) {
            updates.sourcePropertyId = firstViewing.propertyId;
        }

        if (contact.budget == null && typeof firstViewingProperty?.price === 'number') {
            updates.budget = firstViewingProperty.price;
        }

        if (!contact.city && typeof firstViewingProperty?.city === 'string' && firstViewingProperty.city.trim().length > 0) {
            updates.city = firstViewingProperty.city.trim();
        }

        if (
            (!contact.zones || contact.zones.length === 0) &&
            typeof firstViewingProperty?.zone === 'string' &&
            firstViewingProperty.zone.trim().length > 0
        ) {
            updates.zones = [firstViewingProperty.zone.trim()];
        }

        const autoDescription = firstViewingProperty?.title
            ? `Notita automata: client adaugat pentru vizionarea proprietatii ${firstViewingProperty.title}`
            : null;
        const canAutoFillDescription =
            !contact.description ||
            contact.description.trim().length === 0 ||
            contact.description.startsWith('Notita automata: client adaugat pentru vizionarea proprietatii');

        if (autoDescription && canAutoFillDescription && contact.description !== autoDescription) {
            updates.description = autoDescription;
        }

        if (Object.keys(updates).length > 0) {
            void executeCrmAction(user, { kind: 'update_contact', contactId: contact.id, expectedUpdatedAt: contact.updatedAt ?? null, patch: updates }).catch((error) => {
                toast({ variant: 'destructive', title: 'Datele clientului nu au fost completate', description: error instanceof Error ? error.message : 'Reîncarcă datele și încearcă din nou.' });
            });
        }
    }, [user, contactDocRef, contact, properties, viewings, toast]);

    useEffect(() => {
        if (!properties || !contact) {
            return;
        }

        propertyMatcherFromContact(contact, properties)
            .then((result) => {
                setMatchedProperties(result.matchedProperties || []);
            })
            .catch((error) => {
                console.error('Automatic OpenAI property matching failed:', error);
                setMatchedProperties([]);
            });
    }, [properties, contact]);
    
    // --- MUTATION HANDLERS ---
    const handleUpdateContact = async (data: Partial<Omit<Contact, 'id'>>) => {
        if (!contact || !user) return;
        try {
            const { preferences, agentId, agentName: _agentName, ...patch } = data;
            if (agentId !== undefined) await executeCrmAction(user, { kind: 'assign_record', resource: 'contacts', id: contact.id, agentId });
            if (preferences) await executeCrmAction(user, { kind: 'update_preferences', contactId: contact.id, preferences });
            if (Object.values(patch).some(value => value !== undefined)) await executeCrmAction(user, { kind: 'update_contact', contactId: contact.id, patch });
            toast({ title: 'Cumpărător actualizat', description: 'Modificările au fost salvate.' });
        } catch (error) { toast({ variant: 'destructive', title: 'Modificarea nu a fost confirmată', description: error instanceof Error ? error.message : 'Încearcă din nou.' }); }
    };
    const handleUpdateRecommendation = async (recommendationId: string, data: Partial<Omit<PortalRecommendation, 'id'>>) => {
        if (!contact) return;
        try { await executeCrmAction(user, { kind: 'update_recommendation', contactId: contact.id, propertyId: recommendationId, patch: { ...(data.clientFeedback ? { clientFeedback: data.clientFeedback } : {}), ...(data.clientComment !== undefined ? { clientComment: data.clientComment } : {}) } }); }
        catch (error) { toast({ variant: 'destructive', title: 'Feedbackul nu a fost salvat', description: error instanceof Error ? error.message : 'Încearcă din nou.' }); }
    };
    const handleAddRecommendation = async (property: Property) => {
        if (!contact?.portalId) { toast({ variant: 'destructive', title: 'Portal neactivat', description: 'Activează portalul clientului.' }); return; }
        try { await executeCrmAction(user, { kind: 'recommend_properties', contactId: contact.id, propertyIds: [property.id] }); toast({ title: 'Recomandare adăugată!' }); }
        catch (error) { toast({ variant: 'destructive', title: 'Recomandarea nu a fost salvată', description: error instanceof Error ? error.message : 'Încearcă din nou.' }); }
    };

    const handleRematch = async (preferences: ContactPreferences) => {
        if (!contact || !properties) {
            toast({ variant: "destructive", title: "Date lipsă", description: "Nu s-au putut încărca proprietățile."});
            return;
        }

        setIsMatching(true);
        
        try {
            const result = await propertyMatcher({
                clientPreferences: preferences,
                properties,
                contact,
            });
            if (result.matchedProperties) {
              setMatchedProperties(result.matchedProperties as MatchedProperty[]);
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

    const handleAddTask = async (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => {
        if (!agency?.id || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
        };
        try { await executeCrmAction(user, { kind: 'create_task', ...manualTaskDetails(taskData), description: taskData.description, dueDate: taskData.dueDate, ...(taskData.contactId ? { contactId: taskData.contactId } : {}), ...(taskData.propertyId ? { propertyId: taskData.propertyId } : {}) }); }
        catch (error) { toast({ variant: 'destructive', title: 'Task-ul nu a fost salvat', description: error instanceof Error ? error.message : 'Încearcă din nou.' }); throw error; }
        toast({ title: "Task adăugat!" });
    };
    
    const handleAddViewing = async (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agency?.id || !user) return;

        const selectedProperty = properties?.find(p => p.id === viewingData.propertyId);
        if (!selectedProperty) return;
        
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
            await createManualViewing(user, viewingToAdd);
            toast({ title: "Vizionare programată!" });
        } catch (error) {
            console.error('Failed to add viewing from lead detail page:', error);
            toast({
                variant: 'destructive',
                title: 'Eroare',
                description: 'Vizionarea nu a putut fi salvată.',
            });
            throw error;
        }
    };

    const handleAddInteraction = async (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => {
        if (!contact || !user) throw new Error('Contact indisponibil.');
        await executeCrmAction(user, { kind: 'add_interaction', contactId: contact.id, type: interactionData.type, notes: interactionData.notes });
    };
    const handleToggleTask = async (task: Task) => {
        try { await executeCrmAction(user, { kind: 'update_task', taskId: task.id, expectedUpdatedAt: task.updatedAt || null, status: task.status === 'completed' ? 'open' : 'completed' }); }
        catch (error) { toast({ variant: 'destructive', title: 'Task-ul nu a fost actualizat', description: error instanceof Error ? error.message : 'Încearcă din nou.' }); }
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

    const persistOffer = async (action: Parameters<typeof executeCrmAction>[1], title: string) => {
        try { await executeCrmAction(user, action); toast({ title }); }
        catch (error) { toast({ variant: 'destructive', title: 'Oferta nu a fost salvată', description: error instanceof Error ? error.message : 'Încearcă din nou.' }); }
    };
    const handleAddOffer = async (offerData: Omit<Offer, 'id' | 'date' | 'status'>) => {
        if (!contact) return;
        await persistOffer({ kind: 'record_offer', contactId: contact.id, propertyId: offerData.propertyId, price: offerData.price }, 'Ofertă adăugată!');
    };
    const handleUpdateOffer = async (offerId: string, data: Partial<Omit<Offer, 'id'>>) => {
        if (!contact) return;
        await persistOffer({ kind: 'update_offer', contactId: contact.id, offerId, patch: { ...(data.price !== undefined ? { price: data.price } : {}), ...(data.status ? { status: data.status } : {}) } }, 'Ofertă actualizată!');
    };
    const handleDeleteOffer = async (offerId: string) => {
        if (!contact) return;
        await persistOffer({ kind: 'delete_offer', contactId: contact.id, offerId }, 'Ofertă ștearsă!');
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

    const fallbackSourceProperty = useMemo(() => {
        if (sourceProperty || !properties || viewings.length === 0) return sourceProperty;
        const firstViewing = [...viewings].sort((a, b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime())[0];
        return properties.find((property) => property.id === firstViewing?.propertyId) || null;
    }, [sourceProperty, properties, viewings]);


    const timelineItems = useMemo(() => {
        const taskItems = (tasks || []).map((task) => ({ ...task, type: 'task' as const }));
        const interactionItems = (contact?.interactionHistory || []).map((interaction) => ({
            ...interaction,
            type: 'interaction' as const,
        }));
        const combined = [...taskItems, ...interactionItems];

        return combined.sort((a, b) => {
            const dateA = new Date(a.type === 'task' ? a.dueDate : a.date);
            const dateB = new Date(b.type === 'task' ? b.dueDate : b.date);
            return dateB.getTime() - dateA.getTime();
        });
    }, [tasks, contact?.interactionHistory]);


    const isLoading = isContactLoading || isContextLoading || areAgentsLoading || areTasksLoading || arePropertiesLoading || areViewingsByIdLoading || areViewingsByNameLoading || isSourcePropertyLoading || areAllContactsLoading || areRecsLoading;

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
    
    const sanitizeForWhatsapp = (phone?: string | null) => {
        if (!phone) return '';
        let sanitized = phone.replace(/\D/g, '');
        if (sanitized.length === 10 && sanitized.startsWith('07')) {
            return `40${sanitized.substring(1)}`;
        }
        return sanitized;
    };

    return (
        <div className="agentfinder-lead-detail-page h-full flex flex-col">
             {/* Mobile View: Dark, app-like */}
            <div className='agentfinder-lead-detail-mobile lg:hidden -mt-6 pb-4'>
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
                             {contact.phone && (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button asChild variant='secondary' className="agentfinder-button-secondary bg-white/90 text-black hover:bg-white">
                                        <a href={`tel:${contact.phone}`}><Phone className='mr-2' /> Apel</a>
                                    </Button>
                                    <Button asChild variant='secondary' className="agentfinder-button-secondary bg-white/90 text-black hover:bg-white">
                                        <a href={`https://wa.me/${sanitizeForWhatsapp(contact.phone)}`} target="_blank" rel="noopener noreferrer"><WhatsappIcon className="mr-2 h-5 w-5" /> WhatsApp</a>
                                    </Button>
                                </div>
                             )}
                            <Button variant='secondary' className="agentfinder-button-tertiary bg-[#0B1319] text-white hover:bg-[#0B1319]/90 w-full" onClick={() => setIsEditingPreferences(true)}>
                                <Wand2 className='mr-2 h-4 w-4' /> Actualizare Preferinte
                            </Button>
                        </div>
                        <Button className='agentfinder-button-primary w-full bg-primary hover:bg-primary/90 text-white' onClick={() => setIsAddViewingOpen(true)}>Programează Vizionare</Button>
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
                        agency={agency}
                        contact={contact}
                    />

                    <ClientPortalManager contact={contact} agency={agency} />
                    <PreferencesFormCard contact={contact} agency={agency} />
                    
                    <div className="pt-2">
                        <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                    </div>

                    <div className="pt-4">
                      <SourcePropertyCard 
                          property={fallbackSourceProperty} 
                          isLoading={isSourcePropertyLoading}
                          allProperties={properties || []}
                          onUpdateContact={handleUpdateContact}
                      />
                    </div>
                    
                    <div className="pt-4">
                        <BuyerFinanceAndOffersCard
                            contact={contact}
                            onUpdateContact={handleUpdateContact}
                            recommendations={recommendations}
                            properties={properties}
                            portalId={contact.portalId || null}
                            onUpdateRecommendation={handleUpdateRecommendation}
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
                                        properties={properties || []}
                                        onToggleTask={handleToggleTask}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        </Card>
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <AccordionItem value="chat-history" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">
                                    Istoric Chat Preferințe
                                </AccordionTrigger>
                                <AccordionContent className="px-2 pb-2 pt-0">
                                    <PreferencesChatHistoryCard history={contact.preferencesChatHistory} />
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
            <div className="agentfinder-lead-detail-desktop hidden lg:block h-full pb-6 pt-5 px-6">
                 <LeadHeader 
                    contact={contact} 
                    onUpdateContact={handleUpdateContact}
                    onAddTask={handleAddTask}
                    onTriggerAddViewing={() => setIsAddViewingOpen(true)}
                    properties={properties || []}
                    onTriggerEditPreferences={() => setIsEditingPreferences(true)}
                 />
                 <main className="agentfinder-lead-detail-grid grid lg:grid-cols-12 gap-6 items-start mt-6">
                    <div className="agentfinder-lead-detail-sidebar lg:col-span-3 space-y-6">
                        <LeadInfoCard
                            contact={contact}
                            onEdit={() => setIsEditDialogOpen(true)}
                            onUpdateContact={handleUpdateContact}
                            sourceProperty={fallbackSourceProperty}
                            isSourcePropertyLoading={isSourcePropertyLoading}
                            allProperties={properties || []}
                            viewings={viewings}
                            tasks={tasks}
                            recommendations={recommendations}
                        />
                        <BuyerFinanceAndOffersCard
                            contact={contact}
                            onUpdateContact={handleUpdateContact}
                            recommendations={recommendations}
                            properties={properties}
                            portalId={contact.portalId || null}
                            onUpdateRecommendation={handleUpdateRecommendation}
                            onAddOffer={handleAddOffer}
                            onUpdateOffer={handleUpdateOffer}
                            onDeleteOffer={handleDeleteOffer}
                        />
                        <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []}
                            onAddInteraction={handleAddInteraction}
                            onAddTask={handleAddTask}
                            contacts={[contact]}
                            properties={properties || []}
                            onToggleTask={handleToggleTask}
                        />
                    </div>

                    <div className="agentfinder-lead-detail-content lg:col-span-9 space-y-6">
                        <MatchedProperties
                            properties={matchedProperties}
                            onAddRecommendation={handleAddRecommendation}
                            agency={agency}
                            contact={contact}
                        />
                        <ClientPortalManager contact={contact} agency={agency} />
                        <PreferencesFormCard contact={contact} agency={agency} />
                        <ScheduledViewingsCard viewings={scheduledViewings} />
                        <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                        <SimilarLeadsCard leads={similarCumparatori} />
                        <PreferencesChatHistoryCard history={contact.preferencesChatHistory} />
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
