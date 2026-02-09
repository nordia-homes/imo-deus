"use client";

import { useState, ChangeEvent, useEffect, useMemo } from 'react';
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
import { generatePropertyDescription } from '@/ai/flows/property-description-generator';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAgency } from '@/context/AgencyContext';
import { Checkbox } from '../ui/checkbox';
import type { Property, UserProfile } from '@/lib/types';
import { locations, type City } from '@/lib/locations';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';


const propertySchema = z.object({
  title: z.string().min(1, { message: "Titlul este obligatoriu." }),
  propertyType: z.string().min(1, { message: "Tipul proprietății este obligatoriu." }),
  transactionType: z.string().min(1, { message: "Tipul tranzacției este obligatoriu." }),
  address: z.string().min(1, { message: "Adresa este obligatorie." }),
  city: z.string().optional(),
  zone: z.string().optional(),
  price: z.coerce.number().positive({ message: "Prețul trebuie să fie pozitiv." }),
  rooms: z.coerce.number().int().min(0, { message: "Numărul de camere nu poate fi negativ." }),
  bathrooms: z.coerce.number().min(0, { message: "Numărul de băi nu poate fi negativ." }),
  squareFootage: z.coerce.number().positive({ message: "Suprafața utilă trebuie să fie pozitivă." }),
  totalSurface: z.coerce.number().positive({ message: "Suprafața totală trebuie să fie pozitivă." }).optional().or(z.literal('')),
  
  constructionYear: z.coerce.number().int().min(1800).max(new Date().getFullYear() + 1).optional().or(z.literal('')),
  floor: z.string().optional(),
  totalFloors: z.coerce.number().int().min(0).optional().or(z.literal('')),
  orientation: z.string().optional(),
  
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
  
  // New fields
  buildingState: z.string().optional(),
  seismicRisk: z.string().optional(),
  balconyTerrace: z.string().optional(),
  partitioning: z.string().optional(),
  kitchen: z.string().optional(),
  lift: z.string().optional(),
  nearMetro: z.boolean().default(false),

  // Commission fields
  commissionType: z.string().optional(),
  commissionValue: z.coerce.number().optional(),
});

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

