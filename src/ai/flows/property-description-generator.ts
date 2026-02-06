
'use server';

/**
 * @fileOverview An AI agent to generate engaging property descriptions from key details.
 *
 * - generatePropertyDescription - A function that generates property descriptions.
 * - PropertyDescriptionInput - The input type for the generatePropertyDescription function.
 * - PropertyDescriptionOutput - The return type for the generatePropertyDescription function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Property } from '@/lib/types';

// The input is the full property object, wrapped for the flow.
const PropertyDescriptionInputSchema = z.object({
  property: z.custom<Property>().describe("The full property object as a JSON object.")
});
export type PropertyDescriptionInput = z.infer<typeof PropertyDescriptionInputSchema>;


const PropertyDescriptionOutputSchema = z.object({
  description: z.string().describe('An engaging and detailed property description written in Romanian.'),
});
export type PropertyDescriptionOutput = z.infer<typeof PropertyDescriptionOutputSchema>;

// The exported function now accepts the raw Property object for easier use by other flows/tools.
export async function generatePropertyDescription(property: Property): Promise<PropertyDescriptionOutput> {
  return propertyDescriptionFlow({ property });
}

const prompt = ai.definePrompt({
  name: 'propertyDescriptionPrompt',
  input: {schema: PropertyDescriptionInputSchema},
  output: {schema: PropertyDescriptionOutputSchema},
  prompt: `You are a real estate expert, and will write a property description in Romanian to attract potential buyers.

  Use the following JSON object which contains all available information about the property to craft a compelling description:
  \`\`\`json
  {{{JSON.stringify(property, null, 2)}}}
  \`\`\`

  Write a description in Romanian that is engaging, highlights the key selling points, and appeals to a broad range of potential buyers.  Be sure to mention the price in the description. The tone should be professional, but also appealing and persuasive.
  Do not just list the features from the JSON. Weave them into a compelling narrative that tells a story and focuses on the benefits for the buyer.
  `,
});

const propertyDescriptionFlow = ai.defineFlow(
  {
    name: 'propertyDescriptionFlow',
    inputSchema: PropertyDescriptionInputSchema,
    outputSchema: PropertyDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
