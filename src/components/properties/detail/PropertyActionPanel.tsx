'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Property, Viewing, Contact } from '@/lib/types';
import { User, MapPin, Calendar, UserCheck } from 'lucide-react';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

type PropertyActionPanelProps = {
  property: Property;
  viewings: Viewing[];
  matchedLeads: Contact[];
};

export function PropertyActionPanel({ property, viewings, matchedLeads }: PropertyActionPanelProps) {

  return (
    <div className="space-y-4 sticky top-28">
      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="pb-2">
            <CardTitle className="text-base">Setări Proprietate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
             <div>
                <Label className="text-xs text-muted-foreground">Status Proprietate</Label>
                <Select defaultValue={property.status}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Activ">Activ</SelectItem>
                        <SelectItem value="Inactiv">Inactiv</SelectItem>
                        <SelectItem value="Rezervat">Rezervat</SelectItem>
                        <SelectItem value="Vândut">Vândut</SelectItem>
                        <SelectItem value="Închiriat">Închiriat</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>
      
      <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
              <CardTitle className="text-base">Vizionări Programate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              {viewings.length > 0 ? viewings.map(v => (
                  <div key={v.id} className="text-sm p-2 rounded-md border">
                      <p className="font-semibold">{v.contactName}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(v.viewingDate), "d MMM yyyy, HH:mm", { locale: ro })}</p>
                  </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-2">Nicio vizionare programată.</p>
              )}
          </CardContent>
      </Card>
      
       <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
              <CardTitle className="text-base">Lead-uri Potrivite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
              {matchedLeads.length > 0 ? matchedLeads.map(lead => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="block p-2 rounded-md border hover:bg-accent">
                    <div className="flex items-center justify-between">
                        <p className="font-semibold text-sm">{lead.name}</p>
                        <UserCheck className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Buget: €{lead.budget?.toLocaleString()}</p>
                  </Link>
              )) : (
                <p className="text-sm text-muted-foreground text-center py-2">Niciun lead potrivit găsit.</p>
              )}
          </CardContent>
      </Card>

    </div>
  );
}
