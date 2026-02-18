
// LeadScoring Flow
'use server';
/**
 * @fileOverview A buyer scoring AI agent.
 *
 * - scoreBuyer - A function that handles the lead scoring process.
 * - ScoreBuyerInput - The input type for the scoreBuyer function.
 * - ScoreBuyerOutput - The return type for the scoreBuyer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ScoreBuyerInputSchema = z.object({
  engagementLevel: z
    .string()
    .describe(
      'How engaged is the buyer? (e.g., high, medium, low). Consider factors like frequency of interaction, responsiveness, and interest shown.'
    ),
  potentialValue: z
    .string()
    .describe(
      'What is the potential value of this buyer? (e.g., high, medium, low). Consider factors like budget, timeline, and needs alignment.'
    ),
  buyerDetails: z
    .string()
    .describe('Additional details about the buyer such as name, background.'),
});
export type ScoreBuyerInput = z.infer<typeof ScoreBuyerInputSchema>;

const ScoreBuyerOutputSchema = z.object({
  score: z
    .number()
    .describe(
      'A numerical score (0-100) representing the buyer quality. Higher score indicates a better buyer.'
    ),
  reason: z
    .string()
    .describe('Explanation in Romanian of why the buyer received the score assigned.'),
});
export type ScoreBuyerOutput = z.infer<typeof ScoreBuyerOutputSchema>;

export async function leadScoring(input: ScoreBuyerInput): Promise<ScoreBuyerOutput> {
  return scoreBuyerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'leadScoringPrompt',
  input: {schema: ScoreBuyerInputSchema},
  output: {schema: ScoreBuyerOutputSchema},
  prompt: `You are an AI assistant that scores real estate buyers for the Romanian market.

  Given the following information about a buyer, provide a score between 0 and 100 and a short explanation for the score, in Romanian.

  Buyer Details: {{{buyerDetails}}}
  Engagement Level: {{{engagementLevel}}}
  Potential Value: {{{potentialValue}}}

  The output must be in Romanian.

  Score: (0-100)
  Reason: Explanation of score.

  Make sure to output the score as a number and the reason as a string. The reason must be in Romanian.
  `,
});

const scoreBuyerFlow = ai.defineFlow(
  {
    name: 'scoreBuyerFlow',
    inputSchema: ScoreBuyerInputSchema,
    outputSchema: ScoreBuyerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
