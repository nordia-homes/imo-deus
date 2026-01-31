'use server';
/**
 * @fileOverview An AI agent to generate a Comparative Market Analysis (CMA) for a property.
 *
 * - generateCMA - A function that generates the CMA report.
 * - CmaInput - The input type for the generateCMA function.
 * - CmaOutput - The return type for the generateCMA function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { initializeServerFirebase } from '@/firebase/server';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import type { Property } from '@/lib/types';


// Schemas
const CmaInputSchema = z.object({
  subjectProperty: z.custom<Property>().describe("The property for which the CMA is being generated."),
  allProperties: z.array(z.custom<Property>()).describe("A list of all other properties in the portfolio to be used as potential comparables."),
  agencyId: z.string().describe("The ID of the agency performing the analysis.")
});
export type CmaInput = z.infer<typeof CmaInputSchema>;

const ComparablePropertySchema = z.object({
    id: z.string(),
    address: z.string(),
    status: z.enum(['Activ', 'Vândut', 'Închiriat', 'Inactiv']),
    price: z.number(),
    squareFootage: z.number(),
    bedrooms: z.number(),
    bathrooms: z.number(),
    similarity: z.string().describe("A brief explanation of why this property is a good comparable (e.g., 'Same neighborhood, similar size')."),
});

const PriceAdjustmentSchema = z.object({
    feature: z.string().describe("The feature being adjusted (e.g., 'Extra bathroom', 'Better view', 'Needs renovation')."),
    adjustment: z.string().describe("The monetary adjustment as a formatted string (e.g., '+€5,000', '-€10,000')."),
    reason: z.string().describe("A short justification for the adjustment."),
});

const CmaOutputSchema = z.object({
  subjectPropertyId: z.string(),
  subjectPropertyAddress: z.string(),
  comparableProperties: z.array(ComparablePropertySchema).describe("A list of 3-5 of the best comparable properties."),
  priceAdjustments: z.array(PriceAdjustmentSchema).describe("A list of price adjustments made to the subject property based on the comparables."),
  estimatedValueRange: z.object({
    min: z.number().describe("The lower end of the estimated value range."),
    max: z.number().describe("The upper end of the estimated value range."),
  }).describe("The final estimated market value range for the subject property."),
  notes: z.string().describe("A summary of the market analysis, including commentary on the local market conditions and the rationale for the final valuation. Written in Romanian."),
});
export type CmaOutput = z.infer<typeof CmaOutputSchema>;


// Main exported function
export async function generateCMA(input: CmaInput): Promise<CmaOutput> {
  return cmaFlow(input);
}


// Genkit Tool to get comparable properties from the provided list
const getComparableProperties = ai.defineTool(
    {
        name: 'getComparableProperties',
        description: 'Finds the best comparable properties from a given list based on a subject property.',
        inputSchema: z.object({
            subjectProperty: z.custom<Property>(),
            allProperties: z.array(z.custom<Property>()),
        }),
        outputSchema: z.array(z.custom<Property>()),
    },
    async ({ subjectProperty, allProperties }) => {
        // Simple filtering logic: same location, similar size, not the same property
        const comparables = allProperties
            .filter(p => 
                p.id !== subjectProperty.id &&
                p.location.toLowerCase().includes(subjectProperty.location.toLowerCase()) &&
                Math.abs(p.squareFootage - subjectProperty.squareFootage) < 30 // within 30 sqm
            )
            .sort((a, b) => {
                // Prioritize sold properties, then active, then others
                const statusA = a.status === 'Vândut' ? 1 : a.status === 'Activ' ? 2 : 3;
                const statusB = b.status === 'Vândut' ? 1 : b.status === 'Activ' ? 2 : 3;
                return statusA - statusB;
            })
            .slice(0, 10); // Provide a decent number for the AI to choose from

        return comparables;
    }
);


const prompt = ai.definePrompt({
  name: 'cmaPrompt',
  input: { schema: z.object({ subjectProperty: z.custom<Property>() }) },
  output: { schema: CmaOutputSchema },
  tools: [getComparableProperties],
  prompt: `You are an expert real estate appraiser in Romania. Your task is to perform a Comparative Market Analysis (CMA) for a subject property.

You must use the 'getComparableProperties' tool to find a list of suitable comparables (comps). From the list returned by the tool, select the best 3 to 5 properties.

Your analysis must be in Romanian and follow these steps:
1.  **Analyze the Subject Property:** Briefly describe the key characteristics of the property: {{{JSON.stringify(subjectProperty, null, 2)}}}.
2.  **Select and Analyze Comparables:** For each of the 3-5 comparable properties you select, explain why it's a good comparison (similarity). Include its address, status, price, size, bedrooms, and bathrooms.
3.  **Perform Price Adjustments:** Compare the subject property to the comps. Create a list of adjustments. For features where the subject property is superior, add a positive adjustment (e.g., '+€5,000' for an extra bathroom). Where it's inferior, use a negative adjustment (e.g., '-€10,000' for needing renovation). Justify each adjustment.
4.  **Determine Estimated Value:** Based on the adjusted prices of the comparables, determine a final estimated market value range (min and max) for the subject property.
5.  **Write Summary Notes:** Provide a concluding paragraph that summarizes your findings, comments on current local market conditions (e.g., "Piața este în creștere, cu cerere mare pentru proprietăți renovate."), and justifies the final valuation.

The entire output must be in Romanian. Be professional, data-driven, and clear in your explanations.
`,
});

const cmaFlow = ai.defineFlow(
  {
    name: 'cmaFlow',
    inputSchema: CmaInputSchema,
    outputSchema: CmaOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
