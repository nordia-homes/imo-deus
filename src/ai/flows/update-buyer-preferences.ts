
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
  city: z.string().optional(),
  generalZone: z.string().optional(),
  zones: z.array(z.string()).optional(),
  mentiuni: z.string().optional().describe("Additional notes from the buyer."),
  desiredRooms: z.coerce.number().optional(),
  desiredSquareFootageMin: z.coerce.number().optional(),
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
          throw new Error("Clientul asociat acestui link nu a fost găsit.");
        }

        const existingContactData = contactSnap.data();
        
        // This object will be sent to Firestore. It MUST include the validationLinkId
        // so the security rules can verify the request.
        const dataToUpdate: { [key: string]: any } = {
            validationLinkId: linkId
        };

        // Add form data to the update object, ensuring we don't save "undefined"
        if (formData.budget !== undefined) {
          dataToUpdate.budget = formData.budget;
        }
        if (formData.city !== undefined) dataToUpdate.city = formData.city === 'all' ? null : formData.city;
        if (formData.generalZone !== undefined) dataToUpdate.generalZone = formData.generalZone === 'all' ? null : formData.generalZone;
        if (formData.zones !== undefined) dataToUpdate.zones = formData.zones;
        
        // Update preferences sub-object
        if (formData.desiredRooms !== undefined) dataToUpdate['preferences.desiredRooms'] = formData.desiredRooms;
        if (formData.desiredSquareFootageMin !== undefined) dataToUpdate['preferences.desiredSquareFootageMin'] = formData.desiredSquareFootageMin;

        // If a budget is provided, also update the price range in preferences
        if (formData.budget !== undefined) {
          dataToUpdate['preferences.desiredPriceRangeMin'] = Math.round(formData.budget * 0.8);
          dataToUpdate['preferences.desiredPriceRangeMax'] = Math.round(formData.budget * 1.2);
        }
        
        // Handle notes by adding them to the interaction history
        if (mentiuni) {
            const newInteraction = {
                id: crypto.randomUUID(),
                type: 'Notiță' as const,
                date: new Date().toISOString(),
                notes: `Notă de la client (formular preferințe): ${mentiuni}`,
                agent: { name: 'Formular Public' },
            };
            // Manually construct the new history array instead of using arrayUnion
            const existingHistory = existingContactData.interactionHistory || [];
            dataToUpdate.interactionHistory = [...existingHistory, newInteraction];
        }

        // Perform the update
        await updateDoc(contactRef, dataToUpdate);

        return { success: true, message: "Preferințele au fost actualizate cu succes. Mulțumim!" };

    } catch (error: any) {
        console.error("Error updating buyer preferences:", error);
        return { success: false, message: error.message || "A apărut o eroare neașteptată." };
    }
  }
);
