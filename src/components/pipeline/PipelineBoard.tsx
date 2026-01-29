'use client';

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { useCollection, useFirestore, useUser, useMemoFirebase } from "@/firebase";
import { collection } from "firebase/firestore";
import type { Contact } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { DollarSign, User as UserIcon } from "lucide-react";

const stages: Contact['status'][] = ['Nou', 'Contactat', 'Vizionare', 'În negociere', 'Câștigat', 'Pierdut'];

function DealCard({ deal }: { deal: Contact }) {
    return (
        <Card className="mb-4 bg-card shadow-sm hover:shadow-md transition-shadow">
            <Link href={`/leads/${deal.id}`}>
                <CardContent className="p-3">
                    <p className="font-semibold truncate">{deal.name}</p>
                    <div className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        <span>{deal.budget?.toLocaleString() || 'N/A'} €</span>
                    </div>
                     <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        <span>{deal.source}</span>
                    </div>
                    {deal.leadScore && (
                         <Badge variant={deal.leadScore > 75 ? 'success' : deal.leadScore > 50 ? 'warning' : 'destructive'} className="mt-3">
                            Scor AI: {deal.leadScore}
                        </Badge>
                    )}
                </CardContent>
            </Link>
        </Card>
    )
}

function PipelineColumn({ title, deals }: { title: string, deals: Contact[] }) {
    const totalValue = deals.reduce((sum, deal) => sum + (deal.budget || 0), 0);

    return (
        <div className="bg-muted/50 rounded-lg p-3 flex flex-col h-full">
            <h3 className="font-semibold mb-2 text-center">{title}</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
                {deals.length} oferte | €{totalValue.toLocaleString()}
            </p>
            <div className="flex-1 overflow-y-auto px-1 -mx-1">
                {deals.length > 0 ? (
                    deals.map(deal => (
                        <DealCard key={deal.id} deal={deal} />
                    ))
                ) : (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-muted-foreground">Nicio ofertă</p>
                    </div>
                )}
            </div>
        </div>
    )
}


export function PipelineBoard() {
  const { user } = useUser();
  const firestore = useFirestore();

  const contactsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'contacts');
  }, [firestore, user]);

  const { data: contacts, isLoading } = useCollection<Contact>(contactsQuery);

  if (isLoading) {
    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto h-full pb-4">
            {stages.map(stage => (
                <div key={stage} className="bg-muted/50 rounded-lg p-3 flex flex-col">
                    <Skeleton className="h-6 w-2/3 mx-auto mb-4" />
                    <Skeleton className="h-24 w-full mb-4" />
                    <Skeleton className="h-24 w-full" />
                </div>
            ))}
        </div>
    )
  }

  const dealsByStage = (stage: Contact['status']) => {
    return contacts?.filter(contact => contact.status === stage) || [];
  }
  
  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto h-full pb-4">
      {stages.map(stage => (
        <PipelineColumn key={stage} title={stage} deals={dealsByStage(stage)} />
      ))}
    </div>
  );
}
