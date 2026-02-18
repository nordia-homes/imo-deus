'use server';
/**
 * @fileOverview A conversational flow to gather and update a buyer's preferences.
 */
import { ai } from '@/ai/genkit';
import { z, Message } from 'genkit';
import { updateContactPreferences, UpdateBuyerPreferencesInputSchema } from './update-buyer-preferences';

// Define schemas
export const PreferencesChatInputSchema = z.object({
  history: z.array(z.custom<Message>()).describe('The chat history.'),
  prompt: z.string().describe("The user's latest message."),
  linkId: z.string().describe("The secure link ID for the buyer."),
});
export type PreferencesChatInput = z.infer<typeof PreferencesChatInputSchema>;

export const PreferencesChatOutputSchema = z.object({
  response: z.string().describe("The AI's response to the user."),
});
export type PreferencesChatOutput = z.infer<typeof PreferencesChatOutputSchema>;

// The main function to be called from the frontend
export async function preferencesChat(input: PreferencesChatInput): Promise<PreferencesChatOutput> {
  return preferencesChatFlow(input);
}

// Define the tool for the AI to use when it has all the information
const savePreferencesTool = ai.defineTool(
  {
    name: 'saveBuyerPreferences',
    description: 'When you have gathered all the necessary preferences from the user (budget, city, zones, rooms, and any other notes), call this tool to save them.',
    inputSchema: UpdateBuyerPreferencesInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string() }),
  },
  async (input) => {
    return await updateContactPreferences(input);
  }
);

// The main Genkit flow
const preferencesChatFlow = ai.defineFlow(
  {
    name: 'preferencesChatFlow',
    inputSchema: PreferencesChatInputSchema,
    outputSchema: PreferencesChatOutputSchema,
  },
  async (input) => {
    const systemPrompt = `
      You are a friendly and professional real estate assistant. Your goal is to have a natural conversation with a potential buyer to understand their preferences for a new home.

      Your persona: You are helpful, modern, and use emojis to keep the conversation light and engaging. You are talking to them through a sleek, native-app-like chat interface.

      Your process:
      1. Greet the user warmly.
      2. Ask questions ONE AT A TIME to gather the following information:
         - Their desired budget (e.g., "Ce buget ai? 💰").
         - The number of rooms they want (e.g., "Câte camere îți dorești? 🛏️").
         - The city they are interested in (e.g., "În ce oraș cauți? 🏙️").
         - Specific zones or neighborhoods in that city.
         - Any other important features or notes (e.g., "Mai e ceva important pentru tine? O grădină, un balcon mare, aproape de metrou? 🌿").
      3. Be conversational. If a user gives you multiple pieces of information at once, acknowledge them and continue to the next logical question.
      4. Once you have collected all the necessary information, you MUST call the 'saveBuyerPreferences' tool. Pass ALL the collected information and the 'linkId' to the tool.
      5. After calling the tool, respond to the user with a confirmation message from the tool's output. For example: "Perfect! Am salvat preferințele tale. Agentul tău va reveni cu cele mai bune oferte. Mulțumim! ✨"
      
      IMPORTANT: You have been given a 'linkId'. You MUST pass this 'linkId' to the 'saveBuyerPreferences' tool when you call it. The tool will fail without it. The current linkId is: ${input.linkId}
    `;

    const history: Message[] = [
      { role: 'system', content: [{ text: systemPrompt }] },
      ...input.history,
    ];

    const response = await ai.generate({
      prompt: input.prompt,
      history,
      tools: [savePreferencesTool],
      model: 'googleai/gemini-2.5-flash',
    });

    return {
      response: response.text,
    };
  }
);
