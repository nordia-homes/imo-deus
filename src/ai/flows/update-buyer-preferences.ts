
'use server';
/**
 * @fileOverview A flow to securely update a buyer's preferences via a public link.
 * This flow now uses the Firebase Admin SDK to bypass security rules for this specific server-side operation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
// IMPORTANT: We now use the Admin SDK which has different imports and syntax.
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

// Schemas remain the same
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
    const { linkId, mentiuni, ...formData } = input;

    try {
        // Step 1: Validate the link using the Admin SDK
        const linkRef = adminDb.collection('buyer-preferences-links').doc(linkId);
        const linkSnap = await linkRef.get();

        if (!linkSnap.exists) {
            throw new Error("Link invalid sau expirat.");
        }
        
        const { agencyId, contactId } = linkSnap.data()!;

        // Step 2: Get a reference to the contact document
        const contactRef = adminDb.collection('agencies').doc(agencyId).collection('contacts').doc(contactId);
        
        const dataToUpdate: { [key: string]: any } = {};

        // Step 3: Build the update object from form data
        if (formData.budget !== undefined) dataToUpdate.budget = formData.budget;
        if (formData.city !== undefined) dataToUpdate.city = formData.city === 'all' ? null : formData.city;
        if (formData.generalZone !== undefined) dataToUpdate.generalZone = formData.generalZone === 'all' ? null : formData.generalZone;
        if (formData.zones !== undefined) dataToUpdate.zones = formData.zones;
        
        if (formData.desiredRooms !== undefined) dataToUpdate['preferences.desiredRooms'] = formData.desiredRooms;
        if (formData.desiredSquareFootageMin !== undefined) dataToUpdate['preferences.desiredSquareFootageMin'] = formData.desiredSquareFootageMin;

        if (formData.budget !== undefined) {
          dataToUpdate['preferences.desiredPriceRangeMin'] = Math.round(formData.budget * 0.8);
          dataToUpdate['preferences.desiredPriceRangeMax'] = Math.round(formData.budget * 1.2);
        }
        
        // Step 4: If there are notes, add them to the interaction history using FieldValue.arrayUnion
        if (mentiuni) {
            const newInteraction = {
                id: crypto.randomUUID(),
                type: 'Notiță' as const,
                date: new Date().toISOString(),
                notes: `Notă de la client (formular preferințe): ${mentiuni}`,
                agent: { name: 'Formular Public' },
            };
            // arrayUnion is available on the Admin SDK's FieldValue
            dataToUpdate.interactionHistory = FieldValue.arrayUnion(newInteraction);
        }

        // Step 5: Perform the update if there's anything to update.
        // Because we are using the Admin SDK, this operation bypasses security rules.
        if (Object.keys(dataToUpdate).length > 0) {
            await contactRef.update(dataToUpdate);
        }

        return { success: true, message: "Preferințele au fost actualizate cu succes. Mulțumim!" };

    } catch (error: any) {
        console.error("Error updating buyer preferences via Admin SDK:", error);
        // The error is now more likely to be a configuration or server issue, not a permissions one.
        return { success: false, message: error.message || "A apărut o eroare neașteptată pe server." };
    }
  }
);
