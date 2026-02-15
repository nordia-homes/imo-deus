'use server';
/**
 * @fileOverview An AI agent to generate social media posts for properties.
 *
 * - generateSocialMediaPost - A function that generates the post.
 * - SocialMediaPostInput - The input type for the function.
 * - SocialMediaPostOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const SocialMediaPostInputSchema = z.object({
  title: z.string().describe("The title of the property listing."),
  price: z.number().describe("The price of the property."),
  transactionType: z.string().describe("The type of transaction ('Vânzare' or 'Închiriere')."),
  location: z.string().describe("The location of the property."),
  rooms: z.number().describe("The number of rooms."),
  squareFootage: z.number().describe("The square footage."),
});
export type SocialMediaPostInput = z.infer<typeof SocialMediaPostInputSchema>;

export const SocialMediaPostOutputSchema = z.object({
  post: z.string().describe('The generated social media post content, including emojis and hashtags.'),
});
export type SocialMediaPostOutput = z.infer<typeof SocialMediaPostOutputSchema>;


export async function generateSocialMediaPost(input: SocialMediaPostInput): Promise<SocialMediaPostOutput> {
  return socialMediaPostFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSocialMediaPostPrompt',
  input: {schema: SocialMediaPostInputSchema},
  output: {schema: SocialMediaPostOutputSchema},
  prompt: `You are a creative real estate marketing expert for the Romanian market.
Your task is to write a short, engaging, and professional social media post (for Facebook or Instagram) to promote a property.

Use the following details:
- Titlu: {{{title}}}
- Preț: €{{{price}}}
- Tip: {{{transactionType}}}
- Locație: {{{location}}}
- Camere: {{{rooms}}}
- Suprafață: {{{squareFootage}}} mp

Instructions:
1.  Start with a strong, attention-grabbing hook.
2.  Highlight the best features in a concise way. Use emojis like 🏠, ✨, 🔑, 💰, 📍 to make the post visually appealing.
3.  Include the price and a clear call to action (e.g., "Contactează-ne pentru detalii!" or "Programează o vizionare!").
4.  End with 3-5 relevant hashtags. Include generic ones like #imobiliare, #realestate, #agentieimobiliara, and specific ones based on the location (e.g., #imobiliareBucuresti, #ClujNapoca).
5.  The entire post must be in Romanian. The tone should be enthusiastic but professional.
`,
});

const socialMediaPostFlow = ai.defineFlow(
  {
    name: 'socialMediaPostFlow',
    inputSchema: SocialMediaPostInputSchema,
    outputSchema: SocialMediaPostOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
