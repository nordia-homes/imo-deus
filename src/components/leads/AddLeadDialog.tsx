"use client";

import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection, doc, getDoc } from 'firebase/firestore';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useAgency } from '@/context/AgencyContext';
import type { UserProfile, Property } from '@/lib/types';
import { locations, type City } from '@/lib/locations';
import { Card, CardContent } from '../ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const cumparatorSchema = z.object({
  name: z.string().min(1, { message: "Numele este obligatoriu." }),
  phone: z.string().min(1, { message: "Telefonul este obligatoriu." }),
  email: z.string().email({ message: "Adresă de email invalidă." }),
  source: z.string().min(1, { message: "Sursa este obligatorie." }),
  budget: z.coerce.number().positive({ message: "Bugetul trebuie să fie un număr pozitiv." }),
  status: z.string().min(1, { message: "Statusul este obligatoriu." }),
  description: z.string().optional(),
  city: z.string().min(1, { message: "Orașul este obligatoriu." }),
  priority: z.string().min(1, { message: "Prioritatea este obligatorie." }),
  agentId: z.string().optional(),
  sourcePropertyId: z.string().optional(),
});

export function AddLeadDialog({ properties, children }: { properties: Property[], children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useUser();
  const { agency } = useAgency();
  const firestore = useFirestore();
  const [agents, setAgents] = useState<UserProfile[]>([]);
  const isMobile = useIsMobile();
  const formKey = useMemo(() => {
    return isOpen ? `new-lead-${Date.now()}` : 'closed';
  }, [isOpen]);

  useEffect(() => {
      if (!isOpen || !agency || !agency.agentIds) {
          setAgents([]);
          return;
      }
      
      const fetchAgents = async () => {
          try {
              const agentPromises = agency.agentIds!.map(id => getDoc(doc(firestore, 'users', id)));
              const agentDocs = await Promise.all(agentPromises);
              const agentProfiles = agentDocs
                  .filter(docSnap => docSnap.exists())
                  .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
              setAgents(agentProfiles);
          } catch (error) {
              console.error("Error fetching agent profiles for dialog:", error);
          }
      };

      fetchAgents();
  }, [isOpen, agency, firestore]);

  const form = useForm<z.infer<typeof cumparatorSchema>>({
    resolver: zodResolver(cumparatorSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      source: '',
      budget: 0,
      status: 'Nou',
      description: '',
      city: '',
      priority: 'Medie',
      agentId: 'unassigned',
      sourcePropertyId: 'none',
    },
  });

  const watchedCity = form.watch('city') as City;

  useEffect(() => {
    setSelectedZones([]);
  }, [watchedCity]);

  function onSubmit(values: z.infer<typeof cumparatorSchema>) {
    if (!user || !agency?.id) {
        toast({
            variant: "destructive",
            title: "Eroare",
            description: "Nu am putut identifica agenția. Reîncearcă.",
        });
        return;
    }

    const contactsCollection = collection(firestore, 'agencies', agency.id, 'contacts');
    
    const isUnassigned = !values.agentId || values.agentId === 'unassigned';
    const finalAgentId = isUnassigned ? null : values.agentId;
    const selectedAgent = agents?.find(agent => agent.id === finalAgentId);

    const newCumparatorData = {
        ...values,
        agentId: finalAgentId,
        zones: selectedZones,
        contactType: 'Cumparator' as const,
        createdAt: new Date().toISOString(),
        interactionHistory: [],
        preferences: {
            desiredPriceRangeMin: values.budget > 0 ? Math.round(values.budget * 0.8) : 0,
            desiredPriceRangeMax: values.budget > 0 ? Math.round(values.budget * 1.2) : 0,
            desiredBedrooms: 0,
            desiredBathrooms: 0,
            desiredSquareFootageMin: 0,
            desiredSquareFootageMax: 0,
            desiredFeatures: '',
            locationPreferences: values.city || ''
        },
        agentName: selectedAgent?.name || null,
        sourcePropertyId: values.sourcePropertyId === 'none' ? null : values.sourcePropertyId,
    };

    addDocumentNonBlocking(contactsCollection, newCumparatorData);

    toast({
        title: "Cumpărător adăugat!",
        description: `${values.name} a fost adăugat în lista ta de cumpărători.`,
    });

    setIsOpen(false);
    form.reset();
    setSelectedZones([]);
  }
  
  const handleOpenChange = (open: boolean) => {
      setIsOpen(open);
      if (!open) {
          form.reset();
          setSelectedZones([]);
      }
  }

  const handleZoneToggle = (zone: string, checked: boolean) => {
    if (checked) {
      setSelectedZones((prev) => [...prev, zone]);
    } else {
      setSelectedZones((prev) => prev.filter((z) => z !== zone));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Cumpărător</Button>}
      </DialogTrigger>
      <DialogContent className={cn("p-0 flex flex-col", isMobile ? "h-screen w-screen max-w-full rounded-none border-none" : "sm:max-w-3xl h-[90vh]")}>
        <DialogHeader className="shrink-0 border-b p-2 h-14 flex items-center justify-center shadow-md z-10 relative bg-background">
          <DialogTitle className="text-xl text-foreground/90 text-center">Adaugă Cumpărător Nou</DialogTitle>
        </DialogHeader>

        {isOpen && (
            <Form {...form}>
            <form key={formKey} onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-6">
                    
                    <Card className="shadow-xl rounded-2xl">
                        <CardContent className="pt-6 space-y-4">
                            <h3 className="text-lg font-semibold text-primary">Detalii Contact</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume</FormLabel><FormControl><Input {...field} placeholder="Ion Popescu" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input {...field} placeholder="0712 345 678"/></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} placeholder="ion.popescu@email.com" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField
                                    control={form.control}
                                    name="source"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Sursă</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Selectează sursa" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            <SelectItem value="Website">Website</SelectItem>
                                            <SelectItem value="Recomandare">Recomandare</SelectItem>
                                            <SelectItem value="Portal Imobiliar">Portal Imobiliar</SelectItem>
                                            <SelectItem value="Telefon">Telefon</SelectItem>
                                            <SelectItem value="Altul">Altul</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Card className="shadow-xl rounded-2xl">
                        <CardContent className="pt-6 space-y-4">
                            <h3 className="text-lg font-semibold text-primary">Detalii Căutare</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField control={form.control} name="budget" render={({ field }) => ( <FormItem><FormLabel>Buget (€)</FormLabel><FormControl><Input type="number" {...field} placeholder="150000" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger><SelectValue placeholder="Selectează statusul" /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            <SelectItem value="Nou">Nou</SelectItem>
                                            <SelectItem value="Contactat">Contactat</SelectItem>
                                            <SelectItem value="Vizionare">Vizionare</SelectItem>
                                            <SelectItem value="În negociere">În negociere</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                                <FormField
                                    control={form.control}
                                    name="priority"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Prioritate</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                            <SelectItem value="Scăzută">Scăzută</SelectItem>
                                            <SelectItem value="Medie">Medie</SelectItem>
                                            <SelectItem value="Ridicată">Ridicată</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                        </FormItem>
                                    )}
                                    />
                            </div>
                        </CardContent>
                    </Card>

                     <Card className="shadow-xl rounded-2xl">
                        <CardContent className="pt-6 space-y-4">
                            <h3 className="text-lg font-semibold text-primary">Locație</h3>
                            <FormField
                                control={form.control}
                                name="city"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Oraș de interes</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Selectează orașul" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        {Object.keys(locations).map(city => (
                                            <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                                />
                                
                                {watchedCity && locations[watchedCity] && (
                                <div className="space-y-2">
                                        <Label>Zone de interes</Label>
                                        <div className="max-h-60 overflow-y-auto rounded-md border p-4">
                                            <div className="flex flex-wrap gap-x-6 gap-y-2">
                                                {locations[watchedCity].sort().map((zone) => (
                                                    <div key={zone} className="flex items-center gap-2">
                                                        <Checkbox
                                                            id={`zone-${zone}`}
                                                            checked={selectedZones.includes(zone)}
                                                            onCheckedChange={(checked) => {
                                                                handleZoneToggle(zone, !!checked);
                                                            }}
                                                        />
                                                        <Label
                                                            htmlFor={`zone-${zone}`}
                                                            className="font-normal cursor-pointer"
                                                        >
                                                            {zone}
                                                        </Label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                    
                    <Card className="shadow-xl rounded-2xl">
                        <CardContent className="pt-6 space-y-4">
                             <h3 className="text-lg font-semibold text-primary">Asociere (Opțional)</h3>
                            <FormField
                                control={form.control}
                                name="sourcePropertyId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Proprietate de Interes</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selectează proprietatea care a generat cumpărătorul" />
                                        </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        <SelectItem value="none">Niciuna</SelectItem>
                                        {properties?.map(prop => (
                                            <SelectItem key={prop.id} value={prop.id}>
                                            {prop.title}
                                            </SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        Asociază cumpărătorul cu anunțul de pe care a venit.
                                    </FormDescription>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="agentId"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Alocă Agent</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Selectează un agent" /></SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                        <SelectItem value="unassigned">Nealocat</SelectItem>
                                        {agents?.map(agent => (
                                            <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                        ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                     </Card>

                    <Card className="shadow-xl rounded-2xl">
                        <CardContent className="pt-6 space-y-4">
                            <h3 className="text-lg font-semibold text-primary">Descriere</h3>
                            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descriere Cumpărător</FormLabel><FormControl><Textarea rows={3} {...field} placeholder="Adaugă o descriere completă a cumpărătorului, preferințe, cerințe speciale, etc." /></FormControl><FormMessage /></FormItem> )} />
                        </CardContent>
                    </Card>
                </div>

                <DialogFooter className="shrink-0 border-t bg-background p-3 md:py-3 md:px-6 shadow-md">
                    <div className="flex justify-end gap-2 w-full">
                        <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Anulează</Button>
                        <Button type="submit">Salvează Cumpărător</Button>
                    </div>
                </DialogFooter>
            </form>
            </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
