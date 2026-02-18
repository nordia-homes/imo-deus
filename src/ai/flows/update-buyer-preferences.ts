
'use server';
/**
 * @fileOverview A flow to securely update a buyer's preferences via a public link.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeServerFirebase } from '@/firebase/server';
import { doc, getDoc, updateDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import type { Contact, Interaction } from '@/lib/types';


// Schemas
const UpdateBuyerPreferencesInputSchema = z.object({
  linkId: z.string().describe("The secure ID from the preferences form link."),
  budget: z.coerce.number().optional(),
  desiredRooms: z.coerce.number().optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
  city: z.string().optional(),
  generalZone: z.string().optional(),
  zones: z.array(z.string()).optional(),
  mentiuni: z.string().optional().describe("Additional notes from the buyer."),
});
export type UpdateBuyerPreferencesInput = z.infer<typeof UpdateBuyerPreferencesInputSchema>;

const UpdateBuyerPreferencesOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type UpdateBuyerPreferencesOutput = z.infer<typeof UpdateBuyerPreferencesOutputSchema>;


// Main exported function
export async function updateContactPreferences(input: UpdateBuyerPreferencesInput): Promise<UpdateBuyerPreferencesOutput> {
  return updateBuyerPreferencesFlow(input);
}

const updateBuyerPreferencesFlow = ai.defineFlow(
  {
    name: 'updateBuyerPreferencesFlow',
    inputSchema: UpdateBuyerPreferencesInputSchema,
    outputSchema: UpdateBuyerPreferencesOutputSchema,
  },
  async (input) => {
    const { firestore } = initializeServerFirebase();
    const { linkId, mentiuni, ...formData } = input;

    try {
        // 1. Validate the linkId
        const linkRef = doc(firestore, 'buyer-preferences-links', linkId);
        const linkSnap = await getDoc(linkRef);

        if (!linkSnap.exists()) {
            throw new Error("Link invalid sau expirat.");
        }
        
        const { agencyId, contactId } = linkSnap.data();

        // 2. Prepare the data for update
        const contactRef = doc(firestore, 'agencies', agencyId, 'contacts', contactId);
        const contactSnap = await getDoc(contactRef);
        if (!contactSnap.exists()) {
            throw new Error("Contactul nu a fost găsit.");
        }
        const existingContact = contactSnap.data() as Contact;

        const dataToUpdate: Partial<Omit<Contact, 'id' | 'preferences' | 'interactionHistory'>> & { preferences?: any } = {};
        
        if (formData.budget !== undefined) dataToUpdate.budget = formData.budget;
        if (formData.city !== undefined) dataToUpdate.city = formData.city;
        if (formData.generalZone !== undefined) dataToUpdate.generalZone = formData.generalZone as Contact['generalZone'];
        if (formData.zones !== undefined) dataToUpdate.zones = formData.zones;

        const updatedPreferences = { ...existingContact.preferences };
        if (formData.desiredRooms !== undefined) updatedPreferences.desiredRooms = formData.desiredRooms;
        if (formData.desiredSquareFootageMin !== undefined) updatedPreferences.desiredSquareFootageMin = formData.desiredSquareFootageMin;
        
        dataToUpdate.preferences = updatedPreferences;
        
        const batch = writeBatch(firestore);
        
        batch.update(contactRef, dataToUpdate);

        if (mentiuni) {
            const newInteraction: Interaction = {
                id: crypto.randomUUID(),
                type: 'Notiță',
                date: new Date().toISOString(),
                notes: `Notă de la client (formular preferințe): ${mentiuni}`,
                agent: { name: 'Formular Public' },
            };
            batch.update(contactRef, {
                interactionHistory: arrayUnion(newInteraction)
            });
        }
        
        await batch.commit();

        return { success: true, message: "Preferințele au fost actualizate cu succes. Mulțumim!" };

    } catch (error: any) {
        console.error("Error updating buyer preferences:", error);
        return { success: false, message: error.message || "A apărut o eroare neașteptată." };
    }
  }
);
