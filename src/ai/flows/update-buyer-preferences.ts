
'use server';
/**
 * @fileOverview A flow to securely update a buyer's preferences via a public link.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeServerFirebase } from '@/firebase/server';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';

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
        
        // Prepare a single update object using dot notation for nested fields
        const dataToUpdate: { [key: string]: any } = {
            validationLinkId: linkId // This is crucial for the security rule
        };

        if (formData.budget !== undefined) dataToUpdate.budget = formData.budget;
        if (formData.city !== undefined && formData.city !== 'all') dataToUpdate.city = formData.city;
        if (formData.generalZone !== undefined && formData.generalZone !== 'all') dataToUpdate.generalZone = formData.generalZone;
        if (formData.zones !== undefined) dataToUpdate.zones = formData.zones;
        
        // Use dot notation for nested preference updates to avoid overwriting the whole object
        if (formData.desiredRooms !== undefined) dataToUpdate['preferences.desiredRooms'] = formData.desiredRooms;
        if (formData.desiredSquareFootageMin !== undefined) dataToUpdate['preferences.desiredSquareFootageMin'] = formData.desiredSquareFootageMin;
        if (formData.budget !== undefined) {
          dataToUpdate['preferences.desiredPriceRangeMin'] = Math.round(formData.budget * 0.8);
          dataToUpdate['preferences.desiredPriceRangeMax'] = Math.round(formData.budget * 1.2);
        }

        if (mentiuni) {
            const newInteraction = {
                id: crypto.randomUUID(),
                type: 'Notiță' as const,
                date: new Date().toISOString(),
                notes: `Notă de la client (formular preferințe): ${mentiuni}`,
                agent: { name: 'Formular Public' },
            };
            dataToUpdate.interactionHistory = arrayUnion(newInteraction);
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
