'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, setDocumentNonBlocking, useUser } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { Agency, UserProfile } from '@/lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserPlus } from 'lucide-react';

const inviteSchema = z.object({
    email: z.string().email('Adresa de email este invalidă.'),
});

export function AgentManagementCard({ agency }: { agency: Agency }) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isInviting, setIsInviting] = useState(false);

    const form = useForm<z.infer<typeof inviteSchema>>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { email: '' },
    });
    
    useEffect(() => {
        if (!agency.agentIds || agency.agentIds.length === 0) {
            setAgents([]);
            setIsLoading(false);
            return;
        }

        const fetchAgents = async () => {
            setIsLoading(true);
            try {
                // Perform individual 'get' requests for each agent ID.
                // This is secure and works with Firestore security rules.
                const agentPromises = agency.agentIds!.map(id => getDoc(doc(firestore, 'users', id)));
                const agentDocs = await Promise.all(agentPromises);
                const agentProfiles = agentDocs
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
                setAgents(agentProfiles);
            } catch (error) {
                console.error("Error fetching agent profiles:", error);
                toast({ variant: 'destructive', title: 'Eroare la încărcare', description: 'Nu am putut încărca lista de agenți.' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchAgents();
    }, [agency.agentIds, firestore, toast]);

    async function handleInviteAgent(values: z.infer<typeof inviteSchema>) {
        if (!user) {
            toast({ variant: 'destructive', title: 'Eroare', description: 'Trebuie sa fii autentificat.' });
            return;
        }

        setIsInviting(true);
        try {
            const inviteId = btoa(values.email);
            const inviteRef = doc(firestore, 'invites', inviteId);
            
            await setDocumentNonBlocking(inviteRef, {
                email: values.email,
                agencyId: agency.id,
                agencyName: agency.name,
                role: 'agent',
                invitedBy: user.uid,
            });

            toast({
                title: 'Invitație trimisă!',
                description: `${values.email} a fost invitat. Acum trebuie să se înregistreze cu acest email.`,
            });
            form.reset();

        } catch (error) {
            console.error('Failed to send invite:', error);
            toast({
                variant: 'destructive',
                title: 'Eroare la invitare',
                description: 'Nu am putut trimite invitația. Încearcă din nou.',
            });
        } finally {
            setIsInviting(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Management Agenți</CardTitle>
                <CardDescription>Invită și gestionează agenții din cadrul agenției tale.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <h3 className="font-semibold mb-2">Invită Agent Nou</h3>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleInviteAgent)} className="flex items-start gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormLabel className="sr-only">Email</FormLabel>
                                        <FormControl>
                                            <Input {...field} type="email" placeholder="email@agent.ro" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" disabled={isInviting}>
                                {isInviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                Invită
                            </Button>
                        </form>
                    </Form>
                </div>
                <div>
                    <h3 className="font-semibold mb-2">Agenți existenți</h3>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nume</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Rol</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                [...Array(agency?.agentIds?.length || 1)].map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : agents && agents.length > 0 ? (
                                agents.map(agent => (
                                    <TableRow key={agent.id}>
                                        <TableCell>{agent.name}</TableCell>
                                        <TableCell>{agent.email}</TableCell>
                                        <TableCell><Badge variant={agent.role === 'admin' ? 'default' : 'secondary'}>{agent.role}</Badge></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground h-24">
                                        Niciun agent în agenție. Invită unul mai sus.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
