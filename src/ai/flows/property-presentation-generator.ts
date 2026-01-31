'use server';
/**
 * @fileOverview An AI agent to generate beautiful, professional PDF presentations for properties.
 *
 * - generatePropertyPresentation - A function that generates presentation HTML.
 * - GeneratePropertyPresentationInput - The input type for the function.
 * - GeneratePropertyPresentationOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePropertyPresentationInputSchema = z.object({
  propertyTitle: z.string().describe("The main title of the property listing."),
  propertyType: z.string().describe("The type of property (e.g., 'Apartament', 'Casă/Vilă')."),
  price: z.number().describe("The price of the property in EUR."),
  transactionType: z.string().describe("The transaction type ('Vânzare' or 'Închiriere')."),
  location: z.string().describe("The general location or neighborhood of the property."),
  bedrooms: z.number().describe("Number of bedrooms."),
  bathrooms: z.number().describe("Number of bathrooms."),
  squareFootage: z.number().describe("The square footage of the property."),
  description: z.string().describe("The detailed description of the property."),
  keyFeatures: z.array(z.string()).describe("A list of key features or amenities."),
  
  // Branding & Contact
  agentName: z.string().describe("The name of the real estate agent."),
  agentEmail: z.string().describe("The email address of the agent."),
  agentPhone: z.string().optional().describe("The phone number of the agent."),
  agencyName: z.string().describe("The name of the real estate agency."),
  agencyLogoUrl: z.string().url().optional().describe("The URL for the agency's logo."),
  agencyPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().describe("The primary brand color of the agency in hex format (e.g., #1E3A8A)."),
  
  // Settings
  language: z.enum(['ro', 'en']).describe("The language for the presentation content ('ro' for Romanian, 'en' for English)."),
  imageCount: z.number().int().min(1).describe("The number of images available for the property, to be used for placeholders."),
});
export type GeneratePropertyPresentationInput = z.infer<typeof GeneratePropertyPresentationInputSchema>;

const GeneratePropertyPresentationOutputSchema = z.object({
  htmlContent: z.string().describe('The full HTML content of the property presentation, including inline CSS, ready for printing.'),
});
export type GeneratePropertyPresentationOutput = z.infer<typeof GeneratePropertyPresentationOutputSchema>;

export async function generatePropertyPresentation(input: GeneratePropertyPresentationInput): Promise<GeneratePropertyPresentationOutput> {
  return generatePropertyPresentationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePropertyPresentationPrompt',
  input: {schema: GeneratePropertyPresentationInputSchema},
  output: {schema: GeneratePropertyPresentationOutputSchema},
  prompt: `
You are a professional graphic designer and marketing expert for a luxury real estate agency.
Your task is to create the complete HTML code for a stunning, print-ready, A4-sized property presentation brochure.
The language of the brochure must be {{{language}}}.

**CRITICAL INSTRUCTIONS:**
- The output MUST be a single block of HTML code.
- The HTML must be self-contained. All CSS styling MUST be included within a single \`<style>\` tag in the \`<head>\`. DO NOT use external stylesheets or scripts.
- Use a professional and clean layout. Use a common, web-safe font like 'Helvetica', 'Arial', or 'sans-serif'.
- The design must be elegant and visually appealing, suitable for a high-end client.
- Use the agency's primary color ({{{agencyPrimaryColor}}}) for headings, borders, and other accents to maintain brand consistency.
- **Image Placeholders:** You have {{{imageCount}}} images available. Use special placeholders \`{{IMAGE_URL_X}}\` where 'X' is the image number (from 0 to {{{imageCount-1}}}). I will replace these with the actual image URLs later. Create a compelling layout for these images. A good pattern is a large main image, followed by a grid of smaller images.

**BROCHURE CONTENT & STRUCTURE:**
1.  **Header:** Include the agency logo (if available) and the agency name.
2.  **Main Section:**
    *   The property title: "{{{propertyTitle}}}".
    *   The location: "{{{location}}}".
    *   A compelling, professionally-written marketing summary based on the provided description: "{{{description}}}". Rephrase it to be more engaging and persuasive for a brochure.
    *   Key highlights section with icons (use inline SVG for icons) for: Bedrooms, Bathrooms, Square Footage.
3.  **Image Gallery Section:** Create a visually appealing layout for the images. Use the \`{{IMAGE_URL_X}}\` placeholders. For example, a full-width main image \`{{IMAGE_URL_0}}\` and then a grid for \`{{IMAGE_URL_1}}\`, \`{{IMAGE_URL_2}}\`, etc.
4.  **Features & Amenities Section:** List the key features provided: {{{keyFeatures}}}.
5.  **Footer/Contact Section:**
    *   A clear call to action (e.g., "Pentru vizionări și detalii suplimentare" or "For viewings and further details").
    *   Agent's photo placeholder (a simple styled div).
    *   Agent's name: {{{agentName}}}.
    *   Agent's contact details: {{{agentEmail}}} and {{{agentPhone}}}.
    *   Agency name.

**Example for an inline SVG icon (use similar for Bed, Bath, Ruler):**
\`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21.5V16.5C12 14.29 13.79 12.5 16 12.5H20"/><path d="M4.5 16.5H8V21.5H4.5zM4.5 2.5H8V8.5H4.5zM16.5 2.5H20V8.5H16.5zM12 2.5v5"/></svg>\`

Now, generate the complete HTML code based on these instructions and the provided data.
`,
});

const generatePropertyPresentationFlow = ai.defineFlow(
  {
    name: 'generatePropertyPresentationFlow',
    inputSchema: GeneratePropertyPresentationInputSchema,
    outputSchema: GeneratePropertyPresentationOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
