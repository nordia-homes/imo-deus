// LeadScoring Flow
'use server';
/**
 * @fileOverview A lead scoring AI agent.
 *
 * - leadScoring - A function that handles the lead scoring process.
 * - LeadScoringInput - The input type for the leadScoring function.
 * - LeadScoringOutput - The return type for the leadScoring function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const LeadScoringInputSchema = z.object({
  engagementLevel: z
    .string()
    .describe(
      'How engaged is the lead? (e.g., high, medium, low). Consider factors like frequency of interaction, responsiveness, and interest shown.'
    ),
  potentialValue: z
    .string()
    .describe(
      'What is the potential value of this lead? (e.g., high, medium, low). Consider factors like budget, timeline, and needs alignment.'
    ),
  leadDetails: z
    .string()
    .describe('Additional details about the lead such as name, background.'),
});
export type LeadScoringInput = z.infer<typeof LeadScoringInputSchema>;

const LeadScoringOutputSchema = z.object({
  score: z
    .number()
    .describe(
      'A numerical score (0-100) representing the lead quality. Higher score indicates a better lead.'
    ),
  reason: z
    .string()
    .describe('Explanation of why the lead received the score assigned.'),
});
export type LeadScoringOutput = z.infer<typeof LeadScoringOutputSchema>;

export async function leadScoring(input: LeadScoringInput): Promise<LeadScoringOutput> {
  return leadScoringFlow(input);
}

const prompt = ai.definePrompt({
  name: 'leadScoringPrompt',
  input: {schema: LeadScoringInputSchema},
  output: {schema: LeadScoringOutputSchema},
  prompt: `You are an AI assistant that scores real estate leads.

  Given the following information about a lead, provide a score between 0 and 100 and a short explanation for the score.

  Lead Details: {{{leadDetails}}}
  Engagement Level: {{{engagementLevel}}}
  Potential Value: {{{potentialValue}}}

  Score: (0-100)
  Reason: Explanation of score.

  Make sure to output the score as a number and the reason as a string.
  `,
});

const leadScoringFlow = ai.defineFlow(
  {
    name: 'leadScoringFlow',
    inputSchema: LeadScoringInputSchema,
    outputSchema: LeadScoringOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
