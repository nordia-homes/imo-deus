
import {
  Table,
  TableBody,
  TableHeader,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { LeadCard } from "./LeadCard";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export function LeadList() {
  // Placeholder Data, replace with Firestore data fetching
  const leads = [
    { id: '1', name: 'Alex Popescu', phone: '0722 123 456', source: 'Website', budget: 150000, status: 'Contactat', aiScore: 88, urgency: 'Ridicata' },
    { id: '2', name: 'Ana Ionescu', phone: '0745 654 321', source: 'Recomandare', budget: 250000, status: 'Nou', aiScore: 75, urgency: 'Medie' },
    { id: '3', name: 'Dan Georgescu', phone: '0733 987 123', source: 'Imobiliare.ro', budget: 90000, status: 'Vizionare', aiScore: 92, urgency: 'Ridicata' },
    { id: '4', name: 'Laura Mihai', phone: '0766 555 888', source: 'Telefon', budget: 450000, status: 'În negociere', aiScore: 65, urgency: 'Scazuta' },
  ];

  return (
    <Card>
        <CardHeader>
            <CardTitle>Listă Lead-uri</CardTitle>
        </CardHeader>
        <CardContent>
             <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Nume</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Sursă</TableHead>
                    <TableHead>Buget</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scor AI</TableHead>
                    <TableHead>Urgență</TableHead>
                    <TableHead></TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                    {leads.map(lead => (
                        <LeadCard key={lead.id} lead={lead} />
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
  );
}
