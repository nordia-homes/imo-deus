"use client";

import { useState, ChangeEvent, useEffect } from 'react';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, PlusCircle, Sparkles, Upload, X } from 'lucide-react';
import { generatePropertyDescription, PropertyDescriptionInput } from '@/ai/flows/property-description-generator';
import Image from 'next/image';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAgency } from '@/context/AgencyContext';
import { Checkbox } from '../ui/checkbox';
import type { Property, UserProfile } from '@/lib/types';


const propertySchema = z.object({
  title: z.string().min(1, { message: "Titlul este obligatoriu." }),
  propertyType: z.string().min(1, { message: "Tipul proprietății este obligatoriu." }),
  transactionType: z.string().min(1, { message: "Tipul tranzacției este obligatoriu." }),
  location: z.string().min(1, { message: "Locația este obligatorie." }),
  price: z.coerce.number().positive({ message: "Prețul trebuie să fie pozitiv." }),
  rooms: z.coerce.number().int().min(0, { message: "Numărul de camere nu poate fi negativ." }),
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
  status: z.string().optional(),
  featured: z.boolean().default(false),
  
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  salesScore: z.string().optional(),
  agentId: z.string().optional(),
});

/**
 * Resizes an image file, compresses it, and returns it as a Blob.
 * This is done entirely on the client-side to prepare it for upload to Firebase Storage.
 */
const resizeAndGetBlob = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not get canvas context'));
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            return reject(new Error('Canvas to Blob conversion failed'));
          }
          resolve(blob);
        }, 'image/jpeg', 0.8);
      };
      img.onerror = reject;
      img.src = event.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

type ImageSource = File | { url: string; alt: string };

