
"use client";

import { useState } from 'react';
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
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle, ChevronsUpDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Separator } from '../ui/separator';

const leadSchema = z.object({
  name: z.string().min(1, { message: "Numele este obligatoriu." }),
  phone: z.string().min(1, { message: "Telefonul este obligatoriu." }),
  email: z.string().email({ message: "Adresă de email invalidă." }),
  source: z.string().min(1, { message: "Sursa este obligatorie." }),
  budget: z.coerce.number().positive({ message: "Bugetul trebuie să fie un număr pozitiv." }),
  status: z.string().min(1, { message: "Statusul este obligatoriu." }),
  notes: z.string().optional(),
  city: z.string().min(1, { message: "Orașul este obligatoriu." }),
  zones: z.array(z.string()).default([]),
});

const locations = {
    'Bucuresti-Ilfov': [
        // Sector 1
        '1 Mai', 'Aviatorilor', 'Aviatiei', 'Baneasa', 'Bucurestii Noi', 'Damaroaia', 'Domenii', 'Dorobanti', 'Gara de Nord', 'Grivita', 'Pajura', 'Piata Romana', 'Piata Victoriei', 'Pipera', 'Primaverii', 'Herastrau', 'Floreasca', 'Chitila',
        // Sector 2
        'Andronache', 'Baicului', 'Colentina', 'Doamna Ghica', 'Fundeni', 'Iancului', 'Mosilor', 'Obor', 'Pantelimon (sector)', 'Piata Muncii', 'Stefan cel Mare', 'Tei', 'Vatra Luminoasa',
        // Sector 3
        'Balta Alba', 'Centrul Civic', 'Dristor', 'Dudesti', 'Mihai Bravu', 'Salajan', 'Titan', 'Unirii', 'Vitan', 'Timpuri Noi',
        // Sector 4
        'Aparatorii Patriei', 'Berceni', 'Brancoveanu', 'Giurgiului', 'Oltenitei', 'Piata Sudului', 'Tineretului', 'Vacaresti',
        // Sector 5
        '13 Septembrie', 'Cotroceni', 'Dealul Spirii', 'Ferentari', 'Ghencea', 'Panduri', 'Rahova', 'Salaj',
        // Sector 6
        'Compozitorilor', 'Crangasi', 'Drumul Taberei', 'Giulesti', 'Militari', 'Lujerului', 'Pacea', 'Regie', 'Uverturii',
        // Ilfov
        'Afumati', 'Balotesti', 'Bragadiru', 'Buftea', 'Cernica', 'Chiajna', 'Chitila', 'Ciolpani', 'Ciorogarla', 'Clinceni', 'Corbeanca', 'Cornetu', 'Darasti', 'Dascalu', 'Dobroesti', 'Domnesti', 'Dragomiresti-Vale', 'Glina', 'Gradistea', 'Gruiu', 'Jilava', 'Magurele', 'Moara Vlasiei', 'Mogosoaia', 'Nuci', 'Otopeni', 'Pantelimon (oras)', 'Petrachioaia', 'Popesti-Leordeni', 'Snagov', 'Stefanestii de Jos', 'Tunari', 'Vidra', 'Voluntari'
    ],
    'Cluj-Napoca': ['Andrei Muresanu', 'Borhanci', 'Buna Ziua', 'Centru', 'Dambul Rotund', 'Gheorgheni', 'Grigorescu', 'Gruia', 'Iris', 'Intre Lacuri', 'Manastur', 'Marasti', 'Someseni', 'Sopor', 'Zorilor', 'Europa', 'Faget', 'Floresti', 'Apahida', 'Baciu', 'Chinteni', 'Feleacu', 'Gilau', 'Dezmir'],
    'Timisoara': ['Aradului', 'Blascovici', 'Braytim', 'Bucovina', 'Calea Girocului', 'Calea Lipovei', 'Calea Sagului', 'Cetate', 'Complex Studentesc', 'Dacia', 'Elisabetin', 'Fabric', 'Freidorf', 'Fratelia', 'Ghiroda', 'Giroc', 'Iosefin', 'Kuncz', 'Mehala', 'Modern', 'Olimpia-Stadion', 'Plopi', 'Ronat', 'Soarelui', 'Tipografilor', 'Torontalului', 'Dumbravita', 'Chisoda', 'Mosnita Noua', 'Sacalaz', 'Sanmihaiu Roman', 'Urseni'],
    'Iasi': ['Alexandru cel Bun', 'Aviatiei', 'Baza 3', 'Bucium', 'Bularga', 'Canta', 'Centru', 'Centru Civic', 'Copou', 'CUG', 'Dacia', 'Galata', 'Gara', 'Metalurgie', 'Mircea cel Batran', 'Moara de Vant', 'Nicolina', 'Pacurari', 'Podu Ros', 'Sararie', 'Soseaua Nationala', 'Tatarasi', 'Tudor Vladimirescu', 'Valea Adanca', 'Valea Lupului', 'Zorilor', 'Barnova', 'Miroslava', 'Rediu', 'Holboca', 'Tomesti', 'Ciurea'],
    'Constanta': ['Abator', 'Badea Cartan', 'Brick', 'Casa de Cultura', 'Centru', 'Coiciu', 'Dacia', 'Energia', 'Faleza Nord', 'Faleza Sud', 'Far', 'Gara', 'Halta Traian', 'ICIL', 'Inel I', 'Inel II', 'Km 4', 'Km 5', 'Mamaia', 'Mamaia Nord', 'Palas', 'Peninsula', 'Piata Chiliei', 'Piata Grivitei', 'Poarta 6', 'Port', 'Tomis I', 'Tomis II', 'Tomis III', 'Tomis Nord', 'Agigea', 'Eforie Nord', 'Eforie Sud', 'Lazu', 'Navodari', 'Ovidiu', 'Lumina', 'Cumpana', 'Valu lui Traian'],
};
type City = keyof typeof locations;

