'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, Mail, Phone } from 'lucide-react';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { PublicContactForm } from '@/components/public/PublicContactForm';


export default function AgencyContactPage() {
  const { agency, agencyId, isAgencyLoading } = usePublicAgency();

  if (isAgencyLoading || !agency || !agencyId) {
      return (
          <div className="container mx-auto py-12 px-4">
                <div className="max-w-4xl mx-auto">
                    <Skeleton className="h-10 w-64 mx-auto mb-4" />
                    <Skeleton className="h-6 w-96 mx-auto mb-12" />
                    <div className="grid md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <Skeleton className="h-48 w-full" />
                            <Skeleton className="h-48 w-full" />
                        </div>
                        <div>
                             <Skeleton className="h-96 w-full" />
                        </div>
                    </div>
                </div>
          </div>
      )
  }

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
                    <p className="text-muted-foreground">{agency.address || 'Nespecificată'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Phone className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold">Telefon</h3>
                    <p className="text-muted-foreground">{agency.phone || 'Nespecificat'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Mail className="h-6 w-6 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold">Email</h3>
                    <p className="text-muted-foreground">{agency.email || 'Nespecificat'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

             <Card>
              <CardHeader>
                <CardTitle>Locație pe Hartă</CardTitle>
              </CardHeader>
              <CardContent>
                {agency.address ? (
                    <iframe
                        className="w-full aspect-video rounded-md border"
                        loading="lazy"
                        allowFullScreen
                        referrerPolicy="no-referrer-when-downgrade"
                        src={`https://www.google.com/maps/embed/v1/place?key=&q=${encodeURIComponent(agency.address)}`}>
                    </iframe>
                ) : (
                    <div className="aspect-video bg-muted rounded-md flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Adresa agenției nu este specificată.</p>
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
                <CardHeader>
                    <CardTitle>Trimite-ne un Mesaj</CardTitle>
                </CardHeader>
                <CardContent>
                    <PublicContactForm agencyId={agencyId} />
                </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
