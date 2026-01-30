'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, query, where } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserPlus } from 'lucide-react';
import { useAgency } from '@/context/AgencyContext';

const inviteSchema = z.object({
    email: z.string().email('Adresa de email este invalidă.'),
});

export function AgentManagementCard({ agencyId }: { agencyId: string }) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const { userProfile: adminProfile } = useAgency();

    const [isInviting, setIsInviting] = useState(false);

    const form = useForm<z.infer<typeof inviteSchema>>({
        resolver: zodResolver(inviteSchema),
        defaultValues: { email: '' },
    });

    const agentsQuery = useMemoFirebase(() => {
        return query(collection(firestore, 'users'), where('agencyId', '==', agencyId));
    }, [firestore, agencyId]);

    const { data: agents, isLoading } = useCollection<UserProfile>(agentsQuery);

    async function handleInviteAgent(values: z.infer<typeof inviteSchema>) {
        if (!user || !adminProfile?.agencyName) {
            toast({ variant: 'destructive', title: 'Eroare', description: 'Numele agenției nu a putut fi găsit.' });
            return;
        }

        setIsInviting(true);
        try {
            // Use btoa to create a filesystem-safe ID from the email
            const inviteId = btoa(values.email);
            const inviteRef = doc(firestore, 'invites', inviteId);
            
            await setDocumentNonBlocking(inviteRef, {
                email: values.email,
                agencyId: agencyId,
                agencyName: adminProfile.agencyName,
                role: 'agent',
                invitedBy: user.uid,
            }, {});

            toast({
                title: 'Invitație trimisă!',
                description: `${values.email} a fost invitat să se alăture agenției. Trebuie să se înregistreze cu acest email.`,
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
                                <TableRow>
                                    <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
                                </TableRow>
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
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">Niciun agent în agenție.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
    