function PropertyForm({ propertyData, onClose }: { propertyData: Property | null; onClose: () => void }) {
    const { toast } = useToast();
    const { user } = useUser();
    const { agency, agencyId } = useAgency();
    const firestore = useFirestore();
    const storage = useStorage();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [imageSources, setImageSources] = useState<ImageSource[]>([]);

    const isEditMode = !!propertyData;

    const form = useForm<z.infer<typeof propertySchema>>({
        resolver: zodResolver(propertySchema),
        defaultValues: {},
    });

    const watchedCity = form.watch('city') as City;
    const availableZones = (watchedCity && locations[watchedCity]) ? locations[watchedCity].sort() : [];
    const watchedCommissionType = form.watch('commissionType', isEditMode ? propertyData?.commissionType : 'percentage');
    
    useEffect(() => {
        if (watchedCity && isEditMode && propertyData?.city !== watchedCity) {
            form.setValue('zone', '');
        }
    }, [watchedCity, form, isEditMode, propertyData?.city]);

    useEffect(() => {
        if (isEditMode && propertyData) {
            form.reset({
                title: propertyData.title || '',
                propertyType: propertyData.propertyType || '',
                transactionType: propertyData.transactionType || 'Vânzare',
                address: propertyData.address || '',
                city: propertyData.city || '',
                zone: propertyData.zone || '',
                price: propertyData.price || 0,
                rooms: propertyData.rooms || 0,
                bathrooms: propertyData.bathrooms || 0,
                squareFootage: propertyData.squareFootage || 0,
                totalSurface: propertyData.totalSurface || '',
                constructionYear: propertyData.constructionYear || '',
                floor: propertyData.floor || '',
                totalFloors: propertyData.totalFloors || '',
                orientation: propertyData.orientation || '',
                comfort: propertyData.comfort || '',
                interiorState: propertyData.interiorState || '',
                furnishing: propertyData.furnishing || '',
                heatingSystem: propertyData.heatingSystem || '',
                parking: propertyData.parking || '',
                keyFeatures: propertyData.keyFeatures || propertyData.amenities?.join(', ') || '',
                description: propertyData.description || '',
                status: propertyData.status || 'Activ',
                featured: propertyData.featured || false,
                ownerName: propertyData.ownerName || '',
                ownerPhone: propertyData.ownerPhone || '',
                salesScore: propertyData.salesScore || 'Mediu',
                agentId: propertyData.agentId || user?.uid || 'unassigned',
                buildingState: propertyData.buildingState || '',
                seismicRisk: propertyData.seismicRisk || '',
                balconyTerrace: propertyData.balconyTerrace || '',
                partitioning: propertyData.partitioning || '',
                kitchen: propertyData.kitchen || '',
                lift: propertyData.lift || '',
                nearMetro: propertyData.nearMetro || false,
                commissionType: propertyData.commissionType || 'percentage',
                commissionValue: propertyData.commissionValue ?? 2,
            });
            setImageSources(propertyData.images || []);
        } else {
             form.reset({
                title: '', propertyType: '', transactionType: 'Vânzare', address: '', city: 'Bucuresti-Ilfov', zone: '', price: 0,
                rooms: 2, bathrooms: 1, squareFootage: 55, totalSurface: '', constructionYear: '',
                floor: '', totalFloors: '', orientation: '', comfort: '', interiorState: '', furnishing: '', heatingSystem: '',
                parking: '', keyFeatures: 'bucătărie renovată, balcon spațios, aproape de metrou',
                description: '', status: 'Activ', featured: false, ownerName: '', ownerPhone: '', salesScore: 'Mediu',
                agentId: user?.uid || 'unassigned',
                buildingState: '', seismicRisk: '', balconyTerrace: '', partitioning: '', kitchen: '', lift: '', nearMetro: false,
                commissionType: 'percentage',
                commissionValue: 2,
            });
            setImageSources([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (agency?.agentIds) {
            const fetchAgents = async () => {
                try {
                    const agentPromises = agency.agentIds.map(id => getDoc(doc(firestore, 'users', id)));
                    const agentDocs = await Promise.all(agentPromises);
                    if (isMounted) {
                        const agentProfiles = agentDocs
                            .filter(docSnap => docSnap.exists())
                            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
                        setAgents(agentProfiles);
                    }
                } catch (error) {
                    console.error("Error loading agents:", error);
                }
            };
            fetchAgents();
        }
        return () => { isMounted = false; };
    }, [agency, firestore]);

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
        const values = form.getValues();
        
        try {
            const propertyForAi: Property = {
                id: 'temp-id-for-ai',
                images: [],

                title: values.title,
                propertyType: values.propertyType,
                transactionType: values.transactionType,
                location: [values.zone, values.city].filter(Boolean).join(', '),
                address: values.address,
                price: values.price || 0,
                rooms: values.rooms || 0,
                bathrooms: values.bathrooms || 0,
                squareFootage: values.squareFootage || 0,
                totalSurface: values.totalSurface ? Number(values.totalSurface) : undefined,
                constructionYear: values.constructionYear ? Number(values.constructionYear) : undefined,
                keyFeatures: values.keyFeatures,
                amenities: values.keyFeatures?.split(',').map(s => s.trim()),
                furnishing: values.furnishing,
                parking: values.parking,
                interiorState: values.interiorState,
                comfort: values.comfort,
                floor: values.floor,
                totalFloors: values.totalFloors ? Number(values.totalFloors) : undefined,
                partitioning: values.partitioning,
                heatingSystem: values.heatingSystem,
                buildingState: values.buildingState,
                seismicRisk: values.seismicRisk,
                balconyTerrace: values.balconyTerrace,
                kitchen: values.kitchen,
                lift: values.lift,
                orientation: values.orientation,
                nearMetro: values.nearMetro,
                
                agent: undefined,
                latitude: undefined,
                longitude: undefined,
                tagline: undefined,
                createdAt: undefined,
                promotions: undefined,
                agentId: undefined,
                agentName: undefined,
                status: 'Activ',
                featured: false,
                statusUpdatedAt: undefined,
                notes: undefined,
                salesScore: undefined,
                ownerName: undefined,
                ownerPhone: undefined,
                rlvUrl: undefined,
                commissionType: values.commissionType as 'percentage' | 'fixed' | undefined,
                commissionValue: values.commissionValue,
                city: values.city,
                zone: values.zone,
                description: values.description // Pass existing description for context if any
            };

            const result = await generatePropertyDescription(propertyForAi);
            
            form.setValue('description', result.description);
            toast({
                title: "Descriere generată!",
                description: "Descrierea AI a fost adăugată în formular.",
            });
        } catch (error) {
            console.error("Failed to generate description:", error);
            toast({
                variant: "destructive",
                title: "A apărut o eroare",
                description: "Nu am putut genera descrierea. Asigură-te că ai completat câmpurile cheie (ex: titlu, preț, caracteristici).",
            });
        } finally {
            setIsGenerating(false);
        }
    }

    async function onSubmit(values: z.infer<typeof propertySchema>) {
      setIsSubmitting(true);
      if (!user || !agencyId) {
          toast({ variant: 'destructive', title: 'Eroare de autentificare', description: 'Nu am putut identifica agenția. Reîncărcați pagina și reîncercați.' });
          setIsSubmitting(false);
          return;
      }

      try {
          const newImageFiles = imageSources.filter((s): s is File => s instanceof File);
          const existingImages = imageSources.filter((s): s is { url: string; alt: string; } => !(s instanceof File));
          
          let uploadedImageUrls: { url: string; alt: string; }[] = [];
          const propertyId = isEditMode ? propertyData!.id : doc(collection(firestore, 'agencies', agencyId, 'properties')).id;

          if (newImageFiles.length > 0) {
              toast({ title: 'Încărcare imagini...', description: 'Acest proces poate dura câteva momente.' });
              
              const uploadPromises = newImageFiles.map(async (file, index) => {
                  const resizedBlob = await resizeAndGetBlob(file);
                  const imageName = `${crypto.randomUUID()}.jpg`;
                  const imageRef = ref(storage, `agencies/${agencyId}/properties/${propertyId}/${imageName}`);
                  await uploadBytes(imageRef, resizedBlob);
                  const downloadURL = await getDownloadURL(imageRef);
                  return { url: downloadURL, alt: `${values.title} - imagine ${index + 1}` };
              });
              uploadedImageUrls = await Promise.all(uploadPromises);
          }

          const finalImages = [...existingImages, ...uploadedImageUrls];
          const selectedAgent = agents.find(agent => agent.id === values.agentId);
          
          // Placeholder geocoding
          const lat = 44.439663 + (Math.random() - 0.5) * 0.1; // Randomly around Bucharest center
          const lon = 26.096306 + (Math.random() - 0.5) * 0.1;

          const propertyDataToSave = {
              title: values.title,
              propertyType: values.propertyType,
              transactionType: values.transactionType,
              address: values.address,
              city: values.city,
              zone: values.zone,
              latitude: lat,
              longitude: lon,
              location: [values.zone, values.city].filter(Boolean).join(', '),
              price: values.price,
              rooms: values.rooms,
              bathrooms: values.bathrooms,
              squareFootage: values.squareFootage,
              totalSurface: values.totalSurface ? Number(values.totalSurface) : null,
              constructionYear: values.constructionYear ? Number(values.constructionYear) : null,
              floor: values.floor || null,
              totalFloors: values.totalFloors ? Number(values.totalFloors) : null,
              orientation: values.orientation || null,
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
              buildingState: values.buildingState || null,
              seismicRisk: values.seismicRisk || null,
              balconyTerrace: values.balconyTerrace || null,
              partitioning: values.partitioning || null,
              kitchen: values.kitchen || null,
              lift: values.lift || null,
              nearMetro: values.nearMetro,
              commissionType: values.commissionType,
              commissionValue: values.commissionValue,
          };
      
          if (isEditMode) {
              const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', propertyData!.id);
              await updateDoc(propertyRef, propertyDataToSave);
              toast({ title: 'Proprietate actualizată!', description: `${values.title} a fost actualizată cu succes.` });
          } else {
              const newPropertyRef = doc(collection(firestore, 'agencies', agencyId, 'properties'));
              await setDoc(newPropertyRef, { ...propertyDataToSave, id: newPropertyRef.id, createdAt: new Date().toISOString() });
              toast({ title: 'Proprietate adăugată!', description: `${values.title} a fost adăugată cu succes.` });
          }
          
          onClose();

      } catch (error: any) {
          console.error("Failed to save property:", error);
          toast({ variant: 'destructive', title: 'Salvare eșuată', description: error.message || 'A apărut o eroare neașteptată.' });
      } finally {
          setIsSubmitting(false);
      }
    }
  
    const imagePreviews = useMemo(() => imageSources.map(s => s instanceof File ? URL.createObjectURL(s) : s.url), [imageSources]);
  
    useEffect(() => {
        return () => {
            imagePreviews.forEach(preview => {
                if (preview.startsWith('blob:')) {
                    URL.revokeObjectURL(preview);
                }
            });
        };
    }, [imagePreviews]);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] h-full">
                <div className='overflow-y-auto p-6'>
                    <div className="space-y-6">
                        <section>
                            <h3 className="text-lg font-semibold text-primary mb-4">Detalii Principale</h3>
                            <div className="space-y-4">
                                <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel>Titlu Anunț *</FormLabel><FormControl><Input {...field} placeholder="ex: Vilă superbă cu piscină în Pipera" /></FormControl><FormMessage /></FormItem> )} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem><FormLabel>Tip Proprietate *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Apartament">Apartament</SelectItem><SelectItem value="Casă/Vilă">Casă/Vilă</SelectItem><SelectItem value="Garsonieră">Garsonieră</SelectItem><SelectItem value="Teren">Teren</SelectItem><SelectItem value="Spațiu Comercial">Spațiu Comercial</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="transactionType" render={({ field }) => ( <FormItem><FormLabel>Tip Tranzacție *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                        <SelectContent><SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel>Preț (€) *</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 350000" /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                     <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel>Oraș *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează orașul" /></SelectTrigger></FormControl>
                                        <SelectContent>{Object.keys(locations).map(city => <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="zone" render={({ field }) => ( <FormItem><FormLabel>Zonă</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value} disabled={!watchedCity}><FormControl><SelectTrigger><SelectValue placeholder="Selectează zona" /></SelectTrigger></FormControl>
                                        <SelectContent>{availableZones.map(zone => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                    <FormField control={form.control} name="address" render={({ field }) => ( <FormItem><FormLabel>Adresă (stradă, nr, etc) *</FormLabel><FormControl><Input {...field} placeholder="ex: Strada Pădurii, nr. 10" /></FormControl><FormMessage /></FormItem> )} />
                                </div>
                                
                                <FormDescription>Coordonatele vor fi generate automat pe baza adresei.</FormDescription>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                            <FormField control={form.control} name="ownerName" render={({ field }) => ( <FormItem><FormLabel>Nume Proprietar</FormLabel><FormControl><Input {...field} placeholder="ex: Ion Popescu" /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="ownerPhone" render={({ field }) => ( <FormItem><FormLabel>Telefon Proprietar</FormLabel><FormControl><Input {...field} placeholder="ex: 0722 123 456" /></FormControl><FormMessage /></FormItem> )} />
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <FormField
                                    control={form.control}
                                    name="commissionType"
                                    render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Tip Comision</FormLabel>
                                        <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex items-center space-x-4"
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="percentage" id="r1" /></FormControl>
                                            <FormLabel htmlFor="r1" className="font-normal">Procent</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                            <FormControl><RadioGroupItem value="fixed" id="r2" /></FormControl>
                                            <FormLabel htmlFor="r2" className="font-normal">Sumă Fixă</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                                {watchedCommissionType === 'percentage' ? (
                                    <FormField
                                        control={form.control}
                                        name="commissionValue"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Valoare Procent</FormLabel>
                                            <Select onValueChange={(val) => field.onChange(Number(val))} value={String(field.value)}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="1">1%</SelectItem>
                                                    <SelectItem value="1.5">1.5%</SelectItem>
                                                    <SelectItem value="2">2%</SelectItem>
                                                    <SelectItem value="3">3%</SelectItem>
                                                    <SelectItem value="4">4%</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                ) : (
                                    <FormField
                                        control={form.control}
                                        name="commissionValue"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sumă Fixă (€)</FormLabel>
                                            <FormControl><Input type="number" {...field} onChange={event => field.onChange(+event.target.value)} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                )}
                            </div>
                        </section>

                        <Separator />

                        <section>
                            <h3 className="text-lg font-semibold text-primary mb-4">Specificații &amp; Detalii clădire</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <FormField control={form.control} name="squareFootage" render={({ field }) => ( <FormItem><FormLabel>Suprafață Utilă Totală (cu balcon) *</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 120" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="totalSurface" render={({ field }) => ( <FormItem><FormLabel>Suprafață Utilă (fără balcon)</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 110" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="rooms" render={({ field }) => ( <FormItem><FormLabel>Nr. Camere *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem><FormLabel>Nr. Băi *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="constructionYear" render={({ field }) => ( <FormItem><FormLabel>An Construcție</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 2021" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="floor" render={({ field }) => ( <FormItem><FormLabel>Etaj</FormLabel><FormControl><Input {...field} placeholder="ex: 3"/></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="totalFloors" render={({ field }) => ( <FormItem><FormLabel>Total Etaje</FormLabel><FormControl><Input type="number" {...field} placeholder="ex: 10" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="orientation" render={({ field }) => ( <FormItem><FormLabel>Orientare</FormLabel><FormControl><Input {...field} placeholder="ex: Sud-Vest" /></FormControl><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="partitioning" render={({ field }) => ( <FormItem><FormLabel>Compartimentare</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Decomandat">Decomandat</SelectItem><SelectItem value="Semidecomandat">Semidecomandat</SelectItem><SelectItem value="Circular">Circular</SelectItem><SelectItem value="Nedecomandat">Nedecomandat</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="seismicRisk" render={({ field }) => ( <FormItem><FormLabel>Risc Seismic</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Risc 2">Risc 2</SelectItem><SelectItem value="Risc 3">Risc 3</SelectItem><SelectItem value="Urgenta 1">Urgență 1</SelectItem><SelectItem value="Urgenta 2">Urgență 2</SelectItem><SelectItem value="Urgenta 3">Urgență 3</SelectItem><SelectItem value="Neexpertizat">Neexpertizat</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
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
                                <FormField control={form.control} name="buildingState" render={({ field }) => ( <FormItem><FormLabel>Stare Clădire</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Clădire nouă">Clădire nouă</SelectItem><SelectItem value="Clădire Anvelopată">Clădire Anvelopată</SelectItem><SelectItem value="Clădire Neanvelopată">Clădire Neanvelopată</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="kitchen" render={({ field }) => ( <FormItem><FormLabel>Bucătărie</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Deschisă">Deschisă</SelectItem><SelectItem value="Închisă">Închisă</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="balconyTerrace" render={({ field }) => ( <FormItem><FormLabel>Balcon / Terasă</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Balcon">Balcon</SelectItem><SelectItem value="Terasa">Terasă</SelectItem><SelectItem value="Fara Balcon">Fără Balcon</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="lift" render={({ field }) => ( <FormItem><FormLabel>Lift</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                    <SelectContent><SelectItem value="Da">Da</SelectItem><SelectItem value="Nu">Nu</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                <FormField
                                    control={form.control}
                                    name="nearMetro"
                                    render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm col-span-1">
                                        <div className="space-y-0.5">
                                        <FormLabel>Apropiere Metrou</FormLabel>
                                        </div>
                                        <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <FormField control={form.control} name="keyFeatures" render={({ field }) => ( <FormItem className="mt-4"><FormLabel>Alte Caracteristici Cheie *</FormLabel><FormControl><Input {...field} placeholder="ex: piscină, renovat modern, centrală proprie" /></FormControl><FormMessage /></FormItem> )} />
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
                                <Textarea rows={6} {...field} placeholder="Descrieți proprietatea în detaliu sau lăsați AI-ul să o facă pentru dumneavoastră..." />
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
                                            <Image src={src} alt={`Preview ${index}`} fill sizes="64px" className="object-cover rounded-md" />
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
                </div>
                <DialogFooter className="shrink-0 border-t bg-background p-4">
                    <div className="flex justify-end gap-2 w-full">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Anulează</Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {isEditMode ? 'Salvează Modificări' : 'Salvează Proprietatea'}
                        </Button>
                    </div>
                </DialogFooter>
            </form>
        </Form>
    );
}

export function AddPropertyDialog({
  children,
  property,
  isOpen,
  onOpenChange,
}: {
  children?: React.ReactNode;
  property?: Property | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isEditMode = !!property;
  const isMobile = useIsMobile();
  
  const formKey = useMemo(() => {
    return isOpen ? (property?.id || `new-${Date.now()}`) : 'closed';
  }, [isOpen, property]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      {children && (
         <DialogTrigger asChild>
          {children}
        </DialogTrigger>
      )}
      <DialogContent className={cn("p-0 flex flex-col", isMobile ? "h-screen w-screen max-w-full rounded-none border-none" : "sm:max-w-4xl h-[90vh]")}>
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle>{isEditMode ? 'Editează Proprietate' : 'Adaugă Proprietate Nouă'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Modifică detaliile proprietății de mai jos.' : 'Completează detaliile de mai jos. Câmpurile marcate cu * sunt obligatorii.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
            {isOpen && <PropertyForm key={formKey} propertyData={property || null} onClose={() => onOpenChange(false)} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
    
    
