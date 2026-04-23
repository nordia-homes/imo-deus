import { NextRequest, NextResponse } from 'next/server';
import { getDemoAdminDb } from '@/firebase/demo-admin';
import { getDemoProvisionSeed } from '@/lib/demo/seed';

export async function POST(request: NextRequest) {
  try {
    const demoAdminDb = getDemoAdminDb();
    const { uid } = await request.json();

    if (!uid || typeof uid !== 'string') {
      return NextResponse.json({ error: 'Missing demo uid.' }, { status: 400 });
    }

    const seed = getDemoProvisionSeed();
    const agencyId = `demo-${uid}`;
    const agencyRef = demoAdminDb.collection('agencies').doc(agencyId);

    const batch = demoAdminDb.batch();
    const now = new Date().toISOString();

    batch.set(agencyRef, {
      ...seed.agency,
      id: agencyId,
      ownerId: uid,
      isDemo: true,
      demoTemplate: 'atelier-estate',
      demoProvisionedForUid: uid,
      agentIds: [uid, ...seed.agents.filter((item) => item.id !== 'demo-admin').map((item) => item.id)],
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    batch.set(demoAdminDb.collection('users').doc(uid), {
      id: uid,
      name: 'Demo Administrator',
      email: `demo+${uid}@imodeus.ai`,
      role: 'admin',
      agencyId,
      isDemo: true,
      phone: '+40 721 555 110',
      photoUrl: 'https://i.pravatar.cc/150?img=12',
    }, { merge: true });

    for (const agent of seed.agents.filter((item) => item.id !== 'demo-admin')) {
      batch.set(demoAdminDb.collection('users').doc(agent.id), {
        ...agent,
        agencyId,
        isDemo: true,
      }, { merge: true });
    }

    for (const property of seed.properties) {
      batch.set(agencyRef.collection('properties').doc(property.id), property, { merge: true });
    }

    for (const contact of seed.contacts) {
      batch.set(agencyRef.collection('contacts').doc(contact.id), contact, { merge: true });
    }

    for (const viewing of seed.viewings) {
      batch.set(agencyRef.collection('viewings').doc(viewing.id), viewing, { merge: true });
    }

    for (const task of seed.tasks) {
      batch.set(agencyRef.collection('tasks').doc(task.id), task, { merge: true });
    }

    await batch.commit();

    return NextResponse.json({
      agencyId,
      agencyName: seed.agency.name,
      status: 'ready',
      counts: {
        properties: seed.properties.length,
        contacts: seed.contacts.length,
        viewings: seed.viewings.length,
        tasks: seed.tasks.length,
      },
    });
  } catch (error) {
    console.error('Demo provisioning failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown provisioning error.',
      },
      { status: 500 }
    );
  }
}
