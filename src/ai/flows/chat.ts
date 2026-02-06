'use server';
/**
 * @fileOverview A conversational AI agent for the real estate CRM.
 * It uses tools to perform actions like drafting emails and generating descriptions.
 *
 * - chat - A function that handles the conversational chat process.
 * - ChatInput - The input type for the chat function.
 * - ChatOutput - The return type for the chat function.
 */

import {ai} from '@/ai/genkit';
import {z, Message} from 'genkit';
import type { Contact, Property, Agency, UserProfile, PropertyDescriptionInput } from '@/lib/types';
import { generateEmail } from './email-generator';
import { generatePropertyDescription } from './property-description-generator';

const ChatInputSchema = z.object({
  history: z.array(z.custom<Message>()).describe('The chat history.'),
  prompt: z.string().describe('The user\'s prompt.'),
  contacts: z.array(z.custom<Contact>()).optional().describe('A list of all contacts in the CRM.'),
  properties: z.array(z.custom<Property>()).optional().describe('A list of all properties in the CRM.'),
  agency: z.custom<Agency>().optional().describe('The current agency details.'),
  user: z.custom<UserProfile>().optional().describe('The current user profile.'),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

const ChatOutputSchema = z.object({
  response: z.string().describe('The AI\'s response.'),
});
export type ChatOutput = z.infer<typeof ChatOutputSchema>;

export async function chat(input: ChatInput): Promise<ChatOutput> {
  return chatFlow(input);
}

// Define tools. These are wrappers around existing flows.
const getEmailDraft = ai.defineTool(
  {
    name: 'getEmailDraft',
    description: 'Generates a draft for a professional email to a real estate client. Use this when the user wants to write an email.',
    inputSchema: z.object({
      goal: z.string().describe('The main purpose of the email (e.g., "Follow-up after viewing", "Initial contact").'),
      contactName: z.string().describe("The name of the client receiving the email."),
      additionalContext: z.string().optional().describe("Any other relevant details or context to include."),
    }),
    outputSchema: z.object({
      subject: z.string(),
      body: z.string(),
    }),
  },
  async (input) => generateEmail({ ...input, agentName: 'You' }) // The prompt will instruct the AI to use the agent's actual name.
);

const getPropertyDescription = ai.defineTool(
  {
    name: 'getPropertyDescription',
    description: 'Generates an engaging, market-ready description for a property based on its key details. Use this when a user asks to write a description for a property.',
    inputSchema: z.custom<PropertyDescriptionInput>(),
    outputSchema: z.object({
      description: z.string(),
    }),
  },
  async (input) => generatePropertyDescription(input)
);


const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    const { contacts, properties, agency, user } = input;

    // Define contextual tools here so they have access to flow input
    const listRecentLeads = ai.defineTool(
      {
        name: 'listRecentLeads',
        description: 'Gets a summary of the most recently added leads or contacts from the provided list.',
        inputSchema: z.object({
          count: z.number().optional().default(5).describe("Number of leads to return."),
        }),
        outputSchema: z.array(z.object({ name: z.string(), status: z.string(), budget: z.number().optional() })),
      },
      async ({ count }) => {
        if (!contacts) return [];
        return contacts
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, count)
          .map(c => ({ name: c.name, status: c.status, budget: c.budget }));
      }
    );

    const getPropertyDetails = ai.defineTool(
        {
            name: 'getPropertyDetails',
            description: 'Retrieves key details for a specific property by its title or partial title from the provided list of properties.',
            inputSchema: z.object({
                propertyTitle: z.string().describe("The title or a key part of the title of the property to find."),
            }),
            outputSchema: z.custom<PropertyDescriptionInput>().nullable(),
        },
        async ({ propertyTitle }) => {
            if (!properties) return null;
            const prop = properties.find(p => p.title.toLowerCase().includes(propertyTitle.toLowerCase()));
            if (!prop) return null;
            // Return the data in the format needed for the getPropertyDescription tool
            return {
                propertyType: prop.propertyType,
                location: prop.location,
                rooms: prop.rooms,
                bathrooms: prop.bathrooms,
                squareFootage: prop.squareFootage,
                keyFeatures: prop.keyFeatures || '',
                price: prop.price,
            };
        }
    );

    const systemPrompt = `You are EstateFlow AI, a world-class, proactive real estate assistant integrated into a CRM. Your goal is to help real estate agents be more efficient and successful. You are conversational, professional, and always looking for opportunities to help.

The current date is ${new Date().toLocaleDateString()}.
You are assisting: ${user?.name || 'the user'}.
They work for the agency: ${agency?.name || 'not specified'}.

You have access to a set of powerful tools to perform tasks. When a user's request matches a tool's capability, you MUST use the tool. You should inform the user that you are using a tool to complete their request.

Analyze the user's prompt carefully. If it's a command or a question that can be answered with your tools, use them. Here are some examples:
- If the user says "write an email to John Doe to follow up on our last viewing", use the 'getEmailDraft' tool. For the 'agentName', use the name of the user you are assisting.
- If the user says "give me a description for the apartment in Herastrau", first use the 'getPropertyDetails' tool to find the property's data, and then use the 'getPropertyDescription' tool with that data.
- If the user asks "who are my newest leads?", use the 'listRecentLeads' tool.

After a tool provides a result (like an email draft or a list), present it clearly to the user. Do not just output the raw JSON. Format it nicely using markdown. For example, for an email, present the Subject and Body clearly.

If the user asks a general question or wants to chat, provide a helpful and concise response without using a tool.`;

    const history: Message[] = [
        {role: 'system', content: [{text: systemPrompt}]},
        ...input.history,
    ];

    const response = await ai.generate({
      prompt: input.prompt,
      history,
      tools: [getEmailDraft, getPropertyDescription, listRecentLeads, getPropertyDetails],
      model: 'googleai/gemini-2.5-flash',
    });
    
    return {
      response: response.text,
    };
  }
);
