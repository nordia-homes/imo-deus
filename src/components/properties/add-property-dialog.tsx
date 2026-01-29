
"use client";

import { useState, ChangeEvent } from 'react';
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
import { Loader2, PlusCircle, Sparkles, Upload, X } from 'lucide-react';
import { generatePropertyDescription } from '@/ai/flows/property-description-generator';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';

const propertySchema = z.object({
  title: z.string().min(1, { message: "Titlul este obligatoriu." }),
  propertyType: z.string().min(1, { message: "Tipul proprietății este obligatoriu." }),
  transactionType: z.string().min(1, { message: "Tipul tranzacției este obligatoriu." }),
  location: z.string().min(1, { message: "Locația este obligatorie." }),
  price: z.coerce.number().positive({ message: "Prețul trebuie să fie pozitiv." }),
  bedrooms: z.coerce.number().int().min(0, { message: "Numărul de dormitoare nu poate fi negativ." }),
  bathrooms: z.coerce.number().min(0, { message: "Numărul de băi nu poate fi negativ." }),
  squareFootage: z.coerce.number().positive({ message: "Suprafața utilă trebuie să fie pozitivă." }),
  totalSurface: z.coerce.number().positive({ message: "Suprafața totală trebuie să fie pozitivă." }).optional().or(z.literal('')),
  
  constructionYear: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 1).optional().or(z.literal('')),
  floor: z.string().optional(),
  totalFloors: z.coerce.number().int().min(0).optional().or(z.literal('')),
  
  comfort: z.string().optional(),
  interiorState: z.string().optional(),
  furnishing: z.string().optional(),
  heatingSystem: z.string().optional(),
  parking: z.string().optional(),
  keyFeatures: z.string().min(1, { message: "Caracteristicile cheie sunt obligatorii pentru generarea AI." }),

  description: z.string().optional(),
  images: z.any().optional(),
});


