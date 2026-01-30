'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Mail, Phone } from 'lucide-react';

const ContactForm = () => (
    <div className="text-center bg-muted p-8 rounded-lg">
        <p>Placeholder for Contact Form</p>
    </div>
);


export default function AgencyContactPage() {
  const agency = {
    name: 'Agenția Imobiliară Premium',
    address: 'Str. Victoriei nr. 100, București, România',
    phone: '+40 722 123 456',
    email: 'contact@agentiepremium.ro',
  };

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4">Contactați-ne</h1>
        <p className="text-muted-foreground text-center mb-12">
          Avem o echipă pregătită să vă răspundă la orice întrebare.
        </p>

        <div className="grid md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Date de Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <Home className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold">Adresă Sediu</h3>
                    <p className="text-muted-foreground">{agency.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold">Telefon</h3>
                    <p className="text-muted-foreground">{agency.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Mail className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p className="text-muted-foreground">{agency.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

             <Card>
              <CardHeader>
                <CardTitle>Locație pe Hartă</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">Google Maps IFrame Placeholder</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
                <CardHeader>
                    <CardTitle>Trimite-ne un Mesaj</CardTitle>
                </CardHeader>
                <CardContent>
                    <ContactForm />
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
