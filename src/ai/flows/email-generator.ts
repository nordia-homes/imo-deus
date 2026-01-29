'use server';
/**
 * @fileOverview An AI agent to generate professional emails for real estate agents.
 *
 * - generateEmail - A function that generates emails.
 * - GenerateEmailInput - The input type for the generateEmail function.
 * - GenerateEmailOutput - The return type for the generateEmail function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateEmailInputSchema = z.object({
  goal: z.string().describe('The main purpose of the email (e.g., "Follow-up after viewing", "Initial contact").'),
  contactName: z.string().describe("The name of the client receiving the email."),
  agentName: z.string().describe("The name of the agent sending the email."),
  additionalContext: z.string().optional().describe("Any additional context, notes, or specific points to include in the email."),
});
export type GenerateEmailInput = z.infer<typeof GenerateEmailInputSchema>;

const GenerateEmailOutputSchema = z.object({
  subject: z.string().describe('The subject line of the generated email.'),
  body: z.string().describe('The body content of the generated email.'),
});
export type GenerateEmailOutput = z.infer<typeof GenerateEmailOutputSchema>;

export async function generateEmail(input: GenerateEmailInput): Promise<GenerateEmailOutput> {
  return generateEmailFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateEmailPrompt',
  input: {schema: GenerateEmailInputSchema},
  output: {schema: GenerateEmailOutputSchema},
  prompt: `You are an expert real estate agent assistant in Romania. Your task is to write a professional and friendly email in Romanian.

  Your goal is: {{{goal}}}
  The client's name is: {{{contactName}}}
  Your (the agent's) name is: {{{agentName}}}

  Here is some additional context to include or consider:
  {{{additionalContext}}}

  Generate a suitable subject line and a well-written email body. The tone should be helpful and professional, encouraging a response from the client. End the email with a closing and the agent's name.
  Do not include placeholders like "[Your Phone Number]" or "[Link to property]". The agent will add those manually.
  `,
});

const generateEmailFlow = ai.defineFlow(
  {
    name: 'generateEmailFlow',
    inputSchema: GenerateEmailInputSchema,
    outputSchema: GenerateEmailOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
