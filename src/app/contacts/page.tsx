import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contacts } from "@/lib/data";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

function getBadgeVariant(status: 'Lead' | 'Client' | 'Partner') {
    switch(status) {
        case 'Client': return 'default';
        case 'Lead': return 'secondary';
        case 'Partner': return 'outline';
        default: return 'default';
    }
}

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-headline font-bold">Contacts</h1>
            <p className="text-muted-foreground">
            Manage your clients, leads, and partners.
            </p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead className="text-right">Last Contacted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3 group">
                    <Avatar>
                      <AvatarImage src={contact.avatarUrl} alt={contact.name} />
                      <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium group-hover:text-primary transition-colors">{contact.name}</span>
                  </Link>
                </TableCell>
                <TableCell>
                    <Badge variant={getBadgeVariant(contact.status)}>{contact.status}</Badge>
                </TableCell>
                <TableCell>{contact.email}</TableCell>
                <TableCell>{contact.phone}</TableCell>
                <TableCell className="text-right">{contact.lastContacted}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
