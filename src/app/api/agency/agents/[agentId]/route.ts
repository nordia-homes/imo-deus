import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { requireAgencyAdminFromBearerToken, requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const updateAgentSchema = z.object({
  name: z.string().trim().min(2, 'Numele agentului este obligatoriu.'),
  phone: z.string().trim().optional(),
  photoUrl: z.string().url('URL-ul pozei este invalid.').or(z.literal('')).optional(),
});

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'A aparut o eroare la actualizarea agentului.',
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      message: error.message,
    };
  }

  return {
    status: 500,
    message: 'A aparut o eroare la actualizarea agentului.',
  };
}

function calculateCommission(property: {
  price?: number;
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
}) {
  const price = property.price || 0;
  if (!price) return 0;
  if (property.commissionType === 'fixed') {
    return property.commissionValue || 0;
  }
  const percentage = property.commissionValue !== undefined ? property.commissionValue : 2;
  return price * (percentage / 100);
}

function sortByDateDesc<T>(items: T[], selector: (item: T) => string | undefined | null) {
  return [...items].sort((left, right) => {
    const leftValue = selector(left);
    const rightValue = selector(right);
    const leftTime = leftValue ? new Date(leftValue).getTime() : 0;
    const rightTime = rightValue ? new Date(rightValue).getTime() : 0;
    return rightTime - leftTime;
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { agentId } = await context.params;

    if (authContext.role !== 'admin' && authContext.uid !== agentId) {
      return NextResponse.json(
        { message: 'Poți vedea doar statisticile tale sau, dacă ești admin, statisticile agenților din agenția ta.' },
        { status: 403 }
      );
    }

    const [userSnapshot, agencyUsersSnapshot, propertiesSnapshot, contactsSnapshot, viewingsSnapshot, tasksSnapshot] = await Promise.all([
      authContext.adminDb.collection('users').doc(agentId).get(),
      authContext.adminDb.collection('users').where('agencyId', '==', authContext.agencyId).get(),
      authContext.adminDb.collection('agencies').doc(authContext.agencyId).collection('properties').get(),
      authContext.adminDb.collection('agencies').doc(authContext.agencyId).collection('contacts').get(),
      authContext.adminDb.collection('agencies').doc(authContext.agencyId).collection('viewings').get(),
      authContext.adminDb.collection('agencies').doc(authContext.agencyId).collection('tasks').get(),
    ]);

    if (!userSnapshot.exists) {
      return NextResponse.json({ message: 'Agentul nu a fost gasit.' }, { status: 404 });
    }

    const agentProfile = { id: userSnapshot.id, ...userSnapshot.data() } as {
      id: string;
      agencyId?: string;
      role?: 'admin' | 'agent';
      name?: string;
      email?: string;
      phone?: string;
      photoUrl?: string;
    };

    if (agentProfile.agencyId !== authContext.agencyId) {
      return NextResponse.json({ message: 'Agentul nu aparține agenției curente.' }, { status: 403 });
    }

    const agentProperties = sortByDateDesc(
      propertiesSnapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .filter((property) => property.agentId === agentId),
      (property) => (property as { createdAt?: string; statusUpdatedAt?: string }).createdAt || (property as { statusUpdatedAt?: string }).statusUpdatedAt
    );

    const activeProperties = agentProperties.filter((property) => property.status === 'Activ');
    const soldProperties = agentProperties.filter((property) => property.status === 'Vândut');
    const reservedProperties = agentProperties.filter((property) => property.status === 'Rezervat');
    const rentedProperties = agentProperties.filter((property) => property.status === 'Închiriat');
    const inactiveProperties = agentProperties.filter((property) => property.status === 'Inactiv');

    const assignedContacts = contactsSnapshot.docs
      .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
      .filter((contact) => contact.agentId === agentId);
    const activeContacts = assignedContacts.filter((contact) => !['Câștigat', 'Pierdut'].includes(String(contact.status || '')));
    const wonContacts = assignedContacts.filter((contact) => contact.status === 'Câștigat');
    const lostContacts = assignedContacts.filter((contact) => contact.status === 'Pierdut');

    const assignedViewings = sortByDateDesc(
      viewingsSnapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .filter((viewing) => viewing.agentId === agentId),
      (viewing) => viewing.viewingDate as string | undefined
    );
    const completedViewings = assignedViewings.filter((viewing) => viewing.status === 'completed');
    const scheduledViewings = assignedViewings.filter((viewing) => viewing.status === 'scheduled');
    const cancelledViewings = assignedViewings.filter((viewing) => viewing.status === 'cancelled');

    const assignedTasks = sortByDateDesc(
      tasksSnapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .filter((task) => task.agentId === agentId),
      (task) => task.dueDate as string | undefined
    );
    const openTasks = assignedTasks.filter((task) => task.status === 'open');
    const completedTasks = assignedTasks.filter((task) => task.status === 'completed');

    const activePortfolioValue = activeProperties.reduce((sum, property) => sum + (Number(property.price) || 0), 0);
    const realizedSalesVolume = [...soldProperties, ...rentedProperties].reduce((sum, property) => sum + (Number(property.price) || 0), 0);
    const realizedCommission = [...soldProperties, ...rentedProperties].reduce(
      (sum, property) => sum + calculateCommission(property as { price?: number; commissionType?: 'percentage' | 'fixed'; commissionValue?: number }),
      0
    );
    const conversionRate = assignedContacts.length ? (wonContacts.length / assignedContacts.length) * 100 : 0;

    const realizedCommissionByAgent = new Map<string, number>();
    propertiesSnapshot.docs.forEach((docSnapshot) => {
      const property = docSnapshot.data() as {
        agentId?: string | null;
        status?: string;
        price?: number;
        commissionType?: 'percentage' | 'fixed';
        commissionValue?: number;
      };
      if (!property.agentId) return;
      if (property.status !== 'Vândut' && property.status !== 'Închiriat') return;
      realizedCommissionByAgent.set(
        property.agentId,
        (realizedCommissionByAgent.get(property.agentId) || 0) + calculateCommission(property)
      );
    });

    const commissionLeaderboard = agencyUsersSnapshot.docs
      .map((docSnapshot) => {
        const data = docSnapshot.data() as { name?: string; role?: 'admin' | 'agent' };
        return {
          id: docSnapshot.id,
          name: data.name || 'Agent',
          role: data.role,
          realizedCommission: realizedCommissionByAgent.get(docSnapshot.id) || 0,
        };
      })
      .sort((left, right) => {
        if (right.realizedCommission !== left.realizedCommission) {
          return right.realizedCommission - left.realizedCommission;
        }
        return left.name.localeCompare(right.name, 'ro');
      });

    const commissionRank = Math.max(
      1,
      commissionLeaderboard.findIndex((item) => item.id === agentId) + 1
    );

    return NextResponse.json(
      {
        agentProfile,
        ranking: {
          commissionRank,
          totalAgents: commissionLeaderboard.length,
          realizedCommission,
        },
        metrics: {
          agentProperties: agentProperties.slice(0, 5),
          activePropertiesCount: activeProperties.length,
          soldPropertiesCount: soldProperties.length,
          reservedPropertiesCount: reservedProperties.length,
          rentedPropertiesCount: rentedProperties.length,
          inactivePropertiesCount: inactiveProperties.length,
          assignedContactsCount: assignedContacts.length,
          activeContactsCount: activeContacts.length,
          wonContactsCount: wonContacts.length,
          lostContactsCount: lostContacts.length,
          assignedViewings: assignedViewings.slice(0, 3),
          assignedViewingsCount: assignedViewings.length,
          completedViewingsCount: completedViewings.length,
          scheduledViewingsCount: scheduledViewings.length,
          cancelledViewingsCount: cancelledViewings.length,
          assignedTasks: assignedTasks.slice(0, 3),
          assignedTasksCount: assignedTasks.length,
          openTasksCount: openTasks.length,
          completedTasksCount: completedTasks.length,
          activePortfolioValue,
          realizedSalesVolume,
          realizedCommission,
          conversionRate,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agencyId, adminDb, adminAuth } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const { agentId } = await context.params;
    const body = updateAgentSchema.parse(await request.json().catch(() => ({})));

    const userRef = adminDb.collection('users').doc(agentId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json({ message: 'Agentul nu a fost gasit.' }, { status: 404 });
    }

    const userData = userSnapshot.data() as {
      agencyId?: string;
      role?: 'admin' | 'agent';
      email?: string;
    } | undefined;

    if (userData?.agencyId !== agencyId || userData?.role !== 'agent') {
      return NextResponse.json(
        { message: 'Poti modifica doar agentii din agentia ta.' },
        { status: 403 }
      );
    }

    const updatePayload = {
      name: body.name.trim(),
      phone: body.phone?.trim() || '',
      photoUrl: body.photoUrl?.trim() || '',
      updatedAt: new Date().toISOString(),
    };

    const batch = adminDb.batch();
    batch.set(userRef, updatePayload, { merge: true });
    batch.set(
      adminDb.collection('publicAgentProfiles').doc(agentId),
      {
        agencyId,
        name: updatePayload.name,
        email: userData.email || '',
        phone: updatePayload.phone,
        photoUrl: updatePayload.photoUrl,
        updatedAt: updatePayload.updatedAt,
      },
      { merge: true }
    );

    await batch.commit();
    await adminAuth.updateUser(agentId, {
      displayName: updatePayload.name,
    });

    return NextResponse.json(
      {
        agent: {
          id: agentId,
          ...userData,
          ...updatePayload,
          role: 'agent',
          agencyId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0]?.message || 'Datele introduse nu sunt valide.' },
        { status: 400 }
      );
    }

    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agencyId, adminDb, adminAuth } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const { agentId } = await context.params;

    const userRef = adminDb.collection('users').doc(agentId);
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return NextResponse.json({ message: 'Agentul nu a fost gasit.' }, { status: 404 });
    }

    const userData = userSnapshot.data() as {
      agencyId?: string;
      role?: 'admin' | 'agent';
    } | undefined;

    if (userData?.agencyId !== agencyId || userData?.role !== 'agent') {
      return NextResponse.json(
        { message: 'Poti sterge doar agentii din agentia ta.' },
        { status: 403 }
      );
    }

    const batch = adminDb.batch();
    batch.delete(userRef);
    batch.delete(adminDb.collection('publicAgentProfiles').doc(agentId));
    batch.set(
      adminDb.collection('agencies').doc(agencyId),
      {
        agentIds: FieldValue.arrayRemove(agentId),
      },
      { merge: true }
    );

    await batch.commit();

    await adminAuth.deleteUser(agentId);

    return NextResponse.json({ success: true, agentId }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
