'use server';
/**
 * @fileOverview An AI agent to generate real estate contracts.
 *
 * - generateContract - A function that generates contract content.
 * - GenerateContractInput - The input type for the generateContract function.
 * - GenerateContractOutput - The return type for the generateContract function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateContractInputSchema = z.object({
  contactName: z.string().describe("The full name of the client (buyer or tenant)."),
  contactAddress: z.string().describe("The full address of the client."),
  agentName: z.string().describe("The name of the real estate agent representing the agency."),
  agencyName: z.string().describe("The name of the real estate agency."),
  propertyAddress: z.string().describe("The full address of the property being transacted."),
  propertyDetails: z.string().describe("A brief description of the property (e.g., 'apartament cu 2 camere, decomandat, etaj 3/8')."),
  price: z.number().describe("The final transaction price in EUR."),
  contractType: z.enum(['Vânzare-Cumpărare', 'Închiriere']).describe("The type of contract to generate."),
  date: z.string().describe("The date the contract is signed, in 'dd.mm.yyyy' format."),
});
export type GenerateContractInput = z.infer<typeof GenerateContractInputSchema>;

const GenerateContractOutputSchema = z.object({
  content: z.string().describe('The full, legally-formatted text of the real estate contract in Romanian.'),
});
export type GenerateContractOutput = z.infer<typeof GenerateContractOutputSchema>;

export async function generateContract(input: GenerateContractInput): Promise<GenerateContractOutput> {
  return generateContractFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateContractPrompt',
  input: {schema: GenerateContractInputSchema},
  output: {schema: GenerateContractOutputSchema},
  prompt: `You are an expert legal assistant specializing in Romanian real estate law. Your task is to generate the full text for a real estate contract based on the provided details. The output must be a single block of text, well-formatted, and legally sound for Romania.

  **Contract Type:** {{{contractType}}}

  **Parties:**
  1.  **{{#if (eq contractType "Vânzare-Cumpărare")}}Vânzător{{else}}Proprietar{{/if}}**: Represented by {{{agentName}}} from {{{agencyName}}}.
  2.  **{{#if (eq contractType "Vânzare-Cumpărare")}}Cumpărător{{else}}Chiriaș{{/if}}**: {{{contactName}}}, residing at {{{contactAddress}}}.

  **Property Details:**
  -   Address: {{{propertyAddress}}}
  -   Description: {{{propertyDetails}}}

  **Transaction Details:**
  -   Price: {{{price}}} EUR
  -   Date of Signature: {{{date}}}

  Please generate the complete contract text in Romanian. Include all standard clauses for a contract of this type, such as:
  -   Object of the contract.
  -   Price and payment method.
  -   Rights and obligations of the parties.
  -   Handover protocol.
  -   Force majeure.
  -   Final provisions and signatures.

  The generated text should be ready to be copy-pasted into a document. Do not include any meta-commentary, just the contract text itself.
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
