
'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Agency, UserProfile } from '@/lib/types';
import {
    generateAgentPassword,
    generateAgentPasswordSuggestions,
    isValidManagedAgentPassword,
} from '@/lib/agent-passwords';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, RefreshCw, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgencyAgents } from '@/hooks/use-agency-agents';

const createAgentSchema = z.object({
    name: z.string().min(2, 'Numele agentului este obligatoriu.'),
    email: z.string().email('Adresa de email este invalidă.'),
    phone: z.string().optional(),
    password: z
        .string()
        .min(8, 'Parola trebuie să aibă cel puțin 8 caractere.')
        .max(10, 'Parola poate avea maximum 10 caractere.')
        .refine((value) => isValidManagedAgentPassword(value), {
            message: 'Parola trebuie să aibă 8-10 caractere, minimum 2 cifre și un caracter special.',
        }),
});

type AgentManagementCardProps = {
    agency: Agency;
    agents?: UserProfile[];
    isLoading?: boolean;
    onAgentCreated?: (agent: UserProfile) => void;
};

export function AgentManagementCard({ agency, agents: providedAgents, isLoading: providedIsLoading, onAgentCreated }: AgentManagementCardProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const shouldUseProvidedData = Array.isArray(providedAgents);
    const { agents: fetchedAgents, isLoading: fetchedAgentsLoading, error: fetchedAgentsError } = useAgencyAgents({ enabled: !shouldUseProvidedData });

    const [localAgents, setLocalAgents] = useState<UserProfile[]>([]);
    const [isCreatingAgent, setIsCreatingAgent] = useState(false);
    const [latestCredentials, setLatestCredentials] = useState<{ email: string; password: string } | null>(null);

    const form = useForm<z.infer<typeof createAgentSchema>>({
        resolver: zodResolver(createAgentSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            password: generateAgentPassword(),
        },
    });

    const watchedName = form.watch('name');
    const passwordSuggestions = generateAgentPasswordSuggestions(watchedName);
    const displayAgents = shouldUseProvidedData ? providedAgents : localAgents;
    const displayIsLoading = typeof providedIsLoading === 'boolean' ? providedIsLoading : fetchedAgentsLoading;
    
    useEffect(() => {
        if (shouldUseProvidedData) return;
        setLocalAgents(fetchedAgents);
    }, [fetchedAgents, shouldUseProvidedData]);

    useEffect(() => {
        if (shouldUseProvidedData || !fetchedAgentsError) return;

        console.error('Error fetching agent profiles:', fetchedAgentsError);
        toast({
            variant: 'destructive',
            title: 'Eroare la încărcare',
            description: fetchedAgentsError.message || 'Nu am putut încărca lista de agenți.',
        });
    }, [fetchedAgentsError, shouldUseProvidedData, toast]);

    function applyGeneratedPassword(nextPassword?: string) {
        form.setValue('password', nextPassword || generateAgentPassword(form.getValues('name')), {
            shouldDirty: true,
            shouldValidate: true,
        });
    }

    async function handleCreateAgent(values: z.infer<typeof createAgentSchema>) {
        if (!user) {
            toast({ variant: 'destructive', title: 'Eroare', description: 'Trebuie sa fii autentificat.' });
            return;
        }

        setIsCreatingAgent(true);
        try {
            const token = await user.getIdToken(true);
            const response = await fetch('/api/agency/agents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: values.name.trim(),
                    email: values.email.trim(),
                    phone: values.phone?.trim() || '',
                    password: values.password.trim(),
                }),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(payload?.message || 'Nu am putut crea contul agentului.');
            }

            setLocalAgents((current) => {
                const nextAgents = [...current.filter((agent) => agent.id !== payload.agent.id), payload.agent as UserProfile];
                return nextAgents.sort((left, right) => left.name.localeCompare(right.name, 'ro'));
            });
            onAgentCreated?.(payload.agent as UserProfile);
            setLatestCredentials(payload.credentials || null);
            toast({
                title: 'Agent creat',
                description: `${payload?.agent?.name || values.name} poate intra acum cu emailul și parola generate.`,
            });
            form.reset({
                name: '',
                email: '',
                phone: '',
                password: generateAgentPassword(),
            });

        } catch (error) {
            console.error('Failed to create agent:', error);
            toast({
                variant: 'destructive',
                title: 'Eroare la creare',
                description: error instanceof Error ? error.message : 'Nu am putut crea agentul. Încearcă din nou.',
            });
        } finally {
            setIsCreatingAgent(false);
        }
    }

    return (
        <Card className={cn("shadow-2xl rounded-2xl border border-white/10", "bg-[linear-gradient(180deg,_rgba(11,22,38,0.98)_0%,_rgba(8,18,32,1)_100%)] text-white")}>
            <CardHeader>
                <CardTitle className="text-3xl font-semibold tracking-tight text-white">Management Agenți</CardTitle>
                <CardDescription className="max-w-3xl text-base leading-7 text-white/70">
                    Creează direct conturi pentru agenții din cadrul agenției tale, fără să afectezi administratorul existent.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.04)_0%,_rgba(255,255,255,0.02)_100%)] p-5 md:p-6">
                    <div className="mb-5">
                        <h3 className="text-xl font-semibold text-white">Creează Agent Nou</h3>
                        <p className="mt-1 text-sm text-white/65">
                            Completează rapid datele esențiale și generează o parolă sigură pentru noul agent.
                        </p>
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleCreateAgent)} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white/80">Nume agent</FormLabel>
                                            <FormControl>
                                                <Input {...field} placeholder="Andrei Popescu" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white/80">Email</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="email" placeholder="andrei@agentie.ro" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white/80">Telefon</FormLabel>
                                            <FormControl>
                                                <Input {...field} type="tel" placeholder="+40 723 000 111" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,_rgba(255,255,255,0.035)_0%,_rgba(255,255,255,0.015)_100%)] p-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem className="flex-1">
                                                <FormLabel className="text-white/80">Parolă inițială</FormLabel>
                                                <FormControl>
                                                    <Input {...field} maxLength={10} placeholder="Sibiu27!" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => applyGeneratedPassword()}
                                        className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Generează alta
                                    </Button>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {passwordSuggestions.map((suggestion) => (
                                        <Button
                                            key={suggestion}
                                            type="button"
                                            variant="outline"
                                            onClick={() => applyGeneratedPassword(suggestion)}
                                            className="border-white/10 bg-transparent text-xs text-white/80 hover:bg-white/10"
                                        >
                                            {suggestion}
                                        </Button>
                                    ))}
                                </div>
                                <p className="mt-3 text-xs text-white/65">
                                    Parola este sugerată automat din denumiri de orașe și respectă regula 8-10 caractere, minimum 2 cifre și un caracter special.
                                </p>
                            </div>
                            {latestCredentials ? (
                                <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-50">
                                    <p>Email creat: {latestCredentials.email}</p>
                                    <p>Parolă inițială: {latestCredentials.password}</p>
                                    <p className="mt-2 text-xs text-emerald-100/80">
                                        Transmite aceste date agentului pe un canal sigur și recomandă-i să își schimbe parola după prima conectare.
                                    </p>
                                </div>
                            ) : null}
                            <Button type="submit" disabled={isCreatingAgent} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                {isCreatingAgent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                                Creează cont agent
                            </Button>
                        </form>
                    </Form>
                </div>
                <div>
                    <h3 className="mb-2 text-xl font-semibold text-white">Agenți existenți</h3>
                     <Table>
                        <TableHeader>
                            <TableRow className="border-white/20 hover:bg-white/10">
                                <TableHead className="text-white/80">Nume</TableHead>
                                <TableHead className="text-white/80">Email</TableHead>
                                <TableHead className="text-white/80">Rol</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayIsLoading ? (
                                [...Array(agency?.agentIds?.length || 1)].map((_, i) => (
                                    <TableRow key={i} className="border-white/20">
                                        <TableCell colSpan={3}><Skeleton className="h-10 w-full bg-white/20" /></TableCell>
                                    </TableRow>
                                ))
                            ) : displayAgents && displayAgents.length > 0 ? (
                                displayAgents.map(agent => (
                                    <TableRow key={agent.id} className="border-white/20 hover:bg-white/10">
                                        <TableCell className="text-white">{agent.name}</TableCell>
                                        <TableCell className="text-muted-foreground text-white/90">{agent.email}</TableCell>
                                        <TableCell><Badge variant={agent.role === 'admin' ? 'default' : 'secondary'} className={cn(agent.role !== 'admin' && 'bg-white/20 text-white border-none')}>{agent.role}</Badge></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-white/20">
                                    <TableCell colSpan={3} className="text-center text-white/70 h-24">
                                        Niciun agent în agenție. Creează unul mai sus.
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
