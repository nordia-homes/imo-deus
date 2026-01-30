'use client';

import { useParams, notFound } from 'next/navigation';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, arrayUnion } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

import type { Contact, Property, Task, Interaction, UserProfile } from '@/lib/types';
import { leadScoring } from '@/ai/flows/lead-scoring';
import { propertyMatcher } from '@/ai/flows/property-matcher';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import Link from 'next/link';

// Icons
import { Phone, Mail, Euro, Info, MapPin, Sparkles, Wand2, Loader2, PlusCircle, CheckCircle, Edit, Trash2, User as UserIcon } from 'lucide-react';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';

import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { DeleteTaskAlert } from '@/components/tasks/DeleteTaskAlert';
import { AiEmailGenerator } from '@/components/leads/AiEmailGenerator';
import { InteractionList } from '@/components/leads/InteractionList';
import { InteractionLogger } from '@/components/leads/InteractionLogger';
import { useAgency } from '@/context/AgencyContext';

// Schemas for AI forms
const leadScoreSchema = z.object({
  engagementLevel: z.string().min(1, 'Engagement level is required.'),
  potentialValue: z.string().min(1, 'Potential value is required.'),
});

const propertyMatchSchema = z.object({
  desiredPriceRangeMin: z.coerce.number(),
  desiredPriceRangeMax: z.coerce.number(),
  desiredBedrooms: z.coerce.number(),
  desiredBathrooms: z.coerce.number(),
  desiredSquareFootageMin: z.coerce.number(),
  desiredSquareFootageMax: z.coerce.number(),
  desiredFeatures: z.string(),
  locationPreferences: z.string(),
});

type MatchedProperty = Property & { matchScore: number; reasoning: string };


function getPriorityBadgeVariant(priority: Contact['priority']) {
    switch (priority) {
        case 'Ridicată': return 'destructive';
        case 'Medie': return 'warning';
        case 'Scăzută': return 'secondary';
        default: return 'outline';
    }
}

