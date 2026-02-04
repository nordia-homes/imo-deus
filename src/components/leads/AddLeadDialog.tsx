"use client";

import { useState, useEffect } from 'react';
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

const leadSchema = z.object({
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

export function AddLeadDialog({ properties }: { properties: Property[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useUser();
  const { agency } = useAgency();
  const firestore = useFirestore();
  const [agents, setAgents] = useState<UserProfile[]>([]);

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

  const form = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
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

  function onSubmit(values: z.infer<typeof leadSchema>) {
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

    const newLeadData = {
        ...values,
        agentId: finalAgentId,
        zones: selectedZones,
        contactType: 'Lead' as const,
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

    addDocumentNonBlocking(contactsCollection, newLeadData);

    toast({
        title: "Lead adăugat!",
        description: `${values.name} a fost adăugat în lista ta de lead-uri.`,
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
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adaugă Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adaugă Lead Nou</DialogTitle>
          <DialogDescription>
            Completează informațiile despre noul potențial client.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] p-1">
                <div className="space-y-4 px-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Nume</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="phone" render={({ field }) => ( <FormItem><FormLabel>Telefon</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
                    
                    <Card>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <FormField control={form.control} name="budget" render={({ field }) => ( <FormItem><FormLabel>Buget (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
                    
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="sourcePropertyId"
                                    render={({ field }) => (
                                        <FormItem>
                                        <FormLabel>Proprietate de Interes (Opțional)</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selectează proprietatea care a generat lead-ul" />
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
                                            Asociază lead-ul cu anunțul de pe care a venit.
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
                                        <FormLabel>Alocă Agent (Opțional)</FormLabel>
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
                            </div>
                        </CardContent>
                     </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-4">
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
                                                {locations[watchedCity].map((zone) => (
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
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Descriere Lead</FormLabel><FormControl><Textarea rows={3} {...field} placeholder="Adaugă o descriere completă a lead-ului, preferințe, cerințe speciale, etc." /></FormControl><FormMessage /></FormItem> )} />
                        </CardContent>
                    </Card>
                </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Anulează</Button>
              <Button type="submit">Salvează Lead</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

    