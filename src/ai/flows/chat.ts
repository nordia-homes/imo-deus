'use server';
/**
 * @fileOverview A conversational AI agent for the real estate CRM.
 *
 * - chat - A function that handles the conversational chat process.
 * - ChatInput - The input type for the chat function.
 * - ChatOutput - The return type for the chat function.
 */

import {ai} from '@/ai/genkit';
import {z, Message} from 'genkit';

const ChatInputSchema = z.object({
  history: z.array(z.custom<Message>()).describe('The chat history.'),
  prompt: z.string().describe('The user\'s prompt.'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
  response: z.string().describe('The AI\'s response.'),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chat(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async input => {
    const systemPrompt = `You are a helpful AI assistant for a real estate CRM called EstateFlow.
    Your role is to assist real estate agents with their daily tasks.
    Be concise and professional. The current date is ${new Date().toLocaleDateString()}.
    You can help with tasks like writing property descriptions, creating follow-up emails, or answering questions about the real estate market.`;

    const history: Message[] = [
        {role: 'system', content: [{text: systemPrompt}]},
        ...input.history,
    ];

    const response = await ai.generate({
      prompt: input.prompt,
      history,
    });
    
    return {
      response: response.text,
    };
  }
);
