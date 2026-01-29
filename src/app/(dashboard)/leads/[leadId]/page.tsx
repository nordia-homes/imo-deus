
import AiInsightCard from "@/components/ai/AiInsightCard";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, PlusCircle } from "lucide-react";

export default function LeadDetailPage({ params }: { params: { leadId: string } }) {
  // Placeholder data - replace with Firestore data fetching
  const lead = {
    id: params.leadId,
    name: 'Alex Popescu',
    phone: '0722 123 456',
    email: 'alex.p@email.com',
    status: 'Contactat',
    avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    aiSummary: 'Clientul caută un apartament cu 2 camere în zona centrală, cu buget de 150.000€. Este flexibil, dar preferă clădirile noi. Grad de urgență ridicat.',
    nextBestAction: 'Programează o vizionare la proprietatea #P124, care se potrivește perfect cerințelor.',
    interactionHistory: [
      { id: '1', type: 'Apel', date: '20.05.2024', notes: 'Discuție inițială, prezentare cerințe.' },
      { id: '2', type: 'Email', date: '21.05.2024', notes: 'Trimis primele 3 oferte.' },
    ],
    tasks: [
        { id: '1', title: 'Trimite oferte noi', dueDate: '25.05.2024' }
    ]
  };

  const matchedProperties = [
      { id: 'p1', address: '123 Strada Lalelelor', price: 145000, imageUrl: 'https://picsum.photos/seed/prop1/300/200', imageHint: 'apartament modern' },
      { id: 'p2', address: '456 Bulevardul Unirii', price: 155000, imageUrl: 'https://picsum.photos/seed/prop2/300/200', imageHint: 'apartament centru' },
  ];

  return (
    <div className="space-y-6">
        <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarImage src={lead.avatar} />
                    <AvatarFallback>{lead.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-headline font-bold">{lead.name}</h1>
                    <div className="flex items-center gap-4 text-muted-foreground mt-1">
                        <span className="flex items-center gap-2"><Mail className="h-4 w-4" /> {lead.email}</span>
                        <span className="flex items-center gap-2"><Phone className="h-4 w-4" /> {lead.phone}</span>
                    </div>
                </div>
            </div>
             <Badge>{lead.status}</Badge>
        </div>

        <Separator />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                {/* AI Summary & Next Best Action */}
                <Card className="bg-primary/5 border-primary">
                    <CardHeader>
                        <CardTitle>Sumar AI & Următoarea Acțiune Recomandată</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">{lead.aiSummary}</p>
                        <div className="bg-accent/10 p-4 rounded-md">
                            <p className="font-bold text-accent-foreground">{lead.nextBestAction}</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Matched Properties */}
                <Card>
                    <CardHeader>
                        <CardTitle>Proprietăți Potrivite</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {matchedProperties.map(prop => (
                           <PropertyCard key={prop.id} property={prop} />
                        ))}
                    </CardContent>
                </Card>
            </div>
            <div className="space-y-6">
                {/* Interaction History */}
                 <Card>
                    <CardHeader>
                        <CardTitle>Istoric Interacțiuni</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {lead.interactionHistory.map(item => (
                            <div key={item.id} className="text-sm">
                                <p className="font-semibold">{item.type} - {item.date}</p>
                                <p className="text-muted-foreground">{item.notes}</p>
                            </div>
                        ))}
                         <Textarea placeholder="Adaugă o notă despre interacțiune..." />
                         <Button size="sm">Salvează Nota</Button>
                    </CardContent>
                </Card>
                {/* Tasks & Follow-up */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Task-uri</CardTitle>
                        <Button variant="ghost" size="sm"><PlusCircle className="h-4 w-4"/></Button>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {lead.tasks.map(task => (
                            <div key={task.id} className="text-sm flex items-center justify-between">
                                <p>{task.title}</p>
                                <p className="text-muted-foreground">{task.dueDate}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    </div>
  );
}
