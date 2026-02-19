'use server';
/**
 * @fileOverview A conversational flow to gather a buyer's preferences via a structured chat.
 */
import { ai } from '@/ai/genkit';
import { z, Message } from 'genkit';
import { adminDb } from '@/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Contact, ContactPreferences } from '@/lib/types';


// Define the structure of the JSON state object the AI will manage
const ConversationStateSchema = z.object({
  buget_max: z.number().nullable(),
  camere: z.number().nullable(),
  zona_generala: z.string(),
  zona_specifica: z.string(),
  imobil_nou: z.boolean().nullable(),
  accepta_imobil_vechi: z.boolean().nullable(),
  an_minim_constructie: z.number().nullable(),
  scop_achizitie: z.string(),
  urgenta: z.string(),
  modalitate_plata: z.string(),
  preferinte: z.array(z.string()),
  mesaj_final: z.string(),
  pas_curent: z.number(),
  completat: z.boolean(),
});
type ConversationState = z.infer<typeof ConversationStateSchema>;


// Define schemas for the flow itself
const PreferencesChatInputSchema = z.object({
  history: z.array(z.custom<Message>()).describe('The chat history.'),
  prompt: z.string().describe("The user's latest message."),
  linkId: z.string().describe("The secure link ID for the buyer."),
});


const PreferencesChatOutputSchema = z.object({
  response: z.string().describe("The AI's text-only response to the user."),
});
export type PreferencesChatOutput = z.infer<typeof PreferencesChatOutputSchema>;


// Main function to be called from the frontend
export async function preferencesChat(input: z.infer<typeof PreferencesChatInputSchema>): Promise<PreferencesChatOutput> {
  return preferencesChatFlow(input);
}


