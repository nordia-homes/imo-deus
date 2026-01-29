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

const PropertyDescriptionInputSchema = z.object({
  propertyType: z.string().describe('The type of property (e.g., house, apartment, condo).'),
  location: z.string().describe('The location of the property (city, neighborhood).'),
  bedrooms: z.number().int().positive().describe('The number of bedrooms in the property.'),
  bathrooms: z.number().positive().describe('The number of bathrooms in the property.'),
  squareFootage: z.number().positive().describe('The square footage of the property.'),
  keyFeatures: z.string().describe('A comma separated list of key features of the property.'),
  price: z.number().positive().describe('The price of the property'),
});
export type PropertyDescriptionInput = z.infer<typeof PropertyDescriptionInputSchema>;

const PropertyDescriptionOutputSchema = z.object({
  description: z.string().describe('An engaging and detailed property description.'),
});
export type PropertyDescriptionOutput = z.infer<typeof PropertyDescriptionOutputSchema>;

export async function generatePropertyDescription(input: PropertyDescriptionInput): Promise<PropertyDescriptionOutput> {
  return propertyDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'propertyDescriptionPrompt',
  input: {schema: PropertyDescriptionInputSchema},
  output: {schema: PropertyDescriptionOutputSchema},
  prompt: `You are a real estate expert, and will write a property description to attract potential buyers.

  Use the following information about the property to craft a compelling description:

  Property Type: {{{propertyType}}}
  Location: {{{location}}}
  Bedrooms: {{{bedrooms}}}
  Bathrooms: {{{bathrooms}}}
  Square Footage: {{{squareFootage}}}
  Key Features: {{{keyFeatures}}}
  Price: {{{price}}}

  Write a description that is engaging, highlights the key selling points, and appeals to a broad range of potential buyers.  Be sure to mention the price in the description.
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
