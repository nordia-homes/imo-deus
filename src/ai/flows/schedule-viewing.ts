'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/firebase/admin';
import type { Contact, Task } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export const ScheduleViewingInputSchema = z.object({
  propertyId: z.string(),
  agencyId: z.string(),
  name: z.string().min(1, 'Numele este obligatoriu.'),
  phone: z.string().min(1, 'Telefonul este obligatoriu.'),
  email: z.string().email('Email invalid.'),
  message: z.string().optional(),
  website: z.string().optional(),
  formStartedAt: z.number().optional(),
});
export type ScheduleViewingInput = z.infer<typeof ScheduleViewingInputSchema>;

export const ScheduleViewingOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type ScheduleViewingOutput = z.infer<typeof ScheduleViewingOutputSchema>;

export async function scheduleViewing(input: ScheduleViewingInput): Promise<ScheduleViewingOutput> {
    return scheduleViewingFlow(input);
}

const scheduleViewingFlow = ai.defineFlow(
  {
    name: 'scheduleViewingFlow',
    inputSchema: ScheduleViewingInputSchema,
    outputSchema: ScheduleViewingOutputSchema,
  },
  async ({ propertyId, agencyId, name, email, phone, message, website, formStartedAt }) => {
    try {
        const now = Date.now();
        const submittedTooFast = typeof formStartedAt === 'number' && now - formStartedAt < 3000;
        const honeypotFilled = Boolean(website?.trim());
        const messageText = message?.trim() || '';
        const urlMatches = messageText.match(/https?:\/\//gi) || [];
        const suspiciousMessage = urlMatches.length > 1 || /www\./i.test(messageText);

        if (honeypotFilled || submittedTooFast || suspiciousMessage) {
            return { success: true, message: 'Solicitarea a fost trimisă! Un agent vă va contacta în curând.' };
        }

        const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
        const propertySnap = await propertyRef.get();

        if (!propertySnap.exists) {
            throw new Error('Proprietatea nu a fost găsită.');
        }
        const propertyData = propertySnap.data()!;

        // Check if a contact with this email already exists
        const contactsQuery = adminDb.collection('agencies').doc(agencyId).collection('contacts').where('email', '==', email).limit(1);
        const contactsSnap = await contactsQuery.get();

        let contactId: string;
        let contactName: string;

        if (contactsSnap.empty) {
            // Create a new contact
            const newContactRef = adminDb.collection('agencies').doc(agencyId).collection('contacts').doc();
            const newContact: Omit<Contact, 'id'> = {
                name,
                phone,
                email,
                contactType: 'Cumparator',
                status: 'Nou',
                source: 'Website',
                sourcePropertyId: propertyId,
                createdAt: new Date().toISOString(),
                description: `A solicitat vizionare pentru "${propertyData.title}".\nMesaj: ${message || 'N/A'}`
            };
            await newContactRef.set(newContact);
            contactId = newContactRef.id;
            contactName = name;
        } else {
            // Use existing contact
            const existingContact = contactsSnap.docs[0];
            contactId = existingContact.id;
            contactName = existingContact.data().name;
            
            const interaction = {
                id: adminDb.collection('agencies').doc().id, // dummy id for array
                type: 'Notiță' as const,
                date: new Date().toISOString(),
                notes: `A solicitat o nouă vizionare pentru "${propertyData.title}".\nMesaj: ${message || 'N/A'}`,
                 agent: { name: 'Sistem Website' },
            };
            await existingContact.ref.update({
                interactionHistory: FieldValue.arrayUnion(interaction)
            });
        }
        
        const tasksRef = adminDb.collection('agencies').doc(agencyId).collection('tasks');
        const agentId = propertyData.agentId || propertyData.ownerId;
        const agentName = propertyData.agentName || 'Agent nealocat';

        const dueDate = new Date();
        dueDate.setHours(dueDate.getHours() + 2);
        
        const newTask: Omit<Task, 'id'> = {
            description: `Programează vizionare pentru ${contactName} la "${propertyData.title}"`,
            dueDate: dueDate.toISOString().split('T')[0],
            startTime: dueDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' }),
            status: 'open',
            contactId,
            contactName,
            propertyId,
            propertyTitle: propertyData.title,
            agentId,
            agentName
        };

        await tasksRef.add(newTask);

        return { success: true, message: 'Solicitarea a fost trimisă! Un agent vă va contacta în curând.' };
    } catch (error: any) {
      console.error('Error in scheduleViewingFlow:', error);
      return { success: false, message: error.message || 'A apărut o eroare. Vă rugăm să reîncercați.' };
    }
  }
);
