'use server';
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { publicContactSchema } from '@/lib/public-contact-schema';
export async function submitPublicContact(input: unknown) {
  const parsed = publicContactSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: 'Verifică numele, telefonul, adresa de email, orașul proprietății și acordul pentru contactare.' };
  const data = parsed.data;
  if (data.website || Date.now() - data.formStartedAt < 3000) return { success: false, message: 'Te rugăm să verifici formularul și să încerci din nou.' };
  try {
    const agencyRef = adminDb.collection('agencies').doc(data.agencyId);
    const agency = await agencyRef.get();
    if (!agency.exists) return { success: false, message: 'Agenția nu este disponibilă momentan.' };
    const contacts = agencyRef.collection('contacts');
    const existing = await contacts.where('email', '==', data.email).limit(1).get();
    const contactRef = existing.empty ? contacts.doc() : existing.docs[0].ref;
    const description = `Proprietar interesat de vânzare — formular Contact.\nOrașul proprietății: ${data.city}.\nNume proprietar: ${data.name}\n${data.message || 'Dorește să discute despre vânzarea proprietății.'}\nTelefon: ${data.phone}\nAcord pentru contactare: da.`;
    const now = new Date().toISOString();
    const batch = adminDb.batch();
    if (existing.empty) batch.set(contactRef, { name: data.name, phone: data.phone, email: data.email, contactType: 'Client', status: 'Nou', source: 'Website', leadIntent: 'Vânzare', propertyCity: data.city, createdAt: now, description });
    else batch.update(contactRef, { interactionHistory: FieldValue.arrayUnion({ id: agencyRef.collection('tasks').doc().id, type: 'Notiță', date: now, notes: description, agent: { name: 'Sistem Website' } }) });
    batch.set(agencyRef.collection('tasks').doc(), { description: `Contactează proprietarul ${data.name} — vânzare în ${data.city} (website)`, dueDate: now.slice(0, 10), status: 'open', contactId: contactRef.id, contactName: data.name, agentId: agency.data()?.ownerId || null });
    await batch.commit();
    return { success: true, message: 'Solicitarea ta a ajuns la echipa noastră.' };
  } catch { return { success: false, message: 'Solicitarea nu a putut fi trimisă. Încearcă din nou sau contactează-ne telefonic.' }; }
}
