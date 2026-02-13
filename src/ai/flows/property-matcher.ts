
// This file uses server-side code.
'use server';

/**
 * @fileOverview Matches properties to client preferences using AI.
 *
 * - propertyMatcher - A function that matches properties to client preferences.
 * - PropertyMatcherInput - The input type for the propertyMatcher function.
 * - PropertyMatcherOutput - The return type for the propertyMatcher function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PropertySchema = z.object({
  address: z.string().describe('The address of the property.'),
  price: z.coerce.number().describe('The price of the property in USD.'),
  rooms: z.coerce.number().describe('The number of rooms in the property.'),
  bathrooms: z.coerce.number().describe('The number of bathrooms in the property.'),
  squareFootage: z.coerce.number().describe('The square footage of the property.'),
  description: z.string().describe('A detailed description of the property.'),
  image: z.string().describe('A URL of an image of the property.'),
});

const ClientPreferencesSchema = z.object({
  desiredPriceRangeMin: z.coerce.number().describe('The minimum desired price.'),
  desiredPriceRangeMax: z.coerce.number().describe('The maximum desired price.'),
  desiredRooms: z.coerce.number().describe('The desired number of rooms.'),
  desiredBathrooms: z.coerce.number().describe('The desired number of bathrooms.'),
  desiredSquareFootageMin: z.coerce.number().describe('The minimum desired square footage.'),
  desiredSquareFootageMax: z.coerce.number().describe('The maximum desired square footage.'),
  desiredFeatures: z.string().describe('A description of the desired features of the property.'),
  locationPreferences: z.string().describe('The desired location or neighborhood.'),
});

const PropertyMatcherInputSchema = z.object({
  clientPreferences: ClientPreferencesSchema.describe('The client\s property preferences.'),
  properties: z.array(PropertySchema).describe('A list of available properties.'),
});
export type PropertyMatcherInput = z.infer<typeof PropertyMatcherInputSchema>;

const MatchedPropertySchema = PropertySchema.extend({
    matchScore: z.number().describe('A score indicating how well the property matches the client preferences (0-100).'),
    reasoning: z.string().describe('Explanation of why the property was matched and the score it received.')
});

const PropertyMatcherOutputSchema = z.object({
  matchedProperties: z.array(MatchedPropertySchema).describe('A list of properties matched to the client preferences, sorted by match score.'),
});
export type PropertyMatcherOutput = z.infer<typeof PropertyMatcherOutputSchema>;

export async function propertyMatcher(input: PropertyMatcherInput): Promise<PropertyMatcherOutput> {
  return propertyMatcherFlow(input);
}

const propertyMatcherPrompt = ai.definePrompt({
  name: 'propertyMatcherPrompt',
  input: {schema: PropertyMatcherInputSchema},
  output: {schema: PropertyMatcherOutputSchema},
  prompt: `You are an expert real estate agent who specializes in matching properties to client preferences.

Given the following client preferences:

Desired Price Range: {{clientPreferences.desiredPriceRangeMin}} - {{clientPreferences.desiredPriceRangeMax}}
Desired Rooms: {{clientPreferences.desiredRooms}}
Desired Bathrooms: {{clientPreferences.desiredBathrooms}}
Desired Square Footage: {{clientPreferences.desiredSquareFootageMin}} - {{clientPreferences.desiredSquareFootageMax}}
Desired Features: {{clientPreferences.desiredFeatures}}
Location Preferences: {{clientPreferences.locationPreferences}}

And the following list of available properties:

{{#each properties}}
Address: {{this.address}}
Price: {{this.price}}
Rooms: {{this.rooms}}
Bathrooms: {{this.bathrooms}}
Square Footage: {{this.squareFootage}}
Description: {{this.description}}
Image: {{this.image}}
{{/each}}

Match the properties to the client preferences and return a list of matched properties, sorted by match score in descending order.
Include a match score (0-100) and reasoning for each matched property. Only return the properties that are considered a good match.
`,
});

const propertyMatcherFlow = ai.defineFlow(
  {
    name: 'propertyMatcherFlow',
    inputSchema: PropertyMatcherInputSchema,
    outputSchema: PropertyMatcherOutputSchema,
  },
  async input => {
    const {output} = await propertyMatcherPrompt(input);
    return output!;
  }
);

    