export function AddPropertyDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const form = useForm<z.infer<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: '',
      propertyType: '',
      transactionType: 'Vânzare',
      location: 'București',
      price: 0,
      bedrooms: 2,
      bathrooms: 1,
      squareFootage: 55,
      keyFeatures: 'bucătărie renovată, balcon spațios, aproape de metrou',
      description: '',
      images: [],
    },
  });

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const currentFiles = form.getValues('images') || [];
      const allFiles = [...currentFiles, ...newFiles].slice(0, 16);

      form.setValue('images', allFiles);

      const newPreviews = allFiles.map(file => URL.createObjectURL(file));
      setImagePreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    const currentFiles = form.getValues('images') || [];
    const newFiles = currentFiles.filter((_, i) => i !== index);
    form.setValue('images', newFiles);

    const previews = newFiles.map(file => URL.createObjectURL(file));
    imagePreviews.forEach(p => URL.revokeObjectURL(p));
    setImagePreviews(previews);
  }

  async function handleGenerateDescription() {
    setIsGenerating(true);
    const { propertyType, location, bedrooms, bathrooms, squareFootage, keyFeatures, price } = form.getValues();
    try {
      const result = await generatePropertyDescription({
          propertyType, location, bedrooms, bathrooms, squareFootage, keyFeatures, price
      });
      form.setValue('description', result.description);
    } catch (error) {
      console.error("Failed to generate description:", error);
    } finally {
      setIsGenerating(false);
    }
  }

  function onSubmit(values: z.infer<typeof propertySchema>) {
    console.log(values);
    setIsOpen(false);
    form.reset();
    imagePreviews.forEach(p => URL.revokeObjectURL(p));
    setImagePreviews([]);
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        form.reset();
        imagePreviews.forEach(p => URL.revokeObjectURL(p));
        setImagePreviews([]);
      }
    }}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adaugă Proprietate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Adaugă Proprietate Nouă</DialogTitle>
          <DialogDescription>
            Completează detaliile de mai jos. Câmpurile marcate cu * sunt obligatorii.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[70vh] p-4 -mx-4">
              <div className="space-y-6 px-4">

                <section>
                  <h3 className="text-lg font-semibold text-primary mb-4">Detalii Principale</h3>
                  <div className="space-y-4">
                    <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Titlu Anunț *</FormLabel><FormControl><Input {...field} placeholder="ex: Apartament 3 camere decomandat, Tineretului" /></FormControl><FormMessage /></FormItem> )} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem><FormLabel>Tip Proprietate *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Apartament">Apartament</SelectItem><SelectItem value="Casă/Vilă">Casă/Vilă</SelectItem><SelectItem value="Garsonieră">Garsonieră</SelectItem><SelectItem value="Teren">Teren</SelectItem><SelectItem value="Spațiu Comercial">Spațiu Comercial</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="transactionType" render={({ field }) => ( <FormItem><FormLabel>Tip Tranzacție *</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Preț (€) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                     <FormField control={form.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Adresă completă / Zonă *</FormLabel><FormControl><Input {...field} placeholder="Str. Exemplu nr. 1, Sector 3, București" /></FormControl><FormMessage /></FormItem> )} />
                  </div>
                </section>
                
                <Separator />

                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4">Specificații & Detalii clădire</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField control={form.control} name="squareFootage" render={({ field }) => ( <FormItem><FormLabel>Suprafață Utilă (mp) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="totalSurface" render={({ field }) => ( <FormItem><FormLabel>Suprafață Construită</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="bedrooms" render={({ field }) => ( <FormItem><FormLabel>Nr. Dormitoare *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem><FormLabel>Nr. Băi *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="constructionYear" render={({ field }) => ( <FormItem><FormLabel>An Construcție</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="floor" render={({ field }) => ( <FormItem><FormLabel>Etaj</FormLabel><FormControl><Input {...field} placeholder="Parter, 3, Demisol..."/></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="totalFloors" render={({ field }) => ( <FormItem><FormLabel>Total Etaje</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                </section>

                <Separator />
                
                <section>
                    <h3 className="text-lg font-semibold text-primary mb-4">Dotări și Caracteristici</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <FormField control={form.control} name="comfort" render={({ field }) => ( <FormItem><FormLabel>Confort</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Lux">Lux</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="interiorState" render={({ field }) => ( <FormItem><FormLabel>Stare Interior</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Nou">Nou</SelectItem><SelectItem value="Renovat">Renovat</SelectItem><SelectItem value="Bună">Bună</SelectItem><SelectItem value="Necesită renovare">Necesită renovare</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="furnishing" render={({ field }) => ( <FormItem><FormLabel>Mobilier</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Lux">Lux</SelectItem><SelectItem value="Complet">Complet</SelectItem><SelectItem value="Parțial">Parțial</SelectItem><SelectItem value="Nemobilat">Nemobilat</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="heatingSystem" render={({ field }) => ( <FormItem><FormLabel>Sistem Încălzire</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Centrală proprie">Centrală proprie</SelectItem><SelectItem value="Termoficare">Termoficare</SelectItem><SelectItem value="Sobă/Șemineu">Sobă/Șemineu</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="parking" render={({ field }) => ( <FormItem><FormLabel>Parcare</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                            <SelectContent><SelectItem value="Garaj">Garaj</SelectItem><SelectItem value="Loc exterior">Loc exterior</SelectItem><SelectItem value="Subteran">Subteran</SelectItem><SelectItem value="Fără">Fără</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                     <FormField control={form.control} name="keyFeatures" render={({ field }) => ( <FormItem className="mt-4"><FormLabel>Alte Caracteristici Cheie *</FormLabel><FormControl><Input {...field} placeholder="ex: grădină, piscină, vedere panoramică, etc." /></FormControl><FormMessage /></FormItem> )} />
                </section>
                
                <Separator />

                <section>
                  <h3 className="text-lg font-semibold text-primary mb-4">Descriere și Media</h3>
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center justify-between">
                          <span>Descriere Anunț</span>
                          <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generează cu AI
                          </Button>
                        </FormLabel>
                        <FormControl>
                          <Textarea rows={6} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem className="mt-4">
                    <FormLabel>Fotografii (max 16)</FormLabel>
                    <FormControl>
                      <div className="flex items-center justify-center w-full">
                        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="w-8 h-8 mb-4 text-gray-500" />
                            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click pentru a încărca</span> sau trage fișierele aici</p>
                            <p className="text-xs text-gray-500">PNG, JPG (max. 16 fișiere)</p>
                          </div>
                          <Input id="dropzone-file" type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleImageChange} disabled={(form.getValues('images')?.length || 0) >= 16} />
                        </label>
                      </div>
                    </FormControl>
                    {imagePreviews.length > 0 && (
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 mt-4">
                        {imagePreviews.map((src, index) => (
                          <div key={src} className="relative aspect-square">
                            <Image src={src} alt={`Preview ${index}`} fill className="object-cover rounded-md" />
                            <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => removeImage(index)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                </section>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t mt-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Anulează</Button>
              <Button type="submit">Salvează Proprietatea</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
