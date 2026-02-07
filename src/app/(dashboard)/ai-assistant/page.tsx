
'use client';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useFirestore, useCollection, useMemoFirebase, addDocumentNonBlocking } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { generateBriefing } from '@/ai/flows/briefing-generator';
import { chat, type Message } from '@/ai/flows/chat';
import { useToast } from '@/hooks/use-toast';

import type { Contact, Property, Viewing, Briefing } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Bot, Camera, Check, Clock, Eye, Loader2, Send, User } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Helper to get initials from a name
const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

// The main component for the AI Assistant page
export default function AiAssistantPage() {
  const { agencyId, agency, userProfile, user } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();

  // --- Data Fetching ---
  const contactsQuery = useMemoFirebase(() => agencyId ? query(collection(firestore, 'agencies', agencyId, 'contacts'), orderBy('createdAt', 'desc')) : null, [firestore, agencyId]);
  const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

  const propertiesQuery = useMemoFirebase(() => agencyId ? query(collection(firestore, 'agencies', agencyId, 'properties')) : null, [firestore, agencyId]);
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

  const viewingsQuery = useMemoFirebase(() => agencyId ? query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'desc')) : null, [firestore, agencyId]);
  const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLoading = areContactsLoading || arePropertiesLoading || areViewingsLoading;

  useEffect(() => {
    // Only run when data is loaded
    if (!isLoading && contacts && properties && viewings) {
      setBriefing(null); // Reset previous briefing
      setError(null);
      generateBriefing({ contacts, properties, viewings })
        .then(setBriefing)
        .catch(err => {
          console.error("Error generating briefing:", err);
          setError("Asistentul AI nu a putut genera sumarul. Vă rugăm să reîncărcați pagina sau să încercați mai târziu.");
        });
    }
  }, [isLoading, contacts, properties, viewings]);

  // --- Chat State & Logic ---
  const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string; }[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
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
        agentName: userProfile?.name || user.displayName || user.email || 'Nespecificat',
        createdAt: new Date().toISOString(),
    };
    
    addDocumentNonBlocking(collection(firestore, `agencies/${agencyId}/viewings`), viewingToAdd);

    toast({ title: 'Vizionare programată!', description: 'Vizionarea a fost adăugată în calendar.' });
  };


  const handleSend = async () => {
    if (!input.trim()) return;

    const currentInput = input;
    const userMessage = { role: 'user' as const, text: currentInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setChatLoading(true);

    try {
        const history: Message[] = messages.map(msg => ({
            role: msg.role,
            content: [{ text: msg.text }]
        }));

        const result = await chat({
            history: history,
            prompt: currentInput,
            contacts: contacts || [],
            properties: properties || [],
            viewings: viewings || [],
            agency,
            user: userProfile,
        });

        const aiMessage = { role: 'model' as const, text: result.response };
        setMessages(prev => [...prev, aiMessage]);

        // Post-processing for actions
        const actionRegex = /\[ACTION:scheduleViewing\]([\s\S]*?)\[\/ACTION\]/;
        const match = result.response.match(actionRegex);

        if (match && match[1]) {
            try {
                const params = JSON.parse(match[1]);
                const property = properties?.find(p => p.title === params.propertyTitle);
                const contact = contacts?.find(c => c.name === params.contactName);

                if (property && contact) {
                    handleAddViewing({
                        propertyId: property.id,
                        contactId: contact.id,
                        contactName: contact.name,
                        viewingDate: params.isoDateTime,
                        notes: `Programat de Asistentul AI.`,
                    });
                } else {
                     toast({ variant: 'destructive', title: 'Nu am putut programa', description: 'Proprietatea sau contactul nu au fost găsite în CRM.' });
                }
            } catch (e) {
                console.error("Failed to parse or execute AI action", e);
                toast({ variant: 'destructive', title: 'Eroare acțiune AI', description: 'Am primit o comandă invalidă de la asistent.' });
            }
        }

    } catch (error) {
        console.error("AI chat failed", error);
        toast({
            variant: "destructive",
            title: "A apărut o eroare",
            description: "Nu am putut comunica cu asistentul AI. Încearcă din nou.",
        });
        setMessages(prev => prev.filter(m => m !== userMessage));
    } finally {
        setChatLoading(false);
    }
  };


  useEffect(() => {
    chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  // --- Render Functions for different sections ---

  const renderSummary = () => {
    if (!briefing && !error) return <Card className="p-4 grid grid-cols-4 gap-4"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></Card>;
    if (error) return null;
    return (
      <Card className="p-2 shadow-2xl rounded-2xl bg-[#f8f8f9]">
        <CardContent className="p-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {briefing?.summary.map(item => (
                    <div key={item.label} className="p-3 rounded-lg text-center bg-card border">
                        <p className="text-3xl font-bold">{item.value}</p>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
    );
  };
  
  const renderPriorities = () => {
    if (!briefing && !error) return <Card className="p-6"><Skeleton className="h-6 w-1/3 mb-4" /><div className="space-y-3"><Skeleton className="h-5 w-full" /><Skeleton className="h-5 w-4/5" /><Skeleton className="h-5 w-full" /></div></Card>;
    if (error) return null;
    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader>
                <CardTitle>Prioritățile tale azi</CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {briefing?.priorities.map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <Check className="h-4 w-4" />
                            </div>
                            <span className="font-medium">{item.text}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
  };

  const renderUpcomingViewings = () => {
    if (!briefing && !error) return <Card className="p-6"><Skeleton className="h-6 w-1/3 mb-4" /><div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></Card>;
    if (error) return null;
    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader>
                <CardTitle>Vizionări Programate Astăzi</CardTitle>
            </CardHeader>
            <CardContent>
                {briefing?.upcomingViewings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nicio vizionare azi. Bucură-te de timp liber!</p>
                ) : (
                    <div className="space-y-2">
                        {briefing?.upcomingViewings.map(v => (
                            <div key={v.id} className="flex items-center justify-between p-2 rounded-md border">
                                <div>
                                    <p className="font-semibold text-sm">{v.title}</p>
                                    <p className="text-xs text-muted-foreground">cu {v.contact}</p>
                                </div>
                                <div className="font-bold text-sm flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {v.time}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
  }

  const renderUrgentClients = () => {
    if (!briefing && !error) return <Card className="p-6"><Skeleton className="h-6 w-1/3 mb-4" /><div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></Card>;
    if (error) return null;
    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader>
                <CardTitle>Clienți de Urgență</CardTitle>
                <CardDescription>{briefing?.urgentClientsAnalysis}</CardDescription>
            </CardHeader>
            <CardContent>
                {briefing?.urgentClients.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Niciun client nu necesită atenție urgentă.</p>
                ) : (
                    <div className="space-y-3">
                        {briefing?.urgentClients.map(c => (
                            <div key={c.id} className="flex items-center gap-3 p-2 border rounded-md">
                                <Avatar>
                                    <AvatarImage src={c.avatar || `https://i.pravatar.cc/150?u=${c.id}`} />
                                    <AvatarFallback>{getInitials(c.name)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm">{c.name}</p>
                                    <p className="text-xs text-destructive">{c.reason}</p>
                                </div>
                                <Button asChild size="sm" variant="ghost">
                                    <Link href={`/leads/${c.id}`}><ArrowRight/></Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
  };
  
  const renderPropertiesToOptimize = () => {
    if (!briefing && !error) return <Card className="p-6"><Skeleton className="h-6 w-1/3 mb-4" /><div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div></Card>;
    if (error) return null;
    return (
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader>
                <CardTitle>Proprietăți de Optimizat</CardTitle>
                <CardDescription>{briefing?.propertiesToReviewAnalysis}</CardDescription>
            </CardHeader>
            <CardContent>
                {briefing?.propertiesToOptimize.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Toate proprietățile sunt optimizate.</p>
                ) : (
                    <div className="space-y-3">
                        {briefing?.propertiesToOptimize.map(p => (
                             <div key={p.id} className="flex items-center gap-3 p-2 border rounded-md">
                                <div className="relative h-12 w-12 shrink-0">
                                    <Image src={p.image || `https://picsum.photos/seed/${p.id}/200`} alt={p.name} fill sizes="48px" className="rounded-md object-cover" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold text-sm truncate">{p.name}</p>
                                    <p className="text-xs text-destructive flex items-center gap-1"><Camera className="h-3 w-3" />{p.reason}</p>
                                </div>
                                <Button asChild size="sm" variant="ghost">
                                    <Link href={`/properties/${p.id}`}><ArrowRight/></Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
  };


  return (
    <div className="space-y-6">
        {error && (
            <Alert variant="destructive">
                <AlertTitle>Eroare la generarea briefing-ului</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )}
        {renderSummary()}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderPriorities()}
            {renderUpcomingViewings()}
        </div>
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {renderUrgentClients()}
            {renderPropertiesToOptimize()}
        </div>
        <Card className="shadow-2xl rounded-2xl">
            <CardHeader>
                <CardTitle>Chat Rapid</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4 pr-4">
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex items-start gap-4 ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                            {msg.role === 'model' && <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>}
                            <div className={`prose prose-sm max-w-full rounded-lg p-4 shadow-sm lg:prose-base dark:prose-invert ${msg.role === 'model' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                                <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                            </div>
                            {msg.role === 'user' && <div className="p-2 rounded-full bg-secondary"><User className="h-5 w-5" /></div>}
                        </div>
                    ))}
                    {chatLoading && (
                        <div className="flex items-start gap-4 justify-start">
                            <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
                            <div className="p-4 rounded-lg max-w-2xl shadow-sm bg-muted">
                                <div className="flex items-center gap-2">
                                <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                                <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatContainerRef} />
                </div>
                 <div className="relative">
                    <Input
                        placeholder="Ai o întrebare rapidă? Scrie aici..."
                        className="pr-12 h-12"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleSend()}
                        disabled={chatLoading}
                    />
                    <Button size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={handleSend} disabled={chatLoading}>
                         {chatLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
