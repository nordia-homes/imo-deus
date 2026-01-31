'use server';
/**
 * @fileOverview An AI agent to generate legal contracts for real estate transactions.
 *
 * - generateContract - A function that generates contract text.
 * - GenerateContractInput - The input type for the function.
 * - GenerateContractOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

export const GenerateContractInputSchema = z.object({
  propertyTitle: z.string().describe("The official title or address of the property."),
  contactName: z.string().describe("The full name of the client (buyer or tenant)."),
  agentName: z.string().describe("The full name of the real estate agent representing the agency."),
  agencyName: z.string().describe("The name of the real estate agency."),
  price: z.number().describe("The final agreed price for the transaction in EUR."),
  contractType: z.enum(['Vânzare-Cumpărare', 'Închiriere']).describe("The type of contract."),
  language: z.enum(['ro']).default('ro').describe("The language for the contract content."),
});
export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;

export const GenerateContractOutputSchema = z.object({
  content: z.string().describe('The full legal text of the contract, formatted and ready for inclusion in a document.'),
});
export type GenerateContractOutput = z.infer<typeof GenerateContractOutputSchema>;

export async function generateContract(input: GenerateContractInput): Promise<GenerateContractOutput> {
  return generateContractFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateContractPrompt',
  input: {schema: GenerateContractInputSchema},
  output: {schema: GenerateContractOutputSchema},
  prompt: `
You are a legal expert specializing in Romanian real estate law.
Your task is to generate the full text for a standard {{{contractType}}} contract.
The language of the contract MUST be Romanian.

**CRITICAL INSTRUCTIONS:**
- The output must be the complete, well-formatted legal text of the contract.
- Do NOT include any introductory text like "Here is the contract" or any concluding remarks. Only output the contract content itself.
- Use placeholders like "[Data Semnării]", "[Adresa Notar]", "[Nume Notar]" where the user will need to fill in specific details later.
- The text should be structured with clear articles and clauses.

**Contract Details:**
- **Tip Contract:** {{{contractType}}}
- **Client (Cumpărător/Chiriaș):** {{{contactName}}}
- **Proprietate:** {{{propertyTitle}}}
- **Preț Tranzacție:** {{{price}}} EUR
- **Agenție Reprezentantă:** {{{agencyName}}}
- **Agent:** {{{agentName}}}

Generate the appropriate legal text based on the contract type. Be thorough and professional.
For a 'Vânzare-Cumpărare' contract, include sections on the object of the contract, price and payment terms, transfer of ownership, declarations of the parties, and final clauses.
For an 'Închiriere' contract, include sections on the object of the contract, rent and payment terms, duration of the lease, rights and obligations of the parties, and termination clauses.
`,
});

const generateContractFlow = ai.defineFlow(
  {
    name: 'generateContractFlow',
    inputSchema: GenerateContractInputSchema,
    outputSchema: GenerateContractOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
