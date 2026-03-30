"use client";

import { useState, ChangeEvent, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MapPin, Sparkles, Upload, X } from 'lucide-react';
import { generatePropertyDescription } from '@/ai/flows/property-description-generator';
import Image from 'next/image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useStorage } from '@/firebase';
import { collection, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import { Checkbox } from '../ui/checkbox';
import type { Property, UserProfile } from '@/lib/types';
import { locations, type City } from '@/lib/locations';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '../ui/card';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { PropertiesMap } from '../map/PropertiesMap';

type AddressSuggestion = {
  label: string;
  addressLine?: string;
  city?: string;
  zone?: string;
  latitude: number;
  longitude: number;
};

const PROPERTY_TYPE_OPTIONS = ['Apartament', 'Casă/Vilă', 'Garsonieră', 'Teren', 'Spațiu Comercial'] as const;
const TRANSACTION_TYPE_OPTIONS = ['Vânzare', 'Închiriere'] as const;
const PARTITIONING_OPTIONS = ['Decomandat', 'Semidecomandat', 'Circular', 'Nedecomandat'] as const;
const COMFORT_OPTIONS = ['Lux', '1', '2', '3'] as const;
const INTERIOR_STATE_OPTIONS = ['Nou', 'Renovat', 'Bună'] as const;
const FURNISHING_OPTIONS = ['Complet', 'Parțial', 'Nemobilat'] as const;
const HEATING_SYSTEM_OPTIONS = ['Centrală proprie', 'Termoficare', 'Încălzire în pardoseală'] as const;
const PARKING_OPTIONS = ['Garaj', 'Loc exterior', 'Subteran', 'Fără'] as const;
const BUILDING_STATE_OPTIONS = ['Nouă', 'Reabilitată', 'Bună', 'Necesită renovare'] as const;
const SEISMIC_RISK_OPTIONS = ['Clasa 1', 'Clasa 2', 'Clasa 3', 'Clasa 4', 'Nespecificat'] as const;
const BALCONY_OPTIONS = ['Balcon', 'Terasă', 'Balcon francez', 'Fără'] as const;
const KITCHEN_OPTIONS = ['Deschisă', 'Închisă', 'Chicinetă'] as const;
const LIFT_OPTIONS = ['Da', 'Nu'] as const;
const ORIENTATION_OPTIONS = ['Nord', 'Sud', 'Est', 'Vest', 'NV', 'NE', 'SV', 'SE'] as const;
const STATUS_OPTIONS = ['Activ', 'Inactiv', 'Rezervat', 'Vândut', 'Închiriat'] as const;
const SALES_SCORE_OPTIONS = ['Scăzut', 'Mediu', 'Ridicată'] as const;
const COMMISSION_TYPE_OPTIONS = ['percentage', 'fixed'] as const;

const normalizeText = (value?: string | null) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .trim();

const pickAllowedValue = (
  value: string | null | undefined,
  allowedValues: readonly string[],
  aliases: Record<string, string> = {}
) => {
  if (!value) {
    return '';
  }

  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return '';
  }

  const directMatch = allowedValues.find((option) => normalizeText(option) === normalizedValue);
  if (directMatch) {
    return directMatch;
  }

  const aliasedOption = aliases[normalizedValue];
  if (!aliasedOption) {
    return '';
  }

  return allowedValues.find((option) => option === aliasedOption) || '';
};

const pickAllowedOrOriginalValue = (
  value: string | null | undefined,
  allowedValues: readonly string[],
  aliases: Record<string, string> = {}
) => {
  const matched = pickAllowedValue(value, allowedValues, aliases);
  if (matched) {
    return matched;
  }

  return typeof value === 'string' ? value.trim() : '';
};

const needsLegacyOption = (value: string | null | undefined, allowedValues: readonly string[]) => {
  if (!value) {
    return false;
  }

  return !allowedValues.some((option) => option === value);
};

const normalizeCityValue = (value?: string | null) =>
  pickAllowedValue(value, Object.keys(locations) as City[], {
    bucuresti: 'Bucuresti-Ilfov',
    bucurestiilfov: 'Bucuresti-Ilfov',
    bucurestiiflov: 'Bucuresti-Ilfov',
    bucurestiifov: 'Bucuresti-Ilfov',
  });

const normalizeZoneValue = (value?: string | null, city?: string | null) => {
  if (!value) {
    return '';
  }

  const normalizedValue = normalizeText(value);
  const cityKey = normalizeCityValue(city);
  const zonesForCity = cityKey ? locations[cityKey as City] || [] : [];
  const directZoneMatch =
    zonesForCity.find((zone) => normalizeText(zone) === normalizedValue) ||
    Object.values(locations).flat().find((zone) => normalizeText(zone) === normalizedValue);

  return directZoneMatch || value;
};

const deriveCityZoneFromLocation = (location?: string | null) => {
  if (!location) {
    return { city: '', zone: '' };
  }

  const parts = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const detectedCity =
    parts
      .slice()
      .reverse()
      .map((part) => normalizeCityValue(part))
      .find(Boolean) || '';

  const detectedZone =
    parts
      .map((part) => normalizeZoneValue(part, detectedCity))
      .find((part) => !!part && part !== detectedCity) || '';

  return { city: detectedCity, zone: detectedZone };
};

