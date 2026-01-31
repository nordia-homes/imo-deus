'use client';
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUser, useFirestore, useAgency, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { generateContract } from '@/ai/flows/contract-generator';
import type { Property, Contact, Contract } from '@/lib/types';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FilePlus2, Sparkles } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const contractSchema = z.object({
  propertyId: z.string().min(1, 'Proprietatea este obligatorie.'),
  contactId: z.string().min(1, 'Clientul este obligatoriu.'),
  contractType: z.enum(['Vânzare-Cumpărare', 'Închiriere'], { required_error: 'Tipul contractului este obligatoriu.'}),
  price: z.coerce.number().positive('Prețul trebuie să fie pozitiv.'),
});

type GenerateContractDialogProps = {
    properties: Property[];
    contacts: Contact[];
}

export function GenerateContractDialog({ properties, contacts }: GenerateContractDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();
    const { user } = useUser();
    const { agency } = useAgency();
    const firestore = useFirestore();

    const form = useForm<z.infer<typeof contractSchema>>({
        resolver: zodResolver(contractSchema),
        defaultValues: {
            price: 0,
            contractType: 'Vânzare-Cumpărare',
        }
    });

    const selectedPropertyId = form.watch('propertyId');

    useEffect(() => {
        if (selectedPropertyId) {
            const property = properties.find(p => p.id === selectedPropertyId);
            if (property) {
                form.setValue('price', property.price);
                if(property.transactionType) {
                    const contractType = property.transactionType === 'Închiriere' ? 'Închiriere' : 'Vânzare-Cumpărare';
                    form.setValue('contractType', contractType);
                }
            }
        }
    }, [selectedPropertyId, properties, form]);

    const handleGenerateContract = async (values: z.infer<typeof contractSchema>) => {
        if (!user || !agency) {
            toast({ variant: 'destructive', title: 'Eroare', description: 'Utilizator sau agenție neidentificată.' });
            return;
        }

        setIsGenerating(true);
        toast({ title: 'Generare în curs...', description: 'AI-ul creează draft-ul contractului. Acest proces poate dura câteva momente.' });

        const property = properties.find(p => p.id === values.propertyId);
        const contact = contacts.find(c => c.id === values.contactId);

        if (!property || !contact) {
            toast({ variant: 'destructive', title: 'Eroare', description: 'Proprietate sau contact invalid.' });
            setIsGenerating(false);
            return;
        }

        try {
            const result = await generateContract({
                propertyTitle: property.title,
                contactName: contact.name,
                agentName: user.displayName || 'Agent',
                agencyName: agency.name,
                price: values.price,
                contractType: values.contractType,
            });
            
            const contractsCollection = collection(firestore, 'agencies', agency.id, 'contracts');

            const newContractData = {
                propertyId: property.id,
                propertyTitle: property.title,
                contactId: contact.id,
                contactName: contact.name,
                contractType: values.contractType,
                status: 'Draft',
                date: new Date().toISOString(),
                price: values.price,
                content: result.content,
                agentId: user.uid,
                agentName: user.displayName || user.email,
            };

            await addDocumentNonBlocking(contractsCollection, newContractData);

            toast({ title: 'Contract generat!', description: `Un nou draft a fost creat pentru ${contact.name}.` });
            setIsOpen(false);
            form.reset();
        } catch (error) {
            console.error('Contract generation failed:', error);
            toast({ variant: 'destructive', title: 'Generare eșuată', description: 'A apărut o eroare la generarea contractului.' });
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><FilePlus2 className="mr-2 h-4 w-4" /> Generează Contract AI</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                 <DialogHeader>
                    <DialogTitle>Generează Contract Nou</DialogTitle>
                    <DialogDescription>Selectează proprietatea, clientul și tipul contractului. AI-ul va genera textul legal.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleGenerateContract)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="propertyId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Proprietate</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selectează o proprietate..." /></SelectTrigger></FormControl>
                                        <SelectContent><ScrollArea className="h-48">
                                            {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                                        </ScrollArea></SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="contactId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Client (Lead)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Selectează un client..." /></SelectTrigger></FormControl>
                                        <SelectContent><ScrollArea className="h-48">
                                            {contacts.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </ScrollArea></SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="contractType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tip Contract</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="Vânzare-Cumpărare">Vânzare-Cumpărare</SelectItem>
                                                <SelectItem value="Închiriere">Închiriere</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="price"
                                render={({ field }) => (<FormItem><FormLabel>Preț final (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isGenerating}>Anulează</Button>
                            <Button type="submit" disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                Generează Contract
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