// The main Genkit flow
const preferencesChatFlow = ai.defineFlow(
  {
    name: 'preferencesChatFlow',
    inputSchema: PreferencesChatInputSchema,
    outputSchema: PreferencesChatOutputSchema,
  },
  async (input) => {
    // This is the new, strict conversational flow prompt
    const systemPrompt = `
# Rolul tău:
Ești un agent AI care colectează preferințele unui cumpărător imobiliar pentru a le transmite unui consultant uman. Scopul tău este să porți o conversație naturală și plăcută, dar structurată.

NU oferi proprietăți. NU recomanzi apartamente. NU analizezi piața. NU faci estimări. Doar colectezi informații în ordinea stabilită.

# STIL DE COMUNICARE:
- Vorbește natural, ca un consultant uman.
- Poți folosi 1-2 propoziții introductive scurte înainte de întrebare.
- Arată empatie și implicare.
- Fără texte lungi. Fără explicații tehnice.
- O singură întrebare principală per mesaj.

# IMPORTANT:
Nu combina întrebările. Nu sari peste pași. Nu modifica ordinea. Nu adăuga întrebări suplimentare în afara flow-ului.

# FLOW OBLIGATORIU:
Pornind de la istoricul conversației și ultimul mesaj al utilizatorului, continuă la următorul pas.

0. Mesaj de bun venit și prima întrebare (doar pentru primul mesaj, într-un singur răspuns): "Bună! Mă bucur că ai ajuns aici 😊 Te voi ajuta să transmitem preferințele tale unui consultant imobiliar. Îți voi adresa câteva întrebări scurte, ca să înțelegem exact ce cauți. Ca să începem, spune-mi te rog care este bugetul tău maxim pentru achiziție?"
1. Număr camere: "Perfect. Câte camere îți dorești?"
2. Zonă generală: "Am notat. În ce zonă generală cauți? Nord, Sud, Est, Vest sau ești deschis către oricare?"
3. Zonă specifică: "Excelent. Ai o preferință pentru o zonă mai exactă? De exemplu: Crângași, Pipera, Aviației etc."
4. Imobil nou: "Mulțumesc. Îți dorești un imobil nou sau ești flexibil în această privință?"
5. Acceptare imobil vechi: "Ok. Accepți și imobil vechi?"
6. An minim construcție (doar dacă la pasul 5 răspunsul este DA): "Înțeles. Care ar fi anul minim de construcție pe care îl consideri acceptabil?"
7. Scop achiziție: "Aproape am terminat. Proprietatea este pentru locuit sau pentru investiție?"
8. Urgență: "Cât de urgentă este achiziția pentru tine?"
9. Modalitate plată: "Vei achiziționa prin cash, credit sau încă nu este stabilit?"
10. Preferințe: "Super. Ai alte preferințe importante? De exemplu apropiere de metrou, centrală proprie, etaj intermediar, balcon etc."
11. Mesaj final: "Dacă mai există detalii sau lucruri importante pentru tine, le poți menționa aici."

La final (după pasul 11), mulțumește natural: "Îți mulțumesc pentru informații 🙌 Le transmitem către un consultant care te va contacta în cel mai scurt timp." și setează "completat" la true.

# STRUCTURĂ DATE (OBLIGATORIU)
La finalul fiecărui răspuns TREBUIE să returnezi un bloc JSON actualizat, separat de textul conversațional prin "---JSON---". Completează câmpurile pe baza răspunsurilor utilizatorului.

Format:
---JSON---
{
  "buget_max": null,
  "camere": null,
  "zona_generala": "",
  "zona_specifica": "",
  "imobil_nou": null,
  "accepta_imobil_vechi": null,
  "an_minim_constructie": null,
  "scop_achizitie": "",
  "urgenta": "",
  "modalitate_plata": "",
  "preferinte": [],
  "mesaj_final": "",
  "pas_curent": 0,
  "completat": false
}

Reguli JSON:
- Completează doar ce este sigur. Nu inventa valori.
- 'pas_curent' trebuie să reflecte etapa actuală a conversației conform flow-ului (0–11). Când adresezi întrebarea de la pasul 0, setează pas_curent la 0. Când primești răspunsul și adresezi întrebarea de la pasul 1, setează pas_curent la 1, și așa mai departe.
- 'completat' devine true doar după ultimul pas.
- Dacă utilizatorul nu acceptă imobil vechi, 'an_minim_constructie' rămâne null.
- Blocul JSON trebuie să fie ultimul element din răspuns, precedat de "---JSON---". Nu adăuga explicații după JSON.
`;

    const history: Message[] = [
      { role: 'system', content: [{ text: systemPrompt }] },
      ...input.history,
    ];

    const aiResponse = await ai.generate({
      prompt: input.prompt,
      history,
      model: 'googleai/gemini-2.5-flash',
    });
    
    const responseText = aiResponse.text;

    // Split the response into conversational text and the JSON state
    const separator = '---JSON---';
    const parts = responseText.split(separator);
    const conversationalPart = parts[0].trim();
    const jsonPart = parts.length > 1 ? parts[1].trim() : null;

    let conversationState: ConversationState | null = null;
    if (jsonPart) {
      try {
        conversationState = ConversationStateSchema.parse(JSON.parse(jsonPart));
      } catch (e) {
        console.error("Failed to parse JSON state from AI response:", e);
        // Don't save if JSON is malformed
      }
    }

    // --- Save conversation and update contact data ---
    if (input.linkId) {
        try {
            const linkRef = adminDb.collection('buyer-preferences-links').doc(input.linkId);
            const linkSnap = await linkRef.get();

            if (linkSnap.exists) {
                const { agencyId, contactId } = linkSnap.data()!;
                const contactRef = adminDb.collection('agencies').doc(agencyId).collection('contacts').doc(contactId);

                // 1. Save chat history
                const userMessageToSave = { role: 'user' as const, content: input.prompt };
                const aiMessageToSave = { role: 'model' as const, content: conversationalPart };
                
                await contactRef.update({
                    preferencesChatHistory: FieldValue.arrayUnion(userMessageToSave, aiMessageToSave)
                });
                
                // 2. If state is valid and conversation is complete, update contact details
                if (conversationState && conversationState.completat) {
                    const dataToUpdate: { [key: string]: any } = {};
                    if(conversationState.buget_max) dataToUpdate.budget = conversationState.buget_max;
                    if(conversationState.zona_generala) dataToUpdate.generalZone = conversationState.zona_generala as Contact['generalZone'];
                    if(conversationState.zona_specifica) dataToUpdate.zones = [conversationState.zona_specifica];

                    const preferencesToUpdate: Partial<ContactPreferences> = {};
                    if(conversationState.camere) preferencesToUpdate.desiredRooms = conversationState.camere;
                    if(conversationState.an_minim_constructie) {
                      // This might need more fields in the contact preferences
                    }
                    if(conversationState.preferinte.length > 0) preferencesToUpdate.desiredFeatures = conversationState.preferinte.join(', ');
                    
                    if (Object.keys(preferencesToUpdate).length > 0) {
                      dataToUpdate.preferences = preferencesToUpdate;
                    }
                    
                    if (Object.keys(dataToUpdate).length > 0) {
                       await contactRef.update(dataToUpdate);
                    }
                }
            }
        } catch (error) {
            console.error("Error saving chat history or contact data:", error);
            // We still return the response to the user even if saving fails
        }
    }
    
    return {
      response: conversationalPart, // Only return the text part to the frontend
    };
  }
);