const inferPropertyType = (propertyData: Property) => {
  const record = propertyData as unknown as Record<string, unknown>;
  const explicitValue =
    (record.propertyType as string | undefined) ||
    (record.type as string | undefined) ||
    (record.category as string | undefined) ||
    (record.propertyCategory as string | undefined);

  const explicitMatch = pickAllowedValue(explicitValue, PROPERTY_TYPE_OPTIONS, {
    casa: 'Casă/Vilă',
    vila: 'Casă/Vilă',
    casavila: 'Casă/Vilă',
    garsoniera: 'Garsonieră',
    spatiucomercial: 'Spațiu Comercial',
  });

  if (explicitMatch) {
    return explicitMatch;
  }

  const searchable = [propertyData.title, propertyData.description, propertyData.tagline, propertyData.keyFeatures]
    .filter(Boolean)
    .join(' ');
  const normalized = normalizeText(searchable);

  if (normalized.includes('garsoniera') || normalized.includes('studio')) {
    return 'Garsonieră';
  }
  if (normalized.includes('teren') || normalized.includes('lot')) {
    return 'Teren';
  }
  if (normalized.includes('spatiucomercial') || normalized.includes('spatiubirouri') || normalized.includes('birou') || normalized.includes('comercial')) {
    return 'Spațiu Comercial';
  }
  if (normalized.includes('casa') || normalized.includes('vila') || normalized.includes('duplex') || normalized.includes('triplex')) {
    return 'Casă/Vilă';
  }
  if ((propertyData.rooms || 0) > 0) {
    return 'Apartament';
  }

  return '';
};

const inferTransactionType = (propertyData: Property) => {
  const record = propertyData as unknown as Record<string, unknown>;
  const explicitValue =
    (record.transactionType as string | undefined) ||
    (record.listingType as string | undefined) ||
    (record.transaction as string | undefined) ||
    (record.offerType as string | undefined) ||
    (record.contractType as string | undefined);

  const explicitMatch = pickAllowedValue(explicitValue, TRANSACTION_TYPE_OPTIONS, {
    vanzare: 'Vânzare',
    inchiriere: 'Închiriere',
    chirie: 'Închiriere',
  });

  if (explicitMatch) {
    return explicitMatch;
  }

  if (propertyData.status === 'Închiriat') {
    return 'Închiriere';
  }

  const searchable = [propertyData.title, propertyData.description, propertyData.tagline]
    .filter(Boolean)
    .join(' ');
  const normalized = normalizeText(searchable);

  if (normalized.includes('inchiri') || normalized.includes('chirie') || normalized.includes('deinchiriat')) {
    return 'Închiriere';
  }

  return 'Vânzare';
};

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
  
  buildingState: z.string().optional(),
  seismicRisk: z.string().optional(),
  balconyTerrace: z.string().optional(),
  partitioning: z.string().optional(),
  kitchen: z.string().optional(),
  lift: z.string().optional(),
  nearMetro: z.boolean().default(false),

  commissionType: z.string().optional(),
  commissionValue: z.coerce.number().optional(),
});

type PropertyFormValues = z.infer<typeof propertySchema>;

const getEmptyPropertyFormValues = (userId?: string): PropertyFormValues => ({
  title: '',
  propertyType: '',
  transactionType: 'Vânzare',
  address: '',
  city: '',
  zone: '',
  price: 0,
  rooms: 0,
  bathrooms: 0,
  squareFootage: 0,
  totalSurface: '',
  constructionYear: '',
  floor: '',
  totalFloors: '',
  orientation: '',
  comfort: '',
  interiorState: '',
  furnishing: '',
  heatingSystem: '',
  parking: '',
  keyFeatures: '',
  description: '',
  status: 'Activ',
  featured: false,
  ownerName: '',
  ownerPhone: '',
  salesScore: 'Mediu',
  agentId: userId || 'unassigned',
  buildingState: '',
  seismicRisk: '',
  balconyTerrace: '',
  partitioning: '',
  kitchen: '',
  lift: '',
  nearMetro: false,
  commissionType: 'percentage',
  commissionValue: undefined,
});

