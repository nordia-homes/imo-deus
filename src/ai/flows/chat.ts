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
import {z, Message, Part} from 'genkit';
import type { Contact, Property, Agency, UserProfile, Viewing } from '@/lib/types';
import { generateEmail } from './email-generator';
import { generatePropertyDescription } from './property-description-generator';

const ChatInputSchema = z.object({
  history: z.array(z.custom<Message>()).describe('The chat history.'),
  prompt: z.string().describe('The user\'s prompt.'),
  contacts: z.array(z.custom<Contact>()).optional().describe('A list of all contacts in the CRM.'),
  properties: z.array(z.custom<Property>()).optional().describe('A list of all properties in the CRM.'),
  viewings: z.array(z.custom<Viewing>()).optional().describe('A list of all viewings in the CRM.'),
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
    inputSchema: z.custom<Property>(),
    outputSchema: z.object({
      description: z.string(),
    }),
  },
  async (property) => generatePropertyDescription(property)
);


const chatFlow = ai.defineFlow(
  {
    name: 'chatFlow',
    inputSchema: ChatInputSchema,
    outputSchema: ChatOutputSchema,
  },
  async (input) => {
    
    // Define contextual tools here so they have access to flow input
    const listRecentLeads = ai.defineTool(
      {
        name: 'listRecentLeads',
        description: 'Gets a summary of the most recently added leads or contacts from the provided list.',
        inputSchema: z.object({
          count: z.number().optional().default(5).describe("Number of leads to return."),
        }),
        outputSchema: z.array(z.object({ name: z.string(), status: z.string().optional(), budget: z.number().optional() })),
      },
      async ({ count }) => {
        if (!input.contacts) return [];
        return input.contacts
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, count)
          .map(c => ({ name: c.name, status: c.status, budget: c.budget }));
      }
    );

    const getPropertyDetails = ai.defineTool(
        {
            name: 'getPropertyDetails',
            description: 'Retrieves the full data object for a specific property by its title or partial title from the provided list of properties.',
            inputSchema: z.object({
                propertyTitle: z.string().describe("The title or a key part of the title of the property to find."),
            }),
            outputSchema: z.custom<Property>().nullable(),
        },
        async ({ propertyTitle }) => {
            if (!input.properties) return null;
            const prop = input.properties.find(p => p.title && p.title.toLowerCase().includes(propertyTitle.toLowerCase()));
            return prop || null;
        }
    );

    const getContactDetails = ai.defineTool(
        {
            name: 'getContactDetails',
            description: 'Retrieves the full data object for a specific contact (buyer/lead) by their name from the provided list.',
            inputSchema: z.object({
                contactName: z.string().describe("The full name or partial name of the contact to find."),
            }),
            outputSchema: z.custom<Contact>().nullable(),
        },
        async ({ contactName }) => {
            if (!input.contacts) return null;
            const contact = input.contacts.find(c => c.name && c.name.toLowerCase().includes(contactName.toLowerCase()));
            return contact || null;
        }
    );

    const systemPrompt = `Rolul tău

Ești asistentul meu personal în platforma imobiliară. Funcționezi în stilul „Donna” din Suits: inteligent, proactiv, sigur pe tine și orientat spre rezultate.

Nu ești o pagină unde eu cer lucruri.
Ești o pagină unde tu îmi spui ce trebuie să fac pentru a vinde mai mult.

Scopul tău principal:
să mă ghidezi zilnic cu pași concreți care duc la tranzacții.

---
## Context de Date
IMPORTANT: Ca parte a acestei conversații, primești un context de date esențial care include listele complete de \`contacts\`, \`properties\` și \`viewings\`. TREBUIE să folosești aceste date pentru a-ți îndeplini sarcinile. Nu răspunde NICIODATĂ că nu ai acces la date. Data de astăzi este: ${new Date().toLocaleDateString()}.
---

Regula de bază

Nu aștepta comenzile mele.

De fiecare dată când deschid pagina Asistență AI:

Analizează clienții.
Analizează vizionările.
Analizează ofertele.
Analizează proprietățile.
Propune acțiuni concrete.

Ce trebuie să verifici constant
1. Clienți

Clienți fără ofertă trimisă.
Clienți fără răspuns de peste 2–3 zile.
Clienți cu buget mare.
Clienți care au făcut vizionări, dar nu au primit follow-up.

2. Vizionări

Vizionările de azi.
Vizionările de mâine.
Vizionări neconfirmate.
Vizionări fără follow-up.

3. Oferte

Oferte trimise fără răspuns.
Clienți care au primit prea multe opțiuni.
Clienți care nu au primit alternative.

4. Proprietăți

Verifică fiecare proprietate și identifică:

Lipsă fotografii.
Descriere prea scurtă.
Preț nealiniat cu piața.
Fără argumente de vânzare.
Fără plan de apartament.
Fără status actualizat.

Sugerează acțiuni:

Exemplu:

„Apartamentul A12 are doar 3 poze. Adaugă fotografii.”
„Prețul este cu 8% peste media proiectului. Verifică dezvoltatorul.”
„Descrierea este prea scurtă. Îți pregătesc una optimizată.”

Structura răspunsurilor tale

De fiecare dată când intru pe pagină, trebuie să afișezi:

Rezumat zilnic

Exemplu:

2 vizionări azi
4 clienți fără ofertă
3 follow-up-uri de trimis
2 proprietăți care trebuie optimizate

Priorități azi

Listă scurtă cu acțiuni:

Sună clientul Popescu – buget mare, vizionare ieri.
Trimite follow-up către Ionescu.
Confirmă vizionarea de la ora 18:00.
Actualizează descrierea apartamentului A12.

Acțiuni recomandate

Pentru fiecare situație:

Situație:
Descriere scurtă.

Acțiune recomandată:
Ce trebuie făcut.

Buton logic:
[Trimite mesaj WhatsApp]

Tonul asistentului

Scurt.
Sigur pe sine.
Direct.
Orientat spre acțiune.

Exemple:

❌ „Poate ar fi bine să…”
✔ „Trimite follow-up clientului Ionescu.”

❌ „O opțiune ar fi…”
✔ „Acest apartament este perfect pentru el. Trimite oferta.”

Obiectiv final

Să îmi organizezi ziua.
Să nu pierd clienți.
Să primesc mereu următorul pas clar.
Să închid mai multe tranzacții.

---
## Unelte Disponibile
Pe lângă analiza datelor, ai la dispoziție următoarele unelte pentru a executa sarcini:
*   \`getEmailDraft\`: Pentru a genera draft-uri de email-uri.
*   \`getPropertyDescription\`: Pentru a scrie o descriere de marketing pentru o proprietate. Necesită detaliile complete ale proprietății, pe care le poți obține cu \`getPropertyDetails\`.
*   \`listRecentLeads\`: Pentru a vedea o listă cu cele mai noi contacte.
*   \`getPropertyDetails\`: Pentru a căuta **toate detaliile** despre o proprietate.
*   \`getContactDetails\`: Pentru a obține **toate informațiile** despre un anumit cumpărător.

Folosește aceste unelte atunci când o cerere specifică se potrivește.`;

    const systemMessageContent: Part[] = [{ text: systemPrompt }];
    if (input.contacts) systemMessageContent.push({ data: { contacts: input.contacts } });
    if (input.properties) systemMessageContent.push({ data: { properties: input.properties } });
    if (input.viewings) systemMessageContent.push({ data: { viewings: input.viewings } });
    if (input.agency) systemMessageContent.push({ data: { agency: input.agency } });
    if (input.user) systemMessageContent.push({ data: { user: input.user } });


    const history: Message[] = [
        {
            role: 'system',
            content: systemMessageContent
        },
        ...input.history,
    ];

    const response = await ai.generate({
      prompt: input.prompt,
      history,
      tools: [getEmailDraft, getPropertyDescription, listRecentLeads, getPropertyDetails, getContactDetails],
      model: 'googleai/gemini-2.5-flash',
    });
    
    return {
      response: response.text,
    };
  }
);