function PropertyFormContent({
  isEditMode,
  property,
  onClose,
}: {
  isEditMode: boolean;
  property?: Property | null;
  onClose: () => void;
}) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDialogLoading, setIsDialogLoading] = useState(true);
    const [imageSources, setImageSources] = useState<ImageSource[]>([]);
    const { toast } = useToast();
    const { user } = useUser();
    const { agency, agencyId } = useAgency();
    const firestore = useFirestore();
    const storage = useStorage();
    const [agents, setAgents] = useState<UserProfile[]>([]);

    const form = useForm<z.infer<typeof propertySchema>>({
        resolver: zodResolver(propertySchema),
    });

    useEffect(() => {
        const loadDialogData = async () => {
            if (agency && agency.agentIds) {
                try {
                    const agentPromises = agency.agentIds.map(id => getDoc(doc(firestore, 'users', id)));
                    const agentDocs = await Promise.all(agentPromises);
                    const agentProfiles = agentDocs
                        .filter(docSnap => docSnap.exists())
                        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
                    setAgents(agentProfiles);
                } catch (error) {
                    console.error("Error fetching agent profiles for dialog:", error);
                    toast({ variant: 'destructive', title: 'Eroare la încărcarea agenților' });
                }
            }

            if (isEditMode && property) {
                form.reset({
                    title: property.title || '',
                    propertyType: property.propertyType || '',
                    transactionType: property.transactionType || 'Vânzare',
                    location: property.location || '',
                    price: property.price || 0,
                    rooms: property.rooms || 0,
                    bathrooms: property.bathrooms || 0,
                    squareFootage: property.squareFootage || 0,
                    totalSurface: property.totalSurface || '',
                    constructionYear: property.constructionYear || '',
                    floor: property.floor || '',
                    totalFloors: property.totalFloors || '',
                    comfort: property.comfort || '',
                    interiorState: property.interiorState || '',
                    furnishing: property.furnishing || '',
                    heatingSystem: property.heatingSystem || '',
                    parking: property.parking || '',
                    keyFeatures: property.keyFeatures || property.amenities?.join(', ') || '',
                    description: property.description || '',
                    status: property.status || 'Activ',
                    featured: property.featured || false,
                    ownerName: property.ownerName || '',
                    ownerPhone: property.ownerPhone || '',
                    salesScore: property.salesScore || 'Mediu',
                    agentId: property.agentId || 'unassigned',
                });
                setImageSources(property.images || []);
            } else {
                form.reset({
                    title: '', propertyType: '', transactionType: 'Vânzare', location: 'București', price: 0,
                    rooms: 2, bathrooms: 1, squareFootage: 55, totalSurface: '', constructionYear: '',
                    floor: '', totalFloors: '', comfort: '', interiorState: '', furnishing: '', heatingSystem: '',
                    parking: '', keyFeatures: 'bucătărie renovată, balcon spațios, aproape de metrou',
                    description: '', status: 'Activ', featured: false, ownerName: '', ownerPhone: '', salesScore: 'Mediu',
                    agentId: user?.uid || 'unassigned',
                });
                setImageSources([]);
            }
            setIsDialogLoading(false);
        };

        loadDialogData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
        const newFiles = Array.from(files);
        setImageSources((prevSources) => [...prevSources, ...newFiles].slice(0, 16));
        }
    };

    const removeImage = (index: number) => {
        setImageSources((prev) => prev.filter((_, i) => i !== index));
    };

    async function handleGenerateDescription() {
        setIsGenerating(true);
        const fieldsToValidate: (keyof PropertyDescriptionInput)[] = [
        'propertyType', 'location', 'rooms', 'bathrooms', 'squareFootage', 'keyFeatures', 'price'
        ];
        const isValid = await form.trigger(fieldsToValidate);

        if (!isValid) {
        toast({
            variant: "destructive",
            title: "Completați câmpurile obligatorii",
            description: "Pentru a genera descrierea cu AI, asigurați-vă că ați completat prețul, tipul proprietății și caracteristicile cheie.",
        });
        setIsGenerating(false);
        return;
        }
        
        const { propertyType, location, rooms, bathrooms, squareFootage, keyFeatures, price } = form.getValues();
        try {
        const result = await generatePropertyDescription({
            propertyType, location, rooms, bathrooms, squareFootage, keyFeatures, price
        });
        form.setValue('description', result.description);
        } catch (error) {
        console.error("Failed to generate description:", error);
        toast({
            variant: "destructive",
            title: "A apărut o eroare",
            description: "Nu am putut genera descrierea. Încercați din nou.",
        });
        } finally {
        setIsGenerating(false);
        }
    }

    async function onSubmit(values: z.infer<typeof propertySchema>) {
        setIsSubmitting(true);
        if (!user || !agencyId) {
            toast({
                variant: 'destructive',
                title: 'Eroare de autentificare',
                description: 'Nu am putut identifica agenția. Reîncărcați pagina și reîncercați.',
            });
            setIsSubmitting(false);
            return;
        }

        try {
            const newImageFiles = imageSources.filter((s): s is File => s instanceof File);
            const existingImages = imageSources.filter((s): s is { url: string; alt: string; } => !(s instanceof File));
            
            let uploadedImageUrls: { url: string; alt: string; }[] = [];
            const propertyId = isEditMode ? property!.id : doc(collection(firestore, 'agencies', agencyId, 'properties')).id;

            if (newImageFiles.length > 0) {
                toast({ title: 'Încărcare imagini...', description: 'Acest proces poate dura câteva momente.' });
                
                const uploadPromises = newImageFiles.map(async (file, index) => {
                    const resizedBlob = await resizeAndGetBlob(file);
                    const imageRef = ref(storage, `properties/${agencyId}/${user.uid}/${propertyId}/${propertyId}-${Date.now()}-${index}.jpg`);
                    await uploadBytes(imageRef, resizedBlob);
                    const downloadURL = await getDownloadURL(imageRef);
                    return {
                        url: downloadURL,
                        alt: `${values.title} - imagine ${index + 1}`
                    };
                });
                uploadedImageUrls = await Promise.all(uploadPromises);
            }

            const finalImages = [...existingImages, ...uploadedImageUrls];
            const selectedAgent = agents.find(agent => agent.id === values.agentId);

            const propertyData = {
            title: values.title,
            propertyType: values.propertyType,
            transactionType: values.transactionType,
            location: values.location,
            address: values.location,
            price: values.price,
            rooms: values.rooms,
            bathrooms: values.bathrooms,
            squareFootage: values.squareFootage,
            totalSurface: values.totalSurface ? Number(values.totalSurface) : null,
            constructionYear: values.constructionYear ? Number(values.constructionYear) : null,
            floor: values.floor || null,
            totalFloors: values.totalFloors ? Number(values.totalFloors) : null,
            comfort: values.comfort || null,
            interiorState: values.interiorState || null,
            furnishing: values.furnishing || null,
            heatingSystem: values.heatingSystem || null,
            parking: values.parking || null,
            keyFeatures: values.keyFeatures,
            description: values.description || '',
            images: finalImages,
            tagline: `${values.rooms} camere | ${values.bathrooms} băi | ${values.squareFootage}mp`,
            amenities: values.keyFeatures.split(',').map((f) => f.trim()),
            status: values.status,
            featured: values.featured,
            ownerName: values.ownerName,
            ownerPhone: values.ownerPhone,
            salesScore: values.salesScore as Property['salesScore'],
            agentId: values.agentId === 'unassigned' ? null : values.agentId,
            agentName: selectedAgent?.name || null,
            };
        
            if (isEditMode) {
                const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property!.id);
                await updateDoc(propertyRef, propertyData);
                toast({
                title: 'Proprietate actualizată!',
                description: `${values.title} a fost actualizată cu succes.`,
                });
            } else {
                const newPropertyRef = doc(collection(firestore, 'agencies', agencyId, 'properties'));
                await setDoc(newPropertyRef, {
                    ...propertyData,
                    id: newPropertyRef.id,
                    createdAt: new Date().toISOString(),
                });
                toast({
                title: 'Proprietate adăugată!',
                description: `${values.title} a fost adăugată cu succes.`,
                });
            }
            
            onClose();

        } catch (error: any) {
            console.error("Failed to save property:", error);
            toast({
            variant: 'destructive',
            title: 'Salvare eșuată',
            description: error.message || 'A apărut o eroare neașteptată.'
            });
        } finally {
            setIsSubmitting(false);
        }
    }
    
    const imagePreviews = imageSources.map(s => s instanceof File ? URL.createObjectURL(s) : s.url);
    
    useEffect(() => {
        return () => {
        imagePreviews.forEach(preview => {
            if (preview.startsWith('blob:')) {
            URL.revokeObjectURL(preview);
            }
        });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imagePreviews]);

    return (
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
            <DialogTitle>{isEditMode ? 'Editează Proprietate' : 'Adaugă Proprietate Nouă'}</DialogTitle>
            <DialogDescription>
                {isEditMode ? 'Modifică detaliile proprietății de mai jos.' : 'Completează detaliile de mai jos. Câmpurile marcate cu * sunt obligatorii.'}
            </DialogDescription>
            </DialogHeader>
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <ScrollArea className="h-[70vh] p-4 -mx-4">
                    {isDialogLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="space-y-6 px-4">
                            <section>
                            <h3 className="text-lg font-semibold text-primary mb-4">Detalii Principale</h3>
                            <div className="space-y-4">
                                <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Titlu Anunț *</FormLabel><FormControl><Input {...field} placeholder="ex: Apartament 3 camere decomandat, Tineretului" /></FormControl><FormMessage /></FormItem> )} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem><FormLabel>Tip Proprietate *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Apartament">Apartament</SelectItem><SelectItem value="Casă/Vilă">Casă/Vilă</SelectItem><SelectItem value="Garsonieră">Garsonieră</SelectItem><SelectItem value="Teren">Teren</SelectItem><SelectItem value="Spațiu Comercial">Spațiu Comercial</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="transactionType" render={({ field }) => ( <FormItem><FormLabel>Tip Tranzacție *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Preț (€) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="location" render={({ field }) => ( <FormItem><FormLabel>Adresă completă / Zonă *</FormLabel><FormControl><Input {...field} placeholder="Str. Exemplu nr. 1, Sector 3, București" /></FormControl><FormMessage /></FormItem> )} />
                                    <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel>Status</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Activ">Activ</SelectItem><SelectItem value="Inactiv">Inactiv</SelectItem><SelectItem value="Vândut">Vândut</SelectItem><SelectItem value="Închiriat">Închiriat</SelectItem><SelectItem value="Rezervat">Rezervat</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField
                                        control={form.control}
                                        name="featured"
                                        render={({ field }) => (
                                        <FormItem className="flex flex-col justify-end">
                                            <div className="flex items-center space-x-2 rounded-md border h-10 px-3">
                                            <FormControl>
                                                <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                                id="featured-checkbox"
                                                />
                                            </FormControl>
                                            <FormLabel htmlFor="featured-checkbox" className="!mt-0">Recomandată</FormLabel>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    </div>
                                </div>
                            </div>
                            </section>
                            
                            <Separator />
                            
                            <section>
                            <h3 className="text-lg font-semibold text-primary mb-4">Detalii Proprietar</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="ownerName" render={({ field }) => ( <FormItem><FormLabel>Nume Proprietar</FormLabel><FormControl><Input {...field} placeholder="Numele proprietarului" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="ownerPhone" render={({ field }) => ( <FormItem><FormLabel>Telefon Proprietar</FormLabel><FormControl><Input {...field} placeholder="Numărul de telefon" /></FormControl><FormMessage /></FormItem> )} />
                            </div>
                            </section>

                            <Separator />

                            <section>
                                <h3 className="text-lg font-semibold text-primary mb-4">Management Intern</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="agentId" render={({ field }) => ( <FormItem><FormLabel>Agent Responsabil</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Nealocat</SelectItem>
                                            {agents.map(agent => (
                                                <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                                            ))}
                                        </SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="salesScore" render={({ field }) => ( <FormItem><FormLabel>Potențial Vânzare</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="Scăzut">Scăzut</SelectItem>
                                            <SelectItem value="Mediu">Mediu</SelectItem>
                                            <SelectItem value="Ridicată">Ridicată</SelectItem>
                                        </SelectContent></Select><FormMessage /></FormItem>)} />
                                </div>
                            </section>

                            <Separator />

                            <section>
                                <h3 className="text-lg font-semibold text-primary mb-4">Specificații &amp; Detalii clădire</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <FormField control={form.control} name="squareFootage" render={({ field }) => ( <FormItem><FormLabel>Suprafață Utilă (mp) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="totalSurface" render={({ field }) => ( <FormItem><FormLabel>Suprafață Construită</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="rooms" render={({ field }) => ( <FormItem><FormLabel>Nr. Camere *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
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
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Lux">Lux</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="interiorState" render={({ field }) => ( <FormItem><FormLabel>Stare Interior</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Nou">Nou</SelectItem><SelectItem value="Renovat">Renovat</SelectItem><SelectItem value="Bună">Bună</SelectItem><SelectItem value="Necesită renovare">Necesită renovare</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="furnishing" render={({ field }) => ( <FormItem><FormLabel>Mobilier</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Lux">Lux</SelectItem><SelectItem value="Complet">Complet</SelectItem><SelectItem value="Parțial">Parțial</SelectItem><SelectItem value="Nemobilat">Nemobilat</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="heatingSystem" render={({ field }) => ( <FormItem><FormLabel>Sistem Încălzire</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Centrală proprie">Centrală proprie</SelectItem><SelectItem value="Termoficare">Termoficare</SelectItem><SelectItem value="Sobă/Șemineu">Sobă/Șemineu</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="parking" render={({ field }) => ( <FormItem><FormLabel>Parcare</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
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
                                    <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-muted">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                        <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click pentru a încărca</span> sau trageți fișierele aici</p>
                                        <p className="text-xs text-muted-foreground">PNG, JPG (max 16 fișiere)</p>
                                    </div>
                                    <Input id="dropzone-file" type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleImageChange} />
                                    </label>
                                </div>
                                </FormControl>
                                {imagePreviews.length > 0 && (
                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mt-4">
                                        {imagePreviews.map((src, index) => (
                                            <div key={index} className="relative aspect-square group">
                                                <Image src={src} alt={`Preview ${index}`} fill className="object-cover rounded-md" />
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    size="icon"
                                                    className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => removeImage(index)}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </FormItem>
                            </section>
                        </div>
                    )}
                </ScrollArea>
                <DialogFooter className="pt-4 border-t mt-4">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Anulează</Button>
                <Button type="submit" disabled={isSubmitting || isDialogLoading}>
                    {(isSubmitting || isDialogLoading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditMode ? 'Salvează Modificări' : 'Salvează Proprietatea'}
                </Button>
                </DialogFooter>
            </form>
            </Form>
        </DialogContent>
    )
}

export function AddPropertyDialog({
  children,
  property,
}: {
  children?: React.ReactNode;
  property?: Property | null;
}) {
  const isEditMode = !!property;
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children || <Button><PlusCircle className="mr-2 h-4 w-4" />Adaugă Proprietate</Button>}
      </DialogTrigger>
      {isOpen && (
        <PropertyFormContent
          isEditMode={isEditMode}
          property={property}
          onClose={() => setIsOpen(false)}
        />
      )}
    </Dialog>
  );
}
