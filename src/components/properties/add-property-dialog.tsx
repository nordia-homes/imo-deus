
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

// Using z.any() for files as z.instanceof(File) can cause issues with server components.
// File validation can be handled in the onSubmit function.
const propertySchema = z.object({
  propertyType: z.string().min(1, {message: "Tipul proprietății este obligatoriu."}),
  location: z.string().min(1, {message: "Locația este obligatorie."}),
  bedrooms: z.coerce.number().int().positive({message: "Numărul de dormitoare trebuie să fie pozitiv."}),
  bathrooms: z.coerce.number().positive({message: "Numărul de băi trebuie să fie pozitiv."}),
  squareFootage: z.coerce.number().positive({message: "Suprafața trebuie să fie pozitivă."}),
  keyFeatures: z.string().min(1, {message: "Caracteristicile cheie sunt obligatorii."}),
  price: z.coerce.number().positive({message: "Prețul trebuie să fie pozitiv."}),
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
        propertyType: 'Apartament',
        location: 'București',
        bedrooms: 2,
        bathrooms: 1,
        squareFootage: 55,
        keyFeatures: 'bucătărie renovată, balcon spațios, aproape de metrou',
        price: 120000,
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
    // Clean up old object URLs
    imagePreviews.forEach(p => URL.revokeObjectURL(p));
    setImagePreviews(previews);
  }

  async function handleGenerateDescription() {
    setIsGenerating(true);
    const values = form.getValues();
    try {
        const result = await generatePropertyDescription(values);
        form.setValue('description', result.description);
    } catch (error) {
        console.error("Failed to generate description:", error);
    } finally {
        setIsGenerating(false);
    }
  }

  function onSubmit(values: z.infer<typeof propertySchema>) {
    console.log(values);
    // Here you would handle file uploads before saving to Firestore
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adaugă Proprietate Nouă</DialogTitle>
          <DialogDescription>
            Completează detaliile de mai jos. Poți folosi AI pentru a genera o descriere.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[70vh] p-4 -mx-4">
                <div className="space-y-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem><FormLabel>Tip Proprietate</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Locație</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="bedrooms" render={({ field }) => ( <FormItem><FormLabel>Dormitoare</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem><FormLabel>Băi</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="squareFootage" render={({ field }) => ( <FormItem><FormLabel>Suprafață (mp)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Preț (€)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    <FormField control={form.control} name="keyFeatures" render={({ field }) => ( <FormItem><FormLabel>Caracteristici Cheie</FormLabel><FormControl><Input {...field} placeholder="ex: bucătărie renovată, curte mare" /></FormControl><FormMessage /></FormItem> )} />
                    
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center justify-between">
                            <span>Descriere</span>
                            <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4 text-accent"/>}
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

                    <FormItem>
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