const getPropertyFormValues = (propertyData: Property | null, userId?: string): PropertyFormValues => {
  if (!propertyData) {
    return getEmptyPropertyFormValues(userId);
  }

  const fallbackLocation = deriveCityZoneFromLocation(propertyData.location);
  const normalizedCity = normalizeCityValue(propertyData.city) || fallbackLocation.city;
  const normalizedZone =
    normalizeZoneValue(propertyData.zone, normalizedCity || propertyData.city) || fallbackLocation.zone || '';

  return {
    title: propertyData.title || '',
    propertyType: inferPropertyType(propertyData),
    transactionType: inferTransactionType(propertyData),
    address: propertyData.address || '',
    city: normalizedCity || '',
    zone: normalizedZone,
    price: propertyData.price || 0,
    rooms: propertyData.rooms || 0,
    bathrooms: propertyData.bathrooms || 0,
    squareFootage: propertyData.squareFootage || 0,
    totalSurface: propertyData.totalSurface || '',
    constructionYear: propertyData.constructionYear || '',
    floor: propertyData.floor || '',
    totalFloors: propertyData.totalFloors || '',
    orientation: pickAllowedOrOriginalValue(propertyData.orientation, ORIENTATION_OPTIONS),
    comfort: pickAllowedOrOriginalValue(propertyData.comfort, COMFORT_OPTIONS),
    interiorState: pickAllowedOrOriginalValue(propertyData.interiorState, INTERIOR_STATE_OPTIONS, {
      buna: 'Bună',
    }),
    furnishing: pickAllowedOrOriginalValue(propertyData.furnishing, FURNISHING_OPTIONS, {
      partial: 'Parțial',
      mobilatcomplet: 'Complet',
      completmobilat: 'Complet',
      fara: 'Nemobilat',
      nemobilata: 'Nemobilat',
      nemobilat: 'Nemobilat',
    }),
    heatingSystem: pickAllowedOrOriginalValue(propertyData.heatingSystem, HEATING_SYSTEM_OPTIONS, {
      centralaproprie: 'Centrală proprie',
      centrala: 'Centrală proprie',
      incalzireinpardoseala: 'Încălzire în pardoseală',
    }),
    parking: pickAllowedOrOriginalValue(propertyData.parking, PARKING_OPTIONS, {
      locexterior: 'Loc exterior',
      fara: 'Fără',
    }),
    keyFeatures: propertyData.keyFeatures || propertyData.amenities?.join(', ') || '',
    description: propertyData.description || '',
    status:
      pickAllowedOrOriginalValue(propertyData.status, STATUS_OPTIONS, {
        vandut: 'Vândut',
        inchiriat: 'Închiriat',
      }) || 'Activ',
    featured: propertyData.featured || false,
    ownerName: propertyData.ownerName || '',
    ownerPhone: propertyData.ownerPhone || '',
    salesScore:
      pickAllowedOrOriginalValue(propertyData.salesScore, SALES_SCORE_OPTIONS, {
        scazut: 'Scăzut',
        ridicat: 'Ridicată',
        ridicata: 'Ridicată',
        mare: 'Ridicată',
        mic: 'Scăzut',
      }) || 'Mediu',
    agentId: propertyData.agentId || userId || 'unassigned',
    buildingState: pickAllowedOrOriginalValue(propertyData.buildingState, BUILDING_STATE_OPTIONS, {
      noua: 'Nouă',
      reabilitata: 'Reabilitată',
      buna: 'Bună',
      necesitarenovare: 'Necesită renovare',
    }),
    seismicRisk: pickAllowedOrOriginalValue(propertyData.seismicRisk, SEISMIC_RISK_OPTIONS, {
      clasai: 'Clasa 1',
      clasaii: 'Clasa 2',
      clasaiii: 'Clasa 3',
      clasaiv: 'Clasa 4',
    }),
    balconyTerrace: pickAllowedOrOriginalValue(propertyData.balconyTerrace, BALCONY_OPTIONS, {
      terasa: 'Terasă',
      fara: 'Fără',
    }),
    partitioning: pickAllowedOrOriginalValue(propertyData.partitioning, PARTITIONING_OPTIONS, {
      semidecomandat: 'Semidecomandat',
      nedecomandat: 'Nedecomandat',
    }),
    kitchen: pickAllowedOrOriginalValue(propertyData.kitchen, KITCHEN_OPTIONS, {
      deschisa: 'Deschisă',
      inchisa: 'Închisă',
      chicineta: 'Chicinetă',
    }),
    lift: pickAllowedOrOriginalValue(propertyData.lift, LIFT_OPTIONS, {
      yes: 'Da',
      no: 'Nu',
      true: 'Da',
      false: 'Nu',
    }),
    nearMetro: propertyData.nearMetro || false,
    commissionType: pickAllowedValue(propertyData.commissionType, COMMISSION_TYPE_OPTIONS) || 'percentage',
    commissionValue: propertyData.commissionValue,
  };
};

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

