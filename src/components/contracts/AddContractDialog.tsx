"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from "date-fns";
import { ro } from "date-fns/locale";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, FilePlus2, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import type { Contract, Property, Contact as ContactType, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, addDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { generateContract } from '@/ai/flows/contract-generator';

const contractSchema = z.object({
  contactId: z.string().min(1, { message: "Clientul este obligatoriu." }),
  propertyId: z.string().min(1, { message: "Proprietatea este obligatorie." }),
  contractType: z.string().min(1, { message: "Tipul contractului este obligatoriu." }),
  price: z.coerce.number().positive({ message: "Prețul este obligatoriu." }),
  date: z.date({ required_error: "Data este obligatorie." }),
});

type AddContractDialogProps = {
    properties: Property[];
    contacts: ContactType[];
}

export function AddContractDialog({ properties, contacts }: AddContractDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  const form = useForm<z.infer<typeof contractSchema>>({
    resolver: zodResolver(contractSchema),
    defaultValues: {
      contractType: 'Vânzare-Cumpărare',
      date: new Date(),
    },
  });

  const onPropertySelect = (propertyId: string) => {
    const selectedProperty = properties.find(p => p.id === propertyId);
    if (selectedProperty) {
      form.setValue('price', selectedProperty.price);
      form.setValue('contractType', selectedProperty.transactionType);
    }
  };

  async function onSubmit(values: z.infer<typeof contractSchema>) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Autentificare necesară",
            description: "Trebuie să fii autentificat pentru a adăuga un contract.",
        });
        return;
    }
    
    setIsGenerating(true);

    const selectedContact = contacts.find(c => c.id === values.contactId);
    const selectedProperty = properties.find(p => p.id === values.propertyId);

    if (!selectedContact || !selectedProperty) {
         toast({ variant: "destructive", title: "Date lipsă", description: "Selectează un client și o proprietate."});
         setIsGenerating(false);
         return;
    }

    try {
        const agentName = userProfile?.name || user?.displayName || 'N/A';
        const agencyName = userProfile?.agencyName || 'Agenție Imobiliară';

        const contractResult = await generateContract({
            contactName: selectedContact.name,
            contactAddress: '_________________________', // Placeholder for client address
            agentName,
            agencyName,
            propertyAddress: selectedProperty.address,
            propertyDetails: `${selectedProperty.propertyType} cu ${selectedProperty.bedrooms} camere`,
            price: values.price,
            contractType: values.contractType as 'Vânzare-Cumpărare' | 'Închiriere',
            date: format(values.date, 'dd.MM.yyyy'),
        });

        const contractsCollection = collection(firestore, 'users', user.uid, 'contracts');
        
        const newContractData = {
            ...values,
            date: values.date.toISOString(),
            status: 'Draft',
            contactName: selectedContact?.name,
            propertyTitle: selectedProperty?.title,
            content: contractResult.content,
        };

        addDocumentNonBlocking(contractsCollection, newContractData);

        toast({
            title: "Contract generat!",
            description: `Un nou draft de contract a fost creat pentru ${selectedContact?.name}.`,
        });

        setIsOpen(false);
        form.reset();

    } catch (error) {
        console.error("Contract generation failed:", error);
        toast({
            variant: "destructive",
            title: "Generare eșuată",
            description: "A apărut o eroare la generarea conținutului contractului.",
        });
    } finally {
        setIsGenerating(false);
    }
  }
  
  const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) {
          form.reset();
      }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Generează Contract
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generează Contract Nou</DialogTitle>
          <DialogDescription>
            Selectează clientul și proprietatea pentru a crea un nou draft. Conținutul va fi generat de AI.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
              <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selectează un client" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contacts.map(contact => (
                            <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
             <FormField
                  control={form.control}
                  name="propertyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proprietate</FormLabel>
                      <Select onValueChange={(value) => { field.onChange(value); onPropertySelect(value); }} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selectează o proprietate" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {properties.map(property => (
                            <SelectItem key={property.id} value={property.id}>{property.title}</SelectItem>
                          ))}
                        </SelectContent>
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
                                <FormControl>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Vânzare-Cumpărare">Vânzare-Cumpărare</SelectItem>
                                    <SelectItem value="Închiriere">Închiriere</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Preț final (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
              </div>

               <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Data contractului</FormLabel>
                    <Popover modal={true}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: ro })
                            ) : (
                              <span>Alege o dată</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} disabled={isGenerating}>Anulează</Button>
              <Button type="submit" disabled={isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generează Draft
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
