
'use server';
/**
 * @fileOverview A flow to securely update a buyer's preferences via a public link.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeServerFirebase } from '@/firebase/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
        const linkRef = doc(firestore, 'buyer-preferences-links', linkId);
        const linkSnap = await getDoc(linkRef);

        if (!linkSnap.exists()) {
            throw new Error("Link invalid sau expirat.");
        }
        
        const { agencyId, contactId } = linkSnap.data();

        const contactRef = doc(firestore, 'agencies', agencyId, 'contacts', contactId);
        const contactSnap = await getDoc(contactRef);
        if (!contactSnap.exists()) {
            throw new Error("Contactul nu a fost găsit.");
        }
        const existingContact = contactSnap.data() as Contact;
        
        // Prepare a single update object
        const dataToUpdate: { [key: string]: any } = {
            validationLinkId: linkId // For security rules
        };

        if (formData.budget !== undefined) dataToUpdate.budget = formData.budget;
        if (formData.city !== undefined) dataToUpdate.city = formData.city;
        if (formData.generalZone !== undefined) dataToUpdate.generalZone = formData.generalZone;
        if (formData.zones !== undefined) dataToUpdate.zones = formData.zones;

        const updatedPreferences = { ...existingContact.preferences };
        if (formData.desiredRooms !== undefined) updatedPreferences.desiredRooms = formData.desiredRooms;
        if (formData.desiredSquareFootageMin !== undefined) updatedPreferences.desiredSquareFootageMin = formData.desiredSquareFootageMin;
        dataToUpdate.preferences = updatedPreferences;

        if (mentiuni) {
            const newInteraction: Interaction = {
                id: crypto.randomUUID(),
                type: 'Notiță',
                date: new Date().toISOString(),
                notes: `Notă de la client (formular preferințe): ${mentiuni}`,
                agent: { name: 'Formular Public' },
            };
            // Replicate arrayUnion by creating a new array
            dataToUpdate.interactionHistory = [...(existingContact.interactionHistory || []), newInteraction];
        }

        // A single update call with all changes
        await updateDoc(contactRef, dataToUpdate);

        return { success: true, message: "Preferințele au fost actualizate cu succes. Mulțumim!" };

    } catch (error: any) {
        console.error("Error updating buyer preferences:", error);
        return { success: false, message: error.message || "A apărut o eroare neașteptată." };
    }
  }
);
