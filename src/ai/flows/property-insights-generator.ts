'use server';
/**
 * @fileOverview An AI agent to generate insights for a property.
 *
 * - generatePropertyInsights - A function that generates insights for a property.
 * - PropertyInsightsInput - The input type for the generatePropertyInsights function.
 * - PropertyInsightsOutput - The return type for the generatePropertyInsights function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PropertyInsightsInputSchema = z.object({
  propertyType: z.string().describe('The type of property (e.g., house, apartment).'),
  location: z.string().describe('The location of the property (city, neighborhood).'),
  price: z.number().describe('The asking price of the property in EUR.'),
  bedrooms: z.number().describe('The number of bedrooms.'),
  squareFootage: z.number().describe('The square footage of the property.'),
  constructionYear: z.number().optional().describe('The year the property was built.'),
  keyFeatures: z.string().describe('A comma-separated list of key features.'),
});
export type PropertyInsightsInput = z.infer<typeof PropertyInsightsInputSchema>;

const PropertyInsightsOutputSchema = z.object({
  marketScore: z.number().min(0).max(100).describe('A score from 0-100 representing how attractive the property is on the current market. Higher is better.'),
  pricingFeedback: z.string().describe('A brief, constructive analysis of the property\'s price compared to the market. Written in Romanian.'),
  buyerProfile: z.string().describe('A short description of the ideal buyer profile for this property. Written in Romanian.'),
});
export type PropertyInsightsOutput = z.infer<typeof PropertyInsightsOutputSchema>;

export async function generatePropertyInsights(
  input: PropertyInsightsInput
): Promise<PropertyInsightsOutput> {
  return propertyInsightsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'propertyInsightsPrompt',
  input: {schema: PropertyInsightsInputSchema},
  output: {schema: PropertyInsightsOutputSchema},
  prompt: `You are an expert real estate market analyst for the Romanian market.
  Your task is to provide insightful analysis for a given property.
  Analyze the following property details and generate a market score, pricing feedback, and an ideal buyer profile.
  The analysis must be in Romanian.

  Property Details:
  - Type: {{{propertyType}}}
  - Location: {{{location}}}
  - Price: €{{{price}}}
  - Bedrooms: {{{bedrooms}}}
  - Square Footage: {{{squareFootage}}} mp
  - Year Built: {{{constructionYear}}}
  - Key Features: {{{keyFeatures}}}

  Based on these details, generate the requested insights. The market score should reflect desirability, location, price, and features.
  The pricing feedback should be concise and compare the price to the general market for such a property.
  The buyer profile should describe the most likely interested demographic.
  `,
});

const propertyInsightsFlow = ai.defineFlow(
  {
    name: 'propertyInsightsFlow',
    inputSchema: PropertyInsightsInputSchema,
    outputSchema: PropertyInsightsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
