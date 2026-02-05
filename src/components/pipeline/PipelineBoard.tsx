'use client';

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { createPortal } from 'react-dom';

import type { Contact } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import { Skeleton } from '../ui/skeleton';
import { PipelineColumn } from './PipelineColumn';
import { PipelineCard } from './PipelineCard';

const BUYER_STATUSES: Contact['status'][] = [
    'Nou',
    'Contactat',
    'Vizionare',
    'În negociere',
    'Câștigat',
    'Pierdut',
];

export function PipelineBoard() {
  const { agencyId } = useAgency();
  const firestore = useFirestore();

  const [activeContact, setActiveContact] = useState<Contact | null>(null);

  const contactsQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'contacts');
  }, [firestore, agencyId]);
  
  const { data: contacts, isLoading } = useCollection<Contact>(contactsQuery);

  const columns = useMemo(() => {
    const groupedContacts: Record<string, Contact[]> = {};
    BUYER_STATUSES.forEach(status => {
        groupedContacts[status] = [];
    });

    contacts?.forEach(contact => {
        // Ensure contact.status is a valid key
        const statusKey = contact.status as keyof typeof groupedContacts;
        if (groupedContacts[statusKey]) {
            groupedContacts[statusKey].push(contact);
        }
    });
    return groupedContacts;
  }, [contacts]);


  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === 'Contact') {
      setActiveContact(event.active.data.current.contact);
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveContact(null);

    const { active, over } = event;
    if (!over || active.id === over.id || !agencyId) return;

    const activeContainer = active.data.current?.sortable.containerId;
    const overContainer = over.data.current?.sortable?.containerId || over.id;

    if (activeContainer !== overContainer) {
        const contactId = String(active.id);
        const newStatus = String(overContainer) as Contact['status'];
        
        // Ensure newStatus is a valid status before updating
        if (BUYER_STATUSES.includes(newStatus)) {
            const contactRef = doc(firestore, 'agencies', agencyId, 'contacts', contactId);
            updateDocumentNonBlocking(contactRef, { status: newStatus });
        }
    }
  }

  if (isLoading) {
      return (
          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-full" />)}
          </div>
      )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start">
        {BUYER_STATUSES.map(status => (
          <PipelineColumn
            key={status}
            status={status}
            contacts={columns[status]}
          />
        ))}
      </div>
      
      {typeof document !== 'undefined' && createPortal(
        <DragOverlay>
          {activeContact && (
            <PipelineCard contact={activeContact} />
          )}
        </DragOverlay>,
        document.body
      )}
    </DndContext>
  );
}