function SortableImage({ id, src, onRemove }: { id: string; src: string; onRemove: () => void; }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative aspect-square group touch-none">
      <Image src={src} alt={`Preview`} fill sizes="128px" className="object-cover rounded-xl" />
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.preventDefault(); // prevent dnd listeners from firing
          onRemove();
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PropertyForm({ propertyData, onClose, isMobile }: { propertyData: Property | null; onClose: () => void; isMobile: boolean }) {
    const { toast } = useToast();
    const { user } = useUser();
    const { agency, agencyId } = useAgency();
    const firestore = useFirestore();
    const storage = useStorage();
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [imageSources, setImageSources] = useState<ImageSource[]>([]);
    const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
    const [isLoadingAddressSuggestions, setIsLoadingAddressSuggestions] = useState(false);
    const [selectedCoordinates, setSelectedCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
    const [selectedAddressLabel, setSelectedAddressLabel] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } })
    );

    const isEditMode = !!propertyData;

    const initialFormValues = useMemo(
        () => getPropertyFormValues(propertyData ?? null, user?.uid),
        [propertyData, user?.uid]
    );

    const form = useForm<PropertyFormValues>({
        resolver: zodResolver(propertySchema),
        defaultValues: initialFormValues,
        values: initialFormValues,
    });

    const watchedCity = form.watch('city') as City;
    const watchedZone = form.watch('zone');
    const watchedAddress = form.watch('address');
    const availableZones = (watchedCity && locations[watchedCity]) ? locations[watchedCity].sort() : [];
    const watchedCommissionType = form.watch('commissionType', isEditMode ? propertyData?.commissionType : 'percentage');
    
    useEffect(() => {
        if (!watchedCity || !isEditMode || !propertyData) {
            return;
        }

        const fallbackLocation = deriveCityZoneFromLocation(propertyData.location);
        const initialCity = normalizeCityValue(propertyData.city) || fallbackLocation.city;
        if (initialCity && initialCity !== watchedCity) {
            form.setValue('zone', '');
        }
    }, [watchedCity, form, isEditMode, propertyData]);

    useEffect(() => {
        if (!isEditMode || !propertyData) {
            return;
        }

        form.reset(initialFormValues);
    }, [form, initialFormValues, isEditMode, propertyData]);

    useEffect(() => {
        if (isEditMode && propertyData) {
            const fallbackLocation = deriveCityZoneFromLocation(propertyData.location);
            const normalizedCity = normalizeCityValue(propertyData.city) || fallbackLocation.city;
            const normalizedZone = normalizeZoneValue(propertyData.zone, normalizedCity || propertyData.city) || fallbackLocation.zone || '';
            form.reset({
                title: propertyData.title || '',
                propertyType: inferPropertyType(propertyData),
                transactionType: inferTransactionType(propertyData),
                address: propertyData.address || '',
                city: normalizedCity || '',
                zone: normalizedZone,
                price: propertyData.price || 0,
                rooms: propertyData.rooms || 0,
                bathrooms: propertyData.bathrooms || 0,
                squareFootage: propertyData.squareFootage || 0,
                totalSurface: propertyData.totalSurface || '',
                constructionYear: propertyData.constructionYear || '',
                floor: propertyData.floor || '',
                totalFloors: propertyData.totalFloors || '',
                orientation: pickAllowedOrOriginalValue(propertyData.orientation, ORIENTATION_OPTIONS),
                comfort: pickAllowedOrOriginalValue(propertyData.comfort, COMFORT_OPTIONS),
                interiorState: pickAllowedOrOriginalValue(propertyData.interiorState, INTERIOR_STATE_OPTIONS, {
                    buna: 'Bună',
                }),
                furnishing: pickAllowedOrOriginalValue(propertyData.furnishing, FURNISHING_OPTIONS, {
                    partial: 'Parțial',
                    mobilatcomplet: 'Complet',
                    completmobilat: 'Complet',
                    fara: 'Nemobilat',
                    nemobilata: 'Nemobilat',
                    nemobilat: 'Nemobilat',
                }),
                heatingSystem: pickAllowedOrOriginalValue(propertyData.heatingSystem, HEATING_SYSTEM_OPTIONS, {
                    centralaproprie: 'Centrală proprie',
                    centrala: 'Centrală proprie',
                    incalzireinpardoseala: 'Încălzire în pardoseală',
                }),
                parking: pickAllowedOrOriginalValue(propertyData.parking, PARKING_OPTIONS, {
                    locexterior: 'Loc exterior',
                    fara: 'Fără',
                }),
                keyFeatures: propertyData.keyFeatures || propertyData.amenities?.join(', ') || '',
                description: propertyData.description || '',
                status: pickAllowedOrOriginalValue(propertyData.status, STATUS_OPTIONS, {
                    vandut: 'Vândut',
                    inchiriat: 'Închiriat',
                }) || 'Activ',
                featured: propertyData.featured || false,
                ownerName: propertyData.ownerName || '',
                ownerPhone: propertyData.ownerPhone || '',
                salesScore: pickAllowedOrOriginalValue(propertyData.salesScore, SALES_SCORE_OPTIONS, {
                    scazut: 'Scăzut',
                    ridicat: 'Ridicată',
                    ridicata: 'Ridicată',
                    mare: 'Ridicată',
                    mic: 'Scăzut',
                }) || 'Mediu',
                agentId: propertyData.agentId || user?.uid || 'unassigned',
                buildingState: pickAllowedOrOriginalValue(propertyData.buildingState, BUILDING_STATE_OPTIONS, {
                    noua: 'Nouă',
                    reabilitata: 'Reabilitată',
                    buna: 'Bună',
                    necesitarenovare: 'Necesită renovare',
                }),
                seismicRisk: pickAllowedOrOriginalValue(propertyData.seismicRisk, SEISMIC_RISK_OPTIONS, {
                    clasai: 'Clasa 1',
                    clasaii: 'Clasa 2',
                    clasaiii: 'Clasa 3',
                    clasaiv: 'Clasa 4',
                }),
                balconyTerrace: pickAllowedOrOriginalValue(propertyData.balconyTerrace, BALCONY_OPTIONS, {
                    terasa: 'Terasă',
                    fara: 'Fără',
                }),
                partitioning: pickAllowedOrOriginalValue(propertyData.partitioning, PARTITIONING_OPTIONS, {
                    semi: 'Semidecomandat',
                }),
                kitchen: pickAllowedOrOriginalValue(propertyData.kitchen, KITCHEN_OPTIONS, {
                    deschisa: 'Deschisă',
                    inchisa: 'Închisă',
                }),
                lift: pickAllowedOrOriginalValue(propertyData.lift, LIFT_OPTIONS, {
                    yes: 'Da',
                    no: 'Nu',
                }),
                nearMetro: propertyData.nearMetro || false,
                commissionType: pickAllowedValue(propertyData.commissionType, COMMISSION_TYPE_OPTIONS) || 'percentage',
                commissionValue: propertyData.commissionValue ?? 2,
            });
            setImageSources(propertyData.images || []);
            setSelectedCoordinates(
              typeof propertyData.latitude === 'number' && typeof propertyData.longitude === 'number'
                ? { latitude: propertyData.latitude, longitude: propertyData.longitude }
                : null
            );
            setSelectedAddressLabel(propertyData.address || '');
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
            setSelectedCoordinates(null);
            setSelectedAddressLabel('');
        }
    }, [form, isEditMode, propertyData, user?.uid]);
    
    const imageItems = useMemo(() => imageSources.map((source, index) => {
        const id = source instanceof File ? `${source.name}-${source.lastModified}-${index}` : source.url;
        const url = source instanceof File ? URL.createObjectURL(source) : source.url;
        return { id, url };
    }), [imageSources]);

    useEffect(() => {
        return () => {
            imageItems.forEach(item => {
                if (item.url.startsWith('blob:')) {
                    URL.revokeObjectURL(item.url);
                }
            });
        };
    }, [imageItems]);

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

    useEffect(() => {
        const normalizedAddress = (watchedAddress || '').trim();
        const hasEnoughContext = normalizedAddress.length >= 4 && (!!watchedCity || !!watchedZone);

        if (!normalizedAddress || (!hasEnoughContext && normalizedAddress.length < 6)) {
            setAddressSuggestions([]);
            setIsLoadingAddressSuggestions(false);
            return;
        }

        if (selectedAddressLabel && normalizedAddress === selectedAddressLabel && selectedCoordinates) {
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(async () => {
            try {
                setIsLoadingAddressSuggestions(true);
                const searchUrl = new URL('/api/geocode-search', window.location.origin);
                searchUrl.searchParams.set('address', normalizedAddress);
                if (watchedZone) {
                    searchUrl.searchParams.set('zone', watchedZone);
                }
                if (watchedCity) {
                    searchUrl.searchParams.set('city', watchedCity);
                }

                const response = await fetch(searchUrl.toString(), {
                    cache: 'no-store',
                    signal: controller.signal,
                });
                const payload = (await response.json()) as
                    | AddressSuggestion[]
                    | { suggestions?: AddressSuggestion[] };
                const rawSuggestions = Array.isArray(payload) ? payload : payload.suggestions || [];
                const normalizedSuggestions = rawSuggestions.filter(
                    (suggestion) =>
                        suggestion?.label &&
                        Number.isFinite(suggestion.latitude) &&
                        Number.isFinite(suggestion.longitude)
                );
                setAddressSuggestions(normalizedSuggestions);
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Address suggestions failed:', error);
                }
            } finally {
                setIsLoadingAddressSuggestions(false);
            }
        }, 350);

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [selectedAddressLabel, selectedCoordinates, watchedAddress, watchedCity, watchedZone]);

    const handleSelectAddressSuggestion = (suggestion: AddressSuggestion) => {
        const nextAddressValue = suggestion.addressLine || suggestion.label;
        form.setValue('address', nextAddressValue, { shouldValidate: true, shouldDirty: true });
        if (suggestion.city) {
            const normalizedCity = normalizeCityValue(suggestion.city) || suggestion.city;
            form.setValue('city', normalizedCity, { shouldValidate: true, shouldDirty: true });
        }
        if (suggestion.zone) {
            const nextCity = suggestion.city || form.getValues('city');
            const normalizedZone = normalizeZoneValue(suggestion.zone, nextCity) || suggestion.zone;
            form.setValue('zone', normalizedZone, { shouldValidate: true, shouldDirty: true });
        }
        setSelectedCoordinates({
            latitude: suggestion.latitude,
            longitude: suggestion.longitude,
        });
        setSelectedAddressLabel(nextAddressValue);
        setAddressSuggestions([]);
    };

    const mapPreviewProperty = useMemo(() => {
        if (!selectedCoordinates) return null;

        return {
            id: 'preview-location',
            title: form.getValues('title') || 'Previzualizare locatie',
            address: watchedAddress || selectedAddressLabel || 'Adresa selectata',
            location: [watchedZone, watchedCity].filter(Boolean).join(', '),
            price: 0,
            rooms: 0,
            bathrooms: 0,
            squareFootage: 0,
            images: [],
            propertyType: 'Preview',
            transactionType: 'Preview',
            latitude: selectedCoordinates.latitude,
            longitude: selectedCoordinates.longitude,
        } as Property;
    }, [form, selectedAddressLabel, selectedCoordinates, watchedAddress, watchedCity, watchedZone]);

    const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        const newFiles = Array.from(files);
        setImageSources((prevSources) => {
          const updatedSources = [...prevSources, ...newFiles];
          return updatedSources.slice(0, 16);
        });
      }
      // Reset file input to allow re-selecting the same file(s)
      if (event.target) {
        event.target.value = '';
      }
    };

    const removeImage = (index: number) => {
        setImageSources((prev) => prev.filter((_, i) => i !== index));
    };

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setImageSources((items) => {
                const oldIndex = imageItems.findIndex(item => item.id === active.id);
                const newIndex = imageItems.findIndex(item => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }


    async function handleGenerateDescription() {
        setIsGenerating(true);
        const values = form.getValues();
        
        try {
            const result = await generatePropertyDescription({
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
                constructionYear: values.constructionYear ? Number(values.constructionYear) : undefined,
                keyFeatures: values.keyFeatures,
                description: values.description,
            });
            
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

          let latitude: number | null = selectedCoordinates?.latitude ?? null;
          let longitude: number | null = selectedCoordinates?.longitude ?? null;

          if (latitude == null || longitude == null) {
          try {
              const geocodeUrl = new URL('/api/geocode', window.location.origin);
              geocodeUrl.searchParams.set('address', values.address || '');
              if (values.zone) {
                  geocodeUrl.searchParams.set('zone', values.zone);
              }
              if (values.city) {
                  geocodeUrl.searchParams.set('city', values.city);
              }

              const geocodeResponse = await fetch(geocodeUrl.toString(), { cache: 'no-store' });
              if (geocodeResponse.ok) {
                  const geocodeResult = await geocodeResponse.json() as { latitude?: number; longitude?: number };
                  if (typeof geocodeResult.latitude === 'number' && typeof geocodeResult.longitude === 'number') {
                      latitude = geocodeResult.latitude;
                      longitude = geocodeResult.longitude;
                  }
              } else {
                  console.warn('Geocoding failed for property address:', await geocodeResponse.text());
              }
          } catch (geocodeError) {
              console.error('Geocoding request failed:', geocodeError);
          }
          }

          const propertyDataToSave = {
              title: values.title,
              propertyType: values.propertyType,
              transactionType: values.transactionType,
              address: values.address,
              city: values.city,
              zone: values.zone,
              latitude,
              longitude,
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
              agent: selectedAgent
                ? {
                    name: selectedAgent.name,
                    avatarUrl: selectedAgent.photoUrl || '',
                  }
                : null,
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
  
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-rows-[1fr_auto] h-full">
                <div className={cn("overflow-y-auto", isMobile ? "p-4 space-y-6" : "p-6")}>
                    
                    {!isMobile && (
                         <Card className="shadow-2xl rounded-2xl mb-8 bg-[#152A47] border-2 border-dashed border-primary/50 text-white">
                            <CardContent className="p-6">
                                <div className="mb-4 text-center">
                                    <FormLabel className="text-xl font-semibold mb-2 block text-primary">Fotografii (max 16)</FormLabel>
                                    <FormDescription className="text-lg text-white/70 !mt-2">Prima imagine va fi cea de copertă. Trageți pentru a reordona.</FormDescription>
                                </div>
                                <ScrollArea className="w-full whitespace-nowrap rounded-lg">
                                    <div className="flex items-center w-max space-x-4 pb-4">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={imageItems.map(item => item.id)} strategy={rectSortingStrategy}>
                                                {imageItems.map((item, index) => (
                                                    <div className="w-40 h-40" key={item.id}>
                                                        <SortableImage id={item.id} src={item.url} onRemove={() => removeImage(index)} />
                                                    </div>
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                        {imageItems.length < 16 && (
                                           <label className="flex flex-col items-center justify-center text-center w-40 h-40 shrink-0 rounded-2xl cursor-pointer bg-[#0F1E33] border-2 border-dashed border-white/20 hover:bg-[#0F1E33]/70 text-white transition-colors shadow-lg">
                                                <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleImageChange} />
                                                <div className="flex flex-col items-center justify-center">
                                                    <Upload className="w-8 h-8 mb-2 text-white/70" />
                                                    <p className="text-sm font-semibold">Încarcă</p>
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}
                    {isMobile && (
                         <Card className={"shadow-xl rounded-2xl mb-8 bg-[#152A47] border-none text-white"}>
                            <CardContent className={"p-4 pt-6 space-y-4"}>
                                <div className={cn('mb-4 text-center')}>
                                    <FormLabel className={cn("font-semibold mb-2 block", "text-white/80")}>Fotografii (max 16)</FormLabel>
                                    <FormDescription className={cn("text-white/70 !mt-2")}>Prima imagine va fi cea de copertă. Trageți pentru a reordona.</FormDescription>
                                </div>
                                <ScrollArea className="w-full whitespace-nowrap rounded-lg">
                                    <div className="flex items-center w-max space-x-4 pb-4">
                                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                            <SortableContext items={imageItems.map(item => item.id)} strategy={rectSortingStrategy}>
                                                {imageItems.map((item, index) => (
                                                    <div className="w-40 h-40" key={item.id}>
                                                        <SortableImage id={item.id} src={item.url} onRemove={() => removeImage(index)} />
                                                    </div>
                                                ))}
                                            </SortableContext>
                                        </DndContext>
                                        {imageItems.length < 16 && (
                                            <label className="flex flex-col items-center justify-center text-center w-40 h-40 shrink-0 rounded-2xl cursor-pointer bg-[#0F1E33] border-2 border-dashed border-white/20 hover:bg-[#0F1E33]/70 text-white transition-colors shadow-lg">
                                                <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/png, image/jpeg" onChange={handleImageChange} />
                                                <div className="flex flex-col items-center justify-center">
                                                    <Upload className="w-8 h-8 mb-2 text-white/70" />
                                                    <p className="text-sm font-semibold">Încarcă</p>
                                                </div>
                                            </label>
                                        )}
                                    </div>
                                    <ScrollBar orientation="horizontal" />
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    )}

                    <div className={cn("grid grid-cols-1 gap-8", !isMobile && "md:grid-cols-2")}>
                         <div className={cn(isMobile ? "space-y-6" : "space-y-8")}>
                             <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                                <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                    <h3 className="text-lg font-semibold text-primary">Detalii Principale</h3>
                                    <FormField control={form.control} name="title" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Titlu Anunț *</FormLabel><FormControl><Input className="text-base md:text-sm bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: Vilă superbă cu piscină în Pipera" /></FormControl><FormMessage /></FormItem> )} />
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="propertyType" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Tip Proprietate *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                            <SelectContent>{needsLegacyOption(field.value, PROPERTY_TYPE_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Apartament">Apartament</SelectItem><SelectItem value="Casă/Vilă">Casă/Vilă</SelectItem><SelectItem value="Garsonieră">Garsonieră</SelectItem><SelectItem value="Teren">Teren</SelectItem><SelectItem value="Spațiu Comercial">Spațiu Comercial</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="transactionType" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Tip Tranzacție *</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                            <SelectContent>{needsLegacyOption(field.value, TRANSACTION_TYPE_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Vânzare">Vânzare</SelectItem><SelectItem value="Închiriere">Închiriere</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                        <FormField control={form.control} name="price" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Preț (€) *</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: 350000" /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                </CardContent>
                            </Card>
                            
                             <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                                <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                     <h3 className="text-lg font-semibold text-primary">Locație</h3>
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                         <FormField control={form.control} name="city" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Oraș *</FormLabel>
                                             <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="ex: Bucuresti-Ilfov" /></SelectTrigger></FormControl>
                                             <SelectContent>{field.value && !Object.keys(locations).includes(field.value) && <SelectItem value={field.value}>{field.value}</SelectItem>}{Object.keys(locations).map(city => <SelectItem key={city} value={city}>{city.replace('-', ' - ')}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                         <FormField control={form.control} name="zone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Zonă</FormLabel>
                                             <Select onValueChange={field.onChange} value={field.value} disabled={!watchedCity}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="ex: Herăstrău" /></SelectTrigger></FormControl>
                                            <SelectContent>{field.value && !availableZones.includes(field.value) && <SelectItem value={field.value}>{field.value}</SelectItem>}{availableZones.map(zone => <SelectItem key={zone} value={zone}>{zone}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                                         <FormField control={form.control} name="address" render={({ field }) => (
                                            <FormItem className="md:col-span-3">
                                                <FormLabel className="text-white/80">Adresă *</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
                                                        {...field}
                                                        placeholder="Scrie strada si numarul, apoi alege adresa din lista"
                                                        onChange={(event) => {
                                                            field.onChange(event);
                                                            setSelectedCoordinates(null);
                                                            setSelectedAddressLabel('');
                                                        }}
                                                    />
                                                </FormControl>
                                                {isLoadingAddressSuggestions ? (
                                                    <div className="mt-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/70">
                                                        Cautam adrese relevante...
                                                    </div>
                                                ) : null}
                                                {addressSuggestions.length > 0 ? (
                                                    <div className="mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[#0f1e33]">
                                                        {addressSuggestions.map((suggestion) => (
                                                            <button
                                                                key={`${suggestion.label}-${suggestion.latitude}-${suggestion.longitude}`}
                                                                type="button"
                                                                className="flex w-full items-start gap-3 border-b border-white/5 px-4 py-3 text-left text-sm text-white/85 transition-colors last:border-b-0 hover:bg-white/5"
                                                                onClick={() => handleSelectAddressSuggestion(suggestion)}
                                                            >
                                                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                                                <span>{suggestion.label}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                <FormDescription className="text-white/55">
                                                    Alege o adresa din lista pentru a fixa exact locatia pe harta.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                         )} />
                                     </div>
                                     <div className="space-y-3 pt-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-white/80">Previzualizare pe harta</p>
                                            <p className="text-xs text-white/55">
                                                {selectedCoordinates ? 'Locatia selectata va fi salvata exact asa.' : 'Selecteaza o adresa din lista pentru a vedea locatia exacta.'}
                                            </p>
                                        </div>
                                        <div className="h-72 overflow-hidden rounded-[1.5rem] border border-white/10">
                                            {mapPreviewProperty ? (
                                                <PropertiesMap properties={[mapPreviewProperty]} />
                                            ) : (
                                                <div className="flex h-full items-center justify-center bg-[#0f1e33] px-6 text-center text-sm text-white/60">
                                                    Harta va afisa locatia exacta dupa ce selectezi o adresa din lista de sugestii.
                                                </div>
                                            )}
                                        </div>
                                     </div>
                                     <div className="flex items-center space-x-2 pt-2">
                                         <FormField control={form.control} name="nearMetro" render={({ field }) => (
                                             <FormItem className="flex items-center gap-2">
                                                 <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} id="near-metro-checkbox" className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"/></FormControl>
                                                 <FormLabel htmlFor="near-metro-checkbox" className="!mt-0 text-white/80">Aproape de metrou</FormLabel>
                                             </FormItem>
                                         )}/>
                                     </div>
                                 </CardContent>
                             </Card>
                            <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                               <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                   <h3 className="text-lg font-semibold text-primary">Descriere</h3>
                                   <FormField
                                        control={form.control}
                                        name="keyFeatures"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-white/80">Caracteristici Cheie pentru AI *</FormLabel>
                                            <FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: piscină, renovat modern, centrală proprie" /></FormControl>
                                            <FormDescription className="text-white/70">Acestea sunt cele mai importante informații pentru generarea descrierii.</FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="description"
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="flex items-center justify-between text-white/80">
                                            <span>Descriere Anunț</span>
                                            <Button type="button" variant="ghost" size="sm" onClick={handleGenerateDescription} disabled={isGenerating}>
                                                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                Generează cu AI
                                            </Button>
                                            </FormLabel>
                                            <FormControl>
                                            <Textarea className="bg-white/10 border-white/20 text-white placeholder:text-white/50 lg:h-[454px]" {...field} placeholder="Descrieți proprietatea în detaliu sau lăsați AI-ul să o facă pentru dumneavoastră..." />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </CardContent>
                             </Card>
                             
                        </div>
                        <div className={cn(isMobile ? "space-y-6" : "space-y-8")}>
                             <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                                <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                    <h3 className="text-lg font-semibold text-primary">Specificații</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <FormField control={form.control} name="squareFootage" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Suprafață Utilă</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: 120" /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="totalSurface" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Suprafață cu Balcon</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: 140" /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="rooms" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nr. Camere *</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="bathrooms" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nr. Băi *</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="constructionYear" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">An Construcție</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: 2021" /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="floor" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Etaj</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: 3"/></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="totalFloors" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Total Etaje</FormLabel><FormControl><Input type="number" className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} placeholder="ex: 10" /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="partitioning" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Compartimentare</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl>
                                            <SelectContent>{needsLegacyOption(field.value, PARTITIONING_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Decomandat">Decomandat</SelectItem><SelectItem value="Semidecomandat">Semidecomandat</SelectItem><SelectItem value="Circular">Circular</SelectItem><SelectItem value="Nedecomandat">Nedecomandat</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                                    </div>
                                </CardContent>
                            </Card>
                            
                            <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                                <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                    <h3 className="text-lg font-semibold text-primary">Dotări & Finisaje</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <FormField control={form.control} name="comfort" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Confort</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, COMFORT_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Lux">Lux</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="interiorState" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Stare Interior</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, INTERIOR_STATE_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Nou">Nou</SelectItem><SelectItem value="Renovat">Renovat</SelectItem><SelectItem value="Bună">Bună</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="furnishing" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Stare Mobilier</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, FURNISHING_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Complet">Complet</SelectItem><SelectItem value="Parțial">Parțial</SelectItem><SelectItem value="Nemobilat">Nemobilat</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="heatingSystem" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Sistem Încălzire</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, HEATING_SYSTEM_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Centrală proprie">Centrală proprie</SelectItem><SelectItem value="Termoficare">Termoficare</SelectItem><SelectItem value="Încălzire în pardoseală">Încălzire în pardoseală</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="parking" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Parcare</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, PARKING_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Garaj">Garaj</SelectItem><SelectItem value="Loc exterior">Loc exterior</SelectItem><SelectItem value="Subteran">Subteran</SelectItem><SelectItem value="Fără">Fără</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="buildingState" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Stare Clădire</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, BUILDING_STATE_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Nouă">Nouă</SelectItem><SelectItem value="Reabilitată">Reabilitată</SelectItem><SelectItem value="Bună">Bună</SelectItem><SelectItem value="Necesită renovare">Necesită renovare</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="seismicRisk" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Risc Seismic</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, SEISMIC_RISK_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Clasa 1">Clasa 1</SelectItem><SelectItem value="Clasa 2">Clasa 2</SelectItem><SelectItem value="Clasa 3">Clasa 3</SelectItem><SelectItem value="Clasa 4">Clasa 4</SelectItem><SelectItem value="Nespecificat">Nespecificat</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="balconyTerrace" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Balcon/Terasă</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, BALCONY_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Balcon">Balcon</SelectItem><SelectItem value="Terasă">Terasă</SelectItem><SelectItem value="Balcon francez">Balcon francez</SelectItem><SelectItem value="Fără">Fără</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="kitchen" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Bucătărie</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, KITCHEN_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Deschisă">Deschisă</SelectItem><SelectItem value="Închisă">Închisă</SelectItem><SelectItem value="Chicinetă">Chicinetă</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="lift" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Lift</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, LIFT_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Da">Da</SelectItem><SelectItem value="Nu">Nu</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="orientation" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Orientare</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, ORIENTATION_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Nord">Nord</SelectItem><SelectItem value="Sud">Sud</SelectItem><SelectItem value="Est">Est</SelectItem><SelectItem value="Vest">Vest</SelectItem><SelectItem value="NV">NV</SelectItem><SelectItem value="NE">NE</SelectItem><SelectItem value="SV">SV</SelectItem><SelectItem value="SE">SE</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                                <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                    <h3 className="text-lg font-semibold text-primary">Detalii Interne</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <FormField control={form.control} name="status" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, STATUS_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Activ">Activ</SelectItem><SelectItem value="Inactiv">Inactiv</SelectItem><SelectItem value="Rezervat">Rezervat</SelectItem><SelectItem value="Vândut">Vândut</SelectItem><SelectItem value="Închiriat">Închiriat</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="agentId" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Agent</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue placeholder="Selectează" /></SelectTrigger></FormControl><SelectContent><SelectItem value="unassigned">Nealocat</SelectItem>{agents.map(agent => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="salesScore" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Potențial Vânzare</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="bg-white/10 border-white/20 text-white"><SelectValue /></SelectTrigger></FormControl><SelectContent>{needsLegacyOption(field.value, SALES_SCORE_OPTIONS) && <SelectItem value={field.value}>{field.value}</SelectItem>}<SelectItem value="Scăzut">Scăzut</SelectItem><SelectItem value="Mediu">Mediu</SelectItem><SelectItem value="Ridicată">Ridicată</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField control={form.control} name="ownerName" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Nume Proprietar</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                        <FormField control={form.control} name="ownerPhone" render={({ field }) => ( <FormItem><FormLabel className="text-white/80">Telefon Proprietar</FormLabel><FormControl><Input className="bg-white/10 border-white/20 text-white placeholder:text-white/50" {...field} /></FormControl><FormMessage /></FormItem> )} />
                                    </div>
                                    <FormField control={form.control} name="featured" render={({ field }) => ( <FormItem className="flex flex-row items-center gap-2 pt-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="border-white/50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"/></FormControl><FormLabel className="!mt-0 text-white/80">Proprietate Recomandată</FormLabel></FormItem> )}/>
                                </CardContent>
                            </Card>
                             <Card className={cn("shadow-xl rounded-2xl", "bg-[#152A47] border-none text-white")}>
                                <CardContent className={cn("space-y-4", "p-4 pt-6")}>
                                    <h3 className="text-lg font-semibold text-primary">Comision</h3>
                                    <FormField
                                        control={form.control}
                                        name="commissionType"
                                        render={({ field }) => (
                                            <FormItem className="space-y-3">
                                            <FormLabel className="text-white/80">Tip Comision</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={field.onChange}
                                                defaultValue={field.value}
                                                className="flex items-center gap-6"
                                                >
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                    <RadioGroupItem value="percentage" className="border-white/50 text-white" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal text-white/80">Procentual (%)</FormLabel>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0">
                                                    <FormControl>
                                                    <RadioGroupItem value="fixed" className="border-white/50 text-white" />
                                                    </FormControl>
                                                    <FormLabel className="font-normal text-white/80">Sumă Fixă (€)</FormLabel>
                                                </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="commissionValue"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormLabel className="text-white/80">
                                                Valoare Comision {watchedCommissionType === 'percentage' ? '(%)' : '(€)'}
                                            </FormLabel>
                                            <FormControl>
                                                <Input type="number" step="any" {...field} className="bg-white/10 border-white/20 text-white placeholder:text-white/50" />
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
                <DialogFooter className="shrink-0 border-t p-3 md:py-3 md:px-6 shadow-md bg-[#0F1E33] border-white/10">
                    <div className="flex justify-end gap-2 w-full">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-white/80 hover:bg-white/10 hover:text-white/90">Anulează</Button>
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
      <DialogContent className={cn(
        "p-0 flex flex-col max-w-full rounded-none border-none bg-[#0F1E33] text-white",
        isMobile ? "h-screen w-screen" : "w-screen h-screen"
      )}>
        <DialogHeader className="shrink-0 border-b p-2 h-14 flex items-center justify-center shadow-md z-10 relative bg-[#0F1E33] border-white/10">
          <DialogTitle className="text-xl text-center text-white/90">{isEditMode ? 'Editează Proprietate' : 'Adaugă Proprietate Nouă'}</DialogTitle>
           <DialogClose className="absolute right-2 top-1/2 -translate-y-1/2" />
        </DialogHeader>
        <div className="flex-1 min-h-0">
            {isOpen && <PropertyForm key={formKey} propertyData={property || null} onClose={() => onOpenChange(false)} isMobile={isMobile} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
