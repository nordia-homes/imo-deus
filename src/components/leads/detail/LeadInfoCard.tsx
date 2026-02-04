'use client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { Calendar, Clock, MapPin, Edit, DollarSign } from 'lucide-react';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';

type LeadInfoCardProps = {
  contact: Contact;
  onEdit: () => void;
};

export function LeadInfoCard({ contact, onEdit }: LeadInfoCardProps) {
    const creationDate = contact.createdAt ? new Date(contact.createdAt) : new Date(); // Fallback for demo
    const ageInDays = differenceInDays(new Date(), creationDate);

    let ageBadgeVariant: 'success' | 'warning' | 'destructive' = 'success';
    if (ageInDays > 30) {
        ageBadgeVariant = 'destructive';
    } else if (ageInDays >= 14) {
        ageBadgeVariant = 'warning';
    }

    return (
        <Card className="rounded-2xl shadow-2xl">
            <CardHeader className="flex flex-row items-start gap-4">
                <div className="flex-1 flex items-start gap-4">
                    <Avatar className="h-14 w-14 text-lg">
                        <AvatarFallback>{contact.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h2 className="text-xl font-bold">{contact.name}</h2>
                    </div>
                </div>
                 <Button variant="ghost" size="icon" onClick={onEdit} className="shrink-0">
                    <Edit className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    {contact.budget ? (
                        <Button variant="outline" className="w-full justify-start border-primary pointer-events-none">
                            <DollarSign className="mr-2 h-4 w-4" />
                            Buget: €{contact.budget.toLocaleString()}
                        </Button>
                    ) : null}
                    {contact.city ? (
                        <p className="text-sm text-muted-foreground pt-1 pl-1 flex items-center">
                            <MapPin className="mr-2 h-4 w-4" />
                            {contact.city}
                        </p>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="px-3 py-1 text-xs font-normal">
                        <Calendar className="mr-2 h-3.5 w-3.5" />
                        {new Date(creationDate).toLocaleDateString('ro-RO')}
                    </Badge>
                    <Badge variant={ageBadgeVariant} className="px-3 py-1 text-xs">
                        <Clock className="mr-2 h-3.5 w-3.5" />
                        Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}
                    </Badge>
                </div>
                 {contact.zones && contact.zones.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-muted-foreground">Zone Preferate</h4>
                        <div className="flex flex-wrap gap-2">
                            {contact.zones.map(zone => (
                                <Button 
                                    key={zone} 
                                    variant="outline" 
                                    size="sm"
                                    className="pointer-events-none cursor-default"
                                >
                                    <MapPin className="mr-2 h-4 w-4 flex-shrink-0" />
                                    {zone}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