export function AddLeadDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof leadSchema>>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      source: '',
      budget: 0,
      status: 'Nou',
      notes: '',
      city: '',
      zones: [],
    },
  });

  const watchedCity = form.watch('city') as City;

  function onSubmit(values: z.infer<typeof leadSchema>) {
    if (!user) {
        toast({
            variant: "destructive",
            title: "Autentificare necesară",
            description: "Trebuie să fii autentificat pentru a adăuga un lead.",
        });
        return;
    }

    const contactsCollection = collection(firestore, 'users', user.uid, 'contacts');
    const newLeadData = {
        ...values,
        contactType: 'Lead',
        createdAt: new Date().toISOString(),
    };

    addDocumentNonBlocking(contactsCollection, newLeadData);

    toast({
        title: "Lead adăugat!",
        description: `${values.name} a fost adăugat în lista ta de lead-uri.`,
    });
    setIsOpen(false);
    form.reset();
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
                <div className="space-y-6 px-3">
                    <section>
                        <h3 className="text-lg font-semibold text-primary mb-4">Detalii de Bază</h3>
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
                    </section>
                    
                    <Separator />
                    
                    <section>
                         <h3 className="text-lg font-semibold text-primary mb-4">Detalii Tranzacție</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                         </div>
                    </section>
                    
                    <Separator />

                    <section>
                        <h3 className="text-lg font-semibold text-primary mb-4">Preferințe Locație</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                            <FormField
                            control={form.control}
                            name="city"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Oraș de interes</FormLabel>
                                <Select onValueChange={(value) => {
                                    field.onChange(value);
                                    form.setValue('zones', []); // Reset zones on city change
                                }} defaultValue={field.value}>
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
                                <FormField
                                control={form.control}
                                name="zones"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Zone de interes</FormLabel>
                                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between h-10 font-normal", !field.value?.length && "text-muted-foreground")}>
                                                        <span className='truncate'>
                                                            {field.value?.length ? `${field.value.length} zone selectate` : 'Selectează zonele'}
                                                        </span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                            <ScrollArea className="h-72">
                                                    <div className="p-4">
                                                        {locations[watchedCity].map((zone) => (
                                                            <FormField
                                                            key={zone}
                                                            control={form.control}
                                                            name="zones"
                                                            render={({ field }) => {
                                                                return (
                                                                <FormItem
                                                                    key={zone}
                                                                    className="flex flex-row items-center space-x-3 space-y-0 mb-3"
                                                                >
                                                                    <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value?.includes(zone)}
                                                                        onCheckedChange={(checked) => {
                                                                        const newValue = checked
                                                                            ? [...(field.value || []), zone]
                                                                            : (field.value || []).filter(
                                                                                (value) => value !== zone
                                                                            );
                                                                        field.onChange(newValue);
                                                                        }}
                                                                    />
                                                                    </FormControl>
                                                                    <FormLabel className="font-normal text-sm">
                                                                    {zone}
                                                                    </FormLabel>
                                                                </FormItem>
                                                                );
                                                            }}
                                                            />
                                                        ))}
                                                    </div>
                                            </ScrollArea>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                                />
                            )}
                        </div>
                    </section>

                    <Separator />

                    <section>
                         <h3 className="text-lg font-semibold text-primary mb-4">Notițe</h3>
                          <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormControl><Textarea rows={3} {...field} placeholder="Adaugă notițe despre client, preferințe speciale, etc." /></FormControl><FormMessage /></FormItem> )} />
                    </section>
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

  