// Main Component
export default function LeadDetailPage() {
    const params = useParams();
    const leadId = params.leadId as string;
    
    const { user, isUserLoading } = useUser();
    const { agencyId } = useAgency();
    const firestore = useFirestore();
    const { toast } = useToast();

    // --- DATA FETCHING ---
    const contactDocRef = useMemoFirebase(() => {
        if (!agencyId || !leadId) return null;
        return doc(firestore, 'agencies', agencyId, 'contacts', leadId);
    }, [firestore, agencyId, leadId]);

    const { data: contact, isLoading: isContactLoading, error: contactError } = useDoc<Contact>(contactDocRef);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId || !leadId) return null;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        return query(tasksCollection, where('contactId', '==', leadId));
    }, [firestore, agencyId, leadId]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);
    const { data: userProperties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const agentsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'users'), where('agencyId', '==', agencyId));
    }, [firestore, agencyId]);
    const { data: agents } = useCollection<UserProfile>(agentsQuery);


    // --- STATE MANAGEMENT ---
    const [notes, setNotes] = useState('');
    useEffect(() => {
        if (contact) {
            setNotes(contact.notes || '');
        }
    }, [contact]);
    
    // AI Forms and Results State
    const [isScoring, setIsScoring] = useState(false);
    const [scoreResult, setScoreResult] = useState<{ score: number, reason: string } | null>(null);
    const [isMatching, setIsMatching] = useState(false);
    const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [deletingTask, setDeletingTask] = useState<Task | null>(null);
    const [isLogging, setIsLogging] = useState(false);

    const leadScoreForm = useForm<z.infer<typeof leadScoreSchema>>({
        resolver: zodResolver(leadScoreSchema),
        defaultValues: { engagementLevel: 'medium', potentialValue: 'medium' },
      });
    
      const propertyMatchForm = useForm<z.infer<typeof propertyMatchSchema>>({
        resolver: zodResolver(propertyMatchSchema),
        defaultValues: contact?.preferences || {
          desiredPriceRangeMin: 100000,
          desiredPriceRangeMax: 500000,
          desiredBedrooms: 3,
          desiredBathrooms: 2,
          desiredSquareFootageMin: 70,
          desiredSquareFootageMax: 120,
          desiredFeatures: 'modern kitchen, backyard',
          locationPreferences: 'suburbs'
        },
    });

     // Reset property match form when contact data loads
    useEffect(() => {
        if (contact?.preferences) {
            propertyMatchForm.reset(contact.preferences);
        }
    }, [contact, propertyMatchForm]);


    // --- HANDLERS ---
    const handleSaveNotes = () => {
        if (!contactDocRef) return;
        updateDocumentNonBlocking(contactDocRef, { notes: notes });
        toast({
            title: "Notițe salvate!",
            description: "Modificările au fost salvate în baza de date.",
        });
    };

    const handleAgentChange = (agentId: string) => {
        if (!contactDocRef) return;
        const selectedAgent = agents?.find(a => a.id === agentId);
        updateDocumentNonBlocking(contactDocRef, { 
            agentId: agentId,
            agentName: selectedAgent?.name || null
        });
         toast({ title: 'Agent alocat!', description: `Lead-ul a fost alocat lui ${selectedAgent?.name}.` });
    }

    const handlePriorityChange = (priority: string) => {
        if (!contactDocRef) return;
        updateDocumentNonBlocking(contactDocRef, { priority });
        toast({ title: 'Prioritate actualizată!' });
    }

    const handleAddTask = (newTask: Omit<Task, 'id' | 'status'>) => {
        if (!agencyId || !contact) return;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        
        const taskToAdd = {
            ...newTask,
            contactId: leadId,
            contactName: contact.name,
            status: 'open',
        };

        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({
            title: "Task Adăugat!",
            description: `Task-ul "${newTask.description}" a fost adăugat pentru ${contact.name}.`
        });
    };
    
    const handleToggleTask = (task: Task) => {
        if (!agencyId) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', task.id);
        const newStatus = task.status === 'completed' ? 'open' : 'completed';
        updateDocumentNonBlocking(taskRef, { status: newStatus });
    };

    const handleUpdateTask = (updatedTask: Omit<Task, 'status'>) => {
        if (!agencyId || !editingTask) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', editingTask.id);
        const { id, ...dataToUpdate } = updatedTask;
        updateDocumentNonBlocking(taskRef, dataToUpdate);
        toast({
            title: "Task actualizat!",
            description: `Task-ul a fost actualizat.`,
        });
        setEditingTask(null);
    };

    const handleDeleteTask = () => {
        if (!agencyId || !deletingTask) return;
        const taskRef = doc(firestore, 'agencies', agencyId, 'tasks', deletingTask.id);
        deleteDocumentNonBlocking(taskRef);
        toast({
            variant: 'destructive',
            title: "Task șters!",
            description: `Task-ul a fost șters.`,
        });
        setDeletingTask(null);
    };
    
    const handleLogInteraction = (interaction: Omit<Interaction, 'id' | 'date'>) => {
        if (!contactDocRef) return;
        
        setIsLogging(true);

        const newInteraction: Interaction = {
            ...interaction,
            id: new Date().getTime().toString(),
            date: new Date().toISOString(),
        };

        updateDocumentNonBlocking(contactDocRef, {
            interactionHistory: arrayUnion(newInteraction)
        });
        
        toast({ title: 'Interacțiune adăugată!' });
        setIsLogging(false);
    };

    const allContactsForDialog = useMemo(() => {
        if (!contact) return [];
        return [{ id: contact.id, name: contact.name }];
    }, [contact]);

    async function onLeadScoreSubmit(values: z.infer<typeof leadScoreSchema>) {
        if(!contact) return;
        setIsScoring(true);
        setScoreResult(null);
        try {
          const result = await leadScoring({
            ...values,
            leadDetails: `Name: ${contact.name}, Status: ${contact.status}, Notes: ${contact.notes}`,
          });
          setScoreResult(result);
          if (contactDocRef && result.score) {
            updateDocumentNonBlocking(contactDocRef, { leadScore: result.score });
          }
          toast({ title: "Scor AI generat!", description: `Lead-ul a primit scorul ${result.score}.` });
        } catch (error) {
          console.error('Lead scoring failed', error);
          toast({ variant: "destructive", title: "A apărut o eroare", description: "Nu am putut genera scorul AI." });
        } finally {
          setIsScoring(false);
        }
    }
    
      async function onPropertyMatchSubmit(values: z.infer<typeof propertyMatchSchema>) {
        if (!userProperties) {
            toast({ variant: "destructive", title: "Nicio proprietate", description: "Nu ai nicio proprietate în portofoliu pentru a face potriviri."});
            return;
        }

        setIsMatching(true);
        setMatchedProperties([]);
        
        const matcherProperties = userProperties.map(p => ({
            ...p,
            image: p.imageUrl || 'https://placehold.co/400x300',
            bedrooms: p.bedrooms || 0,
            bathrooms: p.bathrooms || 0,
            squareFootage: p.squareFootage || 0,
            description: p.description || '',
            address: p.address || '',
            price: p.price || 0,
        }));

        try {
            const result = await propertyMatcher({
                clientPreferences: values,
                properties: matcherProperties
            });
            setMatchedProperties(result.matchedProperties as MatchedProperty[]);
        } catch (error) {
            console.error('Property matching failed:', error);
            toast({ variant: "destructive", title: "A apărut o eroare", description: "Nu am putut găsi proprietăți potrivite."});
        } finally {
            setIsMatching(false);
        }
    }

    const isLoading = isUserLoading || isContactLoading;

    // --- RENDER LOGIC ---
    if (isLoading) {
        return (
             <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="space-y-2"> <Skeleton className="h-8 w-48" /> <Skeleton className="h-6 w-24" /> </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="lg:col-span-2 h-96" />
                    <Skeleton className="lg:col-span-1 h-96" />
                </div>
            </div>
        );
    }

    if (contactError) {
        return <div className="text-center text-red-500">A apărut o eroare la încărcarea lead-ului. Este posibil să nu aveți permisiunea de a-l vizualiza.</div>;
    }

    if (!user || !contact) {
        notFound();
        return null;
    }

    return (
        <div className="space-y-6">
            {/* --- HEADER --- */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Avatar className="h-24 w-24 text-3xl">
                        <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold">{contact.name}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="mt-1">{contact.status}</Badge>
                            {contact.priority && <Badge variant={getPriorityBadgeVariant(contact.priority)}>{contact.priority}</Badge>}
                        </div>
                    </div>
                </div>
                <AddTaskDialog onAddTask={handleAddTask} contacts={allContactsForDialog} />
            </header>

            {/* --- DASHBOARD GRID --- */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* --- LEFT COLUMN --- */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle>Istoric Interacțiuni</CardTitle></CardHeader>
                        <CardContent>
                            <InteractionList interactions={contact.interactionHistory || []} />
                        </CardContent>
                        <CardFooter className="flex-col items-start gap-4 border-t pt-6">
                            <h3 className="font-semibold">Adaugă Interacțiune Nouă</h3>
                            <InteractionLogger onLogInteraction={handleLogInteraction} isLogging={isLogging} />
                        </CardFooter>
                    </Card>
                    
                    <AiEmailGenerator contact={contact} agent={user} />
                    <Card>
                        <CardHeader>
                            <CardTitle>Potrivire Proprietăți (AI)</CardTitle>
                            <CardDescription>Găsește proprietățile ideale pe baza preferințelor clientului.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <Form {...propertyMatchForm}>
                                <form onSubmit={propertyMatchForm.handleSubmit(onPropertyMatchSubmit)} className="space-y-4">
                                     <div className="flex gap-4">
                                        <FormField control={propertyMatchForm.control} name="desiredPriceRangeMin" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Preț Min (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                                        <FormField control={propertyMatchForm.control} name="desiredPriceRangeMax" render={({ field }) => ( <FormItem className="flex-1"><FormLabel>Preț Max (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem> )}/>
                                    </div>
                                    <FormField control={propertyMatchForm.control} name="locationPreferences" render={({ field }) => ( <FormItem><FormLabel>Locație Preferată</FormLabel><FormControl><Input {...field} /></FormControl></FormItem> )}/>
                                    <FormField control={propertyMatchForm.control} name="desiredFeatures" render={({ field }) => ( <FormItem><FormLabel>Caracteristici Dorite</FormLabel><FormControl><Textarea {...field} rows={2}/></FormControl></FormItem> )}/>
                                    <Button type="submit" className="w-full" disabled={isMatching}>
                                        {isMatching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                                        Găsește Potriviri
                                    </Button>
                                </form>
                            </Form>
                            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                               {isMatching && <p className="flex items-center text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Caut cele mai bune potriviri...</p>}
                               {!isMatching && matchedProperties.length === 0 && <p className="text-muted-foreground text-center pt-10">Nicio proprietate găsită. Rulează căutarea pentru a vedea rezultatele.</p>}
                                {matchedProperties.map(prop => (
                                    <Card key={prop.id} className="p-2">
                                        <div className="flex gap-4 items-center">
                                            <Image src={prop.imageUrl || 'https://placehold.co/400x300'} alt={prop.address || 'Proprietate'} width={120} height={80} className="rounded-md object-cover aspect-video" data-ai-hint={prop.imageHint} />
                                            <div className="flex-1">
                                                <Link href={`/properties/${prop.id}`} className="font-bold hover:underline text-sm">{prop.address}</Link>
                                                <p className="text-xs text-primary font-semibold">€{prop.price.toLocaleString()}</p>
                                                 <Card className="mt-2 bg-accent/50 text-xs">
                                                     <CardHeader className="p-2"><p className="font-semibold text-primary">Scor: {prop.matchScore}/100</p></CardHeader>
                                                     <CardContent className="p-2 pt-0"><p>{prop.reasoning}</p></CardContent>
                                                 </Card>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Task-uri Asociate</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {areTasksLoading ? ( <p>Se încarcă task-urile...</p> ) :
                             tasks && tasks.length > 0 ? (
                                <ul className="space-y-3">
                                    {tasks.map(task => (
                                        <li key={task.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 transition-colors hover:bg-muted">
                                             <div className="flex items-center gap-3">
                                                <Checkbox id={`task-${task.id}`} checked={task.status === 'completed'} onCheckedChange={() => handleToggleTask(task)} />
                                                 <div>
                                                     <label htmlFor={`task-${task.id}`} className="font-medium cursor-pointer">{task.description}</label>
                                                     <p className="text-sm text-muted-foreground">Scadent: {new Date(task.dueDate).toLocaleDateString('ro-RO')}</p>
                                                 </div>
                                             </div>
                                             <div className="flex gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => setEditingTask(task)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingTask(task)}>
                                                    <Trash2 className="h-4 w-4"/>
                                                </Button>
                                             </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-center py-4">Niciun task asociat cu acest lead.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* --- RIGHT COLUMN --- */}
                <div className="lg:col-span-1 space-y-6">
                     <Card>
                        <CardHeader><CardTitle>Management Lead</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Prioritate</Label>
                                <Select onValueChange={handlePriorityChange} defaultValue={contact.priority}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Scăzută">Scăzută</SelectItem>
                                        <SelectItem value="Medie">Medie</SelectItem>
                                        <SelectItem value="Ridicată">Ridicată</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                             <div>
                                <Label>Agent Alocat</Label>
                                <Select onValueChange={handleAgentChange} defaultValue={contact.agentId}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selectează un agent" />
                                    </SelectTrigger>
                                    <SelectContent>
                                         <SelectItem value="">Nealocat</SelectItem>
                                         {agents?.map(agent => (
                                            <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                         ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Informații Contact</CardTitle></CardHeader>
                        <CardContent className="space-y-4 text-sm">
                             <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground" /><span>{contact.phone || 'N/A'}</span></div>
                             <div className="flex items-center gap-3"><Mail className="h-4 w-4 text-muted-foreground" /><span>{contact.email || 'N/A'}</span></div>
                             <div className="flex items-center gap-3"><Info className="h-4 w-4 text-muted-foreground" /><span>Sursa: {contact.source || 'N/A'}</span></div>
                             <div className="flex items-center gap-3"><Euro className="h-4 w-4 text-muted-foreground" /><span>Buget: €{contact.budget?.toLocaleString() || 'N/A'}</span></div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Preferințe Locație</CardTitle></CardHeader>
                        <CardContent>
                           {contact.city ? ( <>
                                <div className="flex items-center gap-2 font-semibold mb-3"><MapPin className="h-5 w-5 text-primary" /><span>{contact.city}</span></div>
                                {contact.zones && contact.zones.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {contact.zones.map(zone => (<Badge key={zone} variant="secondary">{zone}</Badge>))}
                                    </div>
                                ) : (<p className="text-muted-foreground mt-2">Nicio zonă specifică.</p>)}
                            </> ) : (<p className="text-muted-foreground">Nicio preferință de locație.</p>)}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><CardTitle>Notițe</CardTitle></CardHeader>
                        <CardContent>
                            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} placeholder="Adaugă notițe aici..."/>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveNotes} className="w-full">Salvează Notițe</Button>
                        </CardFooter>
                    </Card>

                     <Card>
                        <CardHeader>
                            <CardTitle>Scor AI pentru Lead</CardTitle>
                        </CardHeader>
                        <Form {...leadScoreForm}>
                            <form onSubmit={leadScoreForm.handleSubmit(onLeadScoreSubmit)}>
                            <CardContent className="space-y-4">
                                <FormField control={leadScoreForm.control} name="engagementLevel" render={({ field }) => (<FormItem><FormLabel>Nivel Angajament</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="high">Ridicat</SelectItem><SelectItem value="medium">Mediu</SelectItem><SelectItem value="low">Scăzut</SelectItem></SelectContent></Select></FormItem>)}/>
                                <FormField control={leadScoreForm.control} name="potentialValue" render={({ field }) => (<FormItem><FormLabel>Valoare Potențială</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl><SelectContent><SelectItem value="high">Ridicat</SelectItem><SelectItem value="medium">Mediu</SelectItem><SelectItem value="low">Scăzut</SelectItem></SelectContent></Select></FormItem>)}/>
                            </CardContent>
                            <CardFooter>
                                <Button type="submit" disabled={isScoring} className="w-full">
                                {isScoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generează Scor
                                </Button>
                            </CardFooter>
                            </form>
                        </Form>
                        {scoreResult && (
                            <CardContent>
                                <Card className="bg-blue-50 border-blue-200"><CardHeader><CardTitle className="flex items-center gap-2 text-blue-800"><span>Scor: {scoreResult.score}/100</span></CardTitle></CardHeader><CardContent><p className="text-sm text-blue-700">{scoreResult.reason}</p></CardContent></Card>
                            </CardContent>
                        )}
                    </Card>
                </div>
            </div>

            <EditTaskDialog 
                isOpen={!!editingTask}
                onOpenChange={(isOpen) => !isOpen && setEditingTask(null)}
                task={editingTask}
                onUpdateTask={handleUpdateTask}
                contacts={allContactsForDialog}
            />
            <DeleteTaskAlert 
                isOpen={!!deletingTask}
                onOpenChange={(isOpen) => !isOpen && setDeletingTask(null)}
                task={deletingTask}
                onDelete={handleDeleteTask}
            />
        </div>
    );
}
