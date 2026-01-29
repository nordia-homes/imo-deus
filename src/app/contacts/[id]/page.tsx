import { contacts, properties } from '@/lib/data';
import { notFound } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone } from 'lucide-react';
import { ContactDetailsClient } from '@/components/contacts/contact-details-client';


function getBadgeVariant(status: 'Lead' | 'Client' | 'Partner') {
    switch(status) {
        case 'Client': return 'default';
        case 'Lead': return 'secondary';
        case 'Partner': return 'outline';
        default: return 'default';
    }
}

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const contact = contacts.find((c) => c.id === params.id);

  if (!contact) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start gap-6">
        <Avatar className="w-24 h-24 border">
          <AvatarImage src={contact.avatarUrl} alt={contact.name} />
          <AvatarFallback className="text-3xl">{contact.name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-headline font-bold">{contact.name}</h1>
            <Badge variant={getBadgeVariant(contact.status)}>{contact.status}</Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
             <div className="flex items-center gap-2">
                <Mail className="h-4 w-4"/>
                <span>{contact.email}</span>
             </div>
             <div className="flex items-center gap-2">
                <Phone className="h-4 w-4"/>
                <span>{contact.phone}</span>
             </div>
          </div>
        </div>
      </div>
      
      <ContactDetailsClient contact={contact} properties={properties} />

    </div>
  );
}
