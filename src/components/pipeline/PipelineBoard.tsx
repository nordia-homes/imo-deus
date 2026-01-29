
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { useCollection, useFirestore, useUser, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
import { collection, doc } from "firebase/firestore";
import type { Contact } from "@/lib/types";
import { Skeleton } from "../ui/skeleton";
import Link from "next/link";
import { DollarSign, User as UserIcon, Archive, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "../ui/button";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const stages: Contact['status'][] = ['Nou', 'Contactat', 'Vizionare', 'În negociere', 'Câștigat', 'Pierdut'];

function DealCard({ deal }: { deal: Contact }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({id: deal.id});
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <Card className="mb-4 bg-card shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing">
                <Link href={`/leads/${deal.id}`} className="block" draggable={false}>
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
                        {deal.leadScore != null && (
                            <Badge variant={deal.leadScore > 75 ? 'success' : deal.leadScore > 50 ? 'warning' : 'destructive'} className="mt-3">
                                Scor AI: {deal.leadScore}
                            </Badge>
                        )}
                    </CardContent>
                </Link>
            </Card>
        </div>
    )
}

function PipelineColumn({ title, deals }: { title: Contact['status'], deals: Contact[] }) {
    const totalValue = deals.reduce((sum, deal) => sum + (deal.budget || 0), 0);

    return (
        <div className="bg-muted/50 rounded-lg p-3 flex flex-col h-full">
            <h3 className="font-semibold mb-2 text-center">{title}</h3>
            <p className="text-xs text-muted-foreground text-center mb-4">
                {deals.length} oferte | €{totalValue.toLocaleString()}
            </p>
             <SortableContext
                id={title}
                items={deals.map(d => d.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex-1 overflow-y-auto px-1 -mx-1 min-h-24">
                    {deals.map(deal => (
                        <DealCard key={deal.id} deal={deal} />
                    ))}
                    {deals.length === 0 && (
                         <div className="h-full flex items-center justify-center">
                            <p className="text-sm text-muted-foreground">Nicio ofertă</p>
                        </div>
                    )}
                </div>
            </SortableContext>
        </div>
    )
}


export function PipelineBoard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const sensors = useSensors(useSensor(PointerSensor, {
      activationConstraint: {
          distance: 8,
      },
  }));
  const { toast } = useToast();
  const [isArchiving, setIsArchiving] = useState(false);

  const [deals, setDeals] = useState<Contact[]>([]);

  const contactsQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'contacts');
  }, [firestore, user]);

  const { data: fetchedContacts, isLoading } = useCollection<Contact>(contactsQuery);

  useEffect(() => {
    if (fetchedContacts) {
      setDeals(fetchedContacts);
    }
  }, [fetchedContacts]);

  const handleArchiveInactive = () => {
    if (!user) return;
    setIsArchiving(true);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeStages: Contact['status'][] = ['Nou', 'Contactat', 'Vizionare', 'În negociere'];
    const dealsToProcess = deals.filter(d => activeStages.includes(d.status));

    const inactiveDeals = dealsToProcess.filter(deal => {
      let lastActivityDate: Date | null = null;
      
      if (deal.interactionHistory && deal.interactionHistory.length > 0) {
        const mostRecentInteraction = deal.interactionHistory.reduce((latest, current) => 
            new Date(current.date) > new Date(latest.date) ? current : latest
        );
        lastActivityDate = new Date(mostRecentInteraction.date);
      } else if (deal.createdAt) {
        lastActivityDate = new Date(deal.createdAt);
      }

      if (!lastActivityDate) {
        return false;
      }

      return lastActivityDate < thirtyDaysAgo;
    });

    if (inactiveDeals.length === 0) {
      toast({
        title: 'Niciun lead inactiv',
        description: 'Toate lead-urile active au avut activitate în ultimele 30 de zile.',
      });
      setIsArchiving(false);
      return;
    }

    inactiveDeals.forEach(deal => {
      const dealRef = doc(firestore, 'users', user.uid, 'contacts', deal.id);
      updateDocumentNonBlocking(dealRef, { status: 'Pierdut' });
    });

    toast({
      title: 'Arhivare finalizată',
      description: `${inactiveDeals.length} lead-uri inactive au fost mutate în stadiul "Pierdut".`,
    });

    setIsArchiving(false);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return;
    }
    
    if (active.id === over.id) {
        return;
    }

    const activeContainer = active.data.current?.sortable.containerId as Contact['status'];
    const overContainer = over.data.current?.sortable.containerId as Contact['status'] || over.id as Contact['status'];

    setDeals((prev) => {
        if (activeContainer && overContainer && activeContainer !== overContainer) {
            // Dropped in a new column
            if (user) {
                const dealRef = doc(firestore, 'users', user.uid, 'contacts', String(active.id));
                updateDocumentNonBlocking(dealRef, { status: overContainer });
            }

            // Optimistic UI Update
            return prev.map(item => 
                item.id === active.id 
                ? { ...item, status: overContainer } 
                : item
            );
        }

        // Reordering within the same column
        const oldIndex = prev.findIndex(d => d.id === active.id);
        const newIndex = prev.findIndex(d => d.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
             return arrayMove(prev, oldIndex, newIndex);
        }

        return prev;
    });
  }

  if (isLoading && deals.length === 0) {
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
    return deals?.filter(contact => contact.status === stage) || [];
  }
  
  return (
    <>
        <div className="mb-6 flex items-start justify-between">
            <div>
                <h1 className="text-3xl font-headline font-bold">Pipeline Vânzări</h1>
                <p className="text-muted-foreground">
                    Urmărește progresul tranzacțiilor în timp real.
                </p>
            </div>
            <Button onClick={handleArchiveInactive} disabled={isArchiving || isLoading}>
                {isArchiving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}
                Arhivează Inactive
            </Button>
        </div>
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto h-full pb-4">
            {stages.map(stage => (
                <PipelineColumn key={stage} title={stage} deals={dealsByStage(stage)} />
            ))}
            </div>
        </DndContext>
    </>
  );
}
