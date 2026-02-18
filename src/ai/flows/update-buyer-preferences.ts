
'use server';
/**
 * @fileOverview A flow to securely update a buyer's preferences via a public link.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { initializeServerFirebase } from '@/firebase/server';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Contact } from '@/lib/types';


// Schemas
const UpdateBuyerPreferencesInputSchema = z.object({
  linkId: z.string().describe("The secure ID from the preferences form link."),
  budget: z.number().optional(),
  preferences: z.object({
      desiredRooms: z.number().optional(),
      desiredSquareFootageMin: z.number().optional(),
      desiredFeatures: z.string().optional(),
  }).optional(),
  city: z.string().optional(),
  generalZone: z.string().optional(),
  zones: z.array(z.string()).optional(),
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

    try {
        // 1. Validate the linkId
        const linkRef = doc(firestore, 'buyer-preferences-links', input.linkId);
        const linkSnap = await getDoc(linkRef);

        if (!linkSnap.exists()) {
            throw new Error("Link invalid or expired.");
        }
        
        const { agencyId, contactId } = linkSnap.data();

        // 2. Prepare the data for update
        const contactRef = doc(firestore, 'agencies', agencyId, 'contacts', contactId);
        const contactSnap = await getDoc(contactRef);
        if (!contactSnap.exists()) {
            throw new Error("Contact not found.");
        }
        const existingContact = contactSnap.data() as Contact;

        const dataToUpdate: Partial<Contact> = {};
        
        if (input.budget !== undefined) dataToUpdate.budget = input.budget;
        if (input.city !== undefined) dataToUpdate.city = input.city;
        if (input.generalZone !== undefined) dataToUpdate.generalZone = input.generalZone as Contact['generalZone'];
        if (input.zones !== undefined) dataToUpdate.zones = input.zones;

        const updatedPreferences = { ...existingContact.preferences };
        if (input.preferences?.desiredRooms !== undefined) updatedPreferences.desiredRooms = input.preferences.desiredRooms;
        if (input.preferences?.desiredSquareFootageMin !== undefined) updatedPreferences.desiredSquareFootageMin = input.preferences.desiredSquareFootageMin;
        if (input.preferences?.desiredFeatures !== undefined) updatedPreferences.desiredFeatures = input.preferences.desiredFeatures;
        
        dataToUpdate.preferences = updatedPreferences;
        
        // 3. Update the document
        await updateDoc(contactRef, dataToUpdate);

        return { success: true, message: "Preferences updated successfully." };

    } catch (error: any) {
        console.error("Error updating buyer preferences:", error);
        // Do not expose detailed internal errors to the client
        return { success: false, message: error.message || "An unexpected error occurred." };
    }
  }
);
