'use client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Contact, Property } from '@/lib/types';
import { Calendar, Clock, MapPin, Edit, DollarSign, User, FileText } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { SourcePropertyCard } from './SourcePropertyCard';
import { Separator } from '@/components/ui/separator';

type LeadInfoCardProps = {
  contact: Contact;
  onEdit: () => void;
  onUpdateContact: (data: Partial<Omit<Contact, 'id'>>) => void;
  sourceProperty: Property | null;
  isSourcePropertyLoading: boolean;
  allProperties: Property[];
};

export function LeadInfoCard({ contact, onEdit, onUpdateContact, sourceProperty, isSourcePropertyLoading, allProperties }: LeadInfoCardProps) {
    const creationDate = contact.createdAt ? new Date(contact.createdAt) : new Date(); // Fallback for demo
    const ageInDays = differenceInDays(new Date(), creationDate);

    const [description, setDescription] = useState(contact.description || '');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setDescription(contact.description || '');
    }, [contact]);

    const handleBlur = () => {
        if (description !== (contact.description || '')) {
            onUpdateContact({ description });
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto'; // Temporarily shrink to get the correct scrollHeight
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [description]);


    let ageBadgeVariant: 'success' | 'warning' | 'destructive' = 'success';
    if (ageInDays > 30) {
        ageBadgeVariant = 'destructive';
    } else if (ageInDays >= 14) {
        ageBadgeVariant = 'warning';
    }

    return (
        <Card className="rounded-2xl shadow-2xl relative bg-[#152A47] border-none text-white">
             <Button variant="ghost" size="icon" onClick={onEdit} className="absolute top-3 right-3 z-10 h-8 w-8 text-white/70 hover:text-white hover:bg-white/10">
                <Edit className="h-4 w-4" />
            </Button>
            <CardContent className="space-y-4 pt-6">
                 <div className="space-y-3">
                    <Button variant="outline" className="w-full justify-start pointer-events-none text-base font-semibold h-auto py-2 bg-white/10 border-white/20 text-white">
                        <User className="mr-3 h-4 w-4 text-white/70" />
                        {contact.name}
                    </Button>
                    {contact.budget ? (
                        <Button variant="outline" className="w-full justify-start border-primary pointer-events-none text-white bg-primary/10">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Buget: €{contact.budget.toLocaleString()}
                        </Button>
                    ) : null}
                    {contact.city ? (
                        <p className="text-sm text-white/70 pt-1 pl-1 flex items-center">
                            <MapPin className="mr-2 h-4 w-4" />
                            {contact.city}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-xs font-normal bg-white/10 border-none text-white">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {new Date(creationDate).toLocaleDateString('ro-RO')}
                    </Badge>
                    <Badge variant={ageBadgeVariant} className="px-3 py-1 text-xs">
                        <Clock className="mr-2 h-3.5 w-3.5" />
                        Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}
                    </Badge>
                </div>
                <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-white/70 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Descriere
                    </h4>
                    <Textarea
                        ref={textareaRef}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        onBlur={handleBlur}
                        placeholder="Adaugă o descriere detaliată a cumpărătorului, preferințe, cerințe speciale, etc."
                        className="text-sm resize-none overflow-hidden bg-white/10 border-white/20 text-white"
                        rows={4}
                    />
                </div>
                 {contact.zones && contact.zones.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-white/70">Zone Preferate</h4>
                        <div className="space-y-1">
                            {contact.zones.map(zone => (
                                <Button 
                                    key={zone} 
                                    variant="outline"
                                    className="pointer-events-none cursor-default bg-white/10 border-white/20 text-white w-full justify-start"
                                >
                                    <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                                    {zone}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
             <div className="hidden lg:block px-4 pb-4">
              <Separator className="mt-0 mb-4 bg-white/10" />
              <SourcePropertyCard 
                  property={sourceProperty} 
                  isLoading={isSourcePropertyLoading}
                  allProperties={allProperties}
                  onUpdateContact={onUpdateContact}
              />
            </div>
        </Card>
    );
}
