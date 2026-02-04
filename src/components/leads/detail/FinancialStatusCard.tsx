'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Contact, Offer, FinancialStatus } from '@/lib/types';
import { Banknote, FileText } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface FinancialStatusCardProps {
  contact: Contact;
  onUpdateContact: (data: Partial<Pick<Contact, 'financialStatus' | 'offers'>>) => void;
}

export function FinancialStatusCard({ contact, onUpdateContact }: FinancialStatusCardProps) {

  const handleStatusChange = (status: FinancialStatus) => {
    onUpdateContact({ financialStatus: status });
  };
  
  const offers = contact.offers || [];

  return (
    <Card className="rounded-2xl shadow-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-5 w-5 text-primary" />
          <span>Situație Financiară și Oferte</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Status Financiar</Label>
          <Select defaultValue={contact.financialStatus || 'Neprecalificat'} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Neprecalificat">Neprecalificat</SelectItem>
              <SelectItem value="Credit Pre-aprobat">Credit Pre-aprobat</SelectItem>
              <SelectItem value="Credit Aprobat">Credit Aprobat</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Istoric Oferte</Label>
          <div className="mt-2 space-y-2">
            {offers.length > 0 ? (
              offers.map(offer => (
                <div key={offer.id} className="text-sm p-2 rounded-md border">
                  <p className="font-semibold">{offer.propertyTitle}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-primary font-bold">€{offer.price.toLocaleString()}</span>
                    <span className="text-xs font-medium">{offer.status}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Nicio ofertă înregistrată.</p>
            )}
            {/* TODO: Add a popover/dialog to add a new offer */}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
