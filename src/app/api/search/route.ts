import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import type { Contact, Property, Task } from '@/lib/types';

export const runtime = 'nodejs';

function normalizeSearchText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesQuery(parts: Array<string | number | null | undefined>, query: string) {
  const searchable = normalizeSearchText(parts.filter((part) => part !== null && part !== undefined).join(' '));
  return searchable.includes(query);
}

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Nu am putut cauta in datele agentiei.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Nu am putut cauta in datele agentiei.' };
}

export async function GET(request: NextRequest) {
  try {
    const { agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }

    const query = normalizeSearchText(request.nextUrl.searchParams.get('q'));
    if (query.length < 2) {
      return NextResponse.json({ contacts: [], properties: [], tasks: [] }, { status: 200 });
    }

    const agencyRef = adminDb.collection('agencies').doc(agencyId);
    const [contactsSnapshot, propertiesSnapshot, tasksSnapshot] = await Promise.all([
      agencyRef.collection('contacts').get(),
      agencyRef.collection('properties').get(),
      agencyRef.collection('tasks').get(),
    ]);

    const contacts = contactsSnapshot.docs
      .map((snapshot) => ({ ...(snapshot.data() as Contact), id: snapshot.id }))
      .filter((contact) => matchesQuery([contact.name, contact.email, contact.phone], query))
      .slice(0, 5)
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
      }));

    const properties = propertiesSnapshot.docs
      .map((snapshot) => ({ ...(snapshot.data() as Property), id: snapshot.id }))
      .filter((property) => matchesQuery([property.title, property.address, property.location], query))
      .slice(0, 5)
      .map((property) => ({
        id: property.id,
        title: property.title,
      }));

    const tasks = tasksSnapshot.docs
      .map((snapshot) => ({ ...(snapshot.data() as Task), id: snapshot.id }))
      .filter((task) => matchesQuery([task.description, task.contactName, task.propertyTitle], query))
      .slice(0, 5)
      .map((task) => ({
        id: task.id,
        description: task.description,
      }));

    return NextResponse.json({ contacts, properties, tasks }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
