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
import { Loader2, PlusCircle, Sparkles } from 'lucide-react';
import { generatePropertyDescription } from '@/ai/flows/property-description-generator';

const propertySchema = z.object({
  propertyType: z.string().min(1),
  location: z.string().min(1),
  bedrooms: z.coerce.number().int().positive(),
  bathrooms: z.coerce.number().positive(),
  squareFootage: z.coerce.number().positive(),
  keyFeatures: z.string().min(1),
  price: z.coerce.number().positive(),
  description: z.string().optional(),
});

export function AddPropertyDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const form = useForm<z.infer<typeof propertySchema>>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
        propertyType: 'House',
        location: 'Springfield',
        bedrooms: 3,
        bathrooms: 2,
        squareFootage: 1800,
        keyFeatures: 'renovated kitchen, large backyard, finished basement',
        price: 350000,
        description: '',
    },
  });

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
    setIsOpen(false);
    form.reset();
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Property</DialogTitle>
          <DialogDescription>
            Fill in the details below. You can use AI to generate a description.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem><FormLabel>Property Type</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Location</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="bedrooms" render={({ field }) => ( <FormItem><FormLabel>Bedrooms</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem><FormLabel>Bathrooms</FormLabel><FormControl><Input type="number" step="0.5" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="squareFootage" render={({ field }) => ( <FormItem><FormLabel>Sq. Footage</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Price</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
            </div>
            <FormField control={form.control} name="keyFeatures" render={({ field }) => ( <FormItem><FormLabel>Key Features</FormLabel><FormControl><Input {...field} placeholder="e.g., renovated kitchen, large backyard" /></FormControl><FormMessage /></FormItem> )} />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center justify-between">
                    <span>Description</span>
                    <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4 text-accent"/>}
                        Generate with AI
                    </Button>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={6} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">Save Property</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
