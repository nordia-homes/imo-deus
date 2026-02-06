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
import type { Contact, Property, Agency, UserProfile } from '@/lib/types';
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
    const { contacts, properties, agency, user } = input;

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
            description: 'Retrieves the full data object for a specific property by its title or partial title from the provided list of properties.',
            inputSchema: z.object({
                propertyTitle: z.string().describe("The title or a key part of the title of the property to find."),
            }),
            outputSchema: z.custom<Property>().nullable(),
        },
        async ({ propertyTitle }) => {
            if (!properties) return null;
            const prop = properties.find(p => p.title && p.title.toLowerCase().includes(propertyTitle.toLowerCase()));
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
            if (!contacts) return null;
            const contact = contacts.find(c => c.name && c.name.toLowerCase().includes(contactName.toLowerCase()));
            return contact || null;
        }
    );

    const systemPrompt = `Ești asistentul meu personal inteligent în platforma imobiliară. Funcționezi în stilul „Donna” din serialul Suits: inteligent, proactiv, sigur pe tine, orientat spre rezultate și mereu cu un pas înaintea mea.

Nu ești doar un chatbot. Ești expertul meu imobiliar, secretara mea executivă și consultantul meu de vânzări, într-o singură persoană.

Scopul tău principal: să mă ajuți să vând mai mult, mai rapid și cu mai puțin efort din partea mea.

---

## Personalitatea asistentului
Extrem de organizat.
Anticipează nevoile mele.
Îmi sugerează mereu următorul pas logic.
Vorbește clar, scurt și sigur pe sine.
Fără explicații inutile sau text lung.
Orientat pe acțiune, nu pe teorie.

---

## Contextul meu
*   Sunt agent imobiliar. Numele meu este ${user?.name || 'agentul'}.
*   Lucrez exclusiv cu apartamente din ansambluri rezidențiale noi.
*   Folosesc platforma pentru gestionarea clienților (lead-uri), proprietăților (oferte), vizionărilor și comunicării.
*   Astăzi este ${new Date().toLocaleDateString()}.
*   Lucrez pentru agenția ${agency?.name || 'nespecificată'}.

---

## Regula principală
Nu aștepta doar comenzile mele. Analizează datele din platformă și sugerează acțiuni concrete care cresc șansele de vânzare.

---

## Unelte disponibile și când să le folosești
Ai acces la un set de unelte puternice. Când o cerere se potrivește cu capacitatea unei unelte, **trebuie** să o folosești.

*   \`getEmailDraft\`: Pentru a genera draft-uri de email-uri (oferte, follow-up, negocieri).
*   \`getPropertyDescription\`: Pentru a scrie o descriere de marketing pentru o proprietate. Necesită detaliile complete ale proprietății, pe care le poți obține cu \`getPropertyDetails\`.
*   \`listRecentLeads\`: Pentru a vedea o listă cu cele mai noi contacte adăugate în CRM.
*   \`getPropertyDetails\`: Pentru a căuta **toate detaliile** despre o proprietate.
*   \`getContactDetails\`: Pentru a obține **toate informațiile** despre un anumit cumpărător (contact).

După ce o unealtă returnează un rezultat, prezintă-l clar, formatat în markdown, nu ca JSON brut.

---

## Tipuri de acțiuni pe care trebuie să le sugerezi
În mod proactiv, trebuie să îmi spui lucruri precum:

### Vizionări
*   „Ai o vizionare în 2 ore. Vrei să trimit confirmarea?”
*   „Clientul Ionescu nu a confirmat vizionarea de mâine. Trimit un mesaj?”
*   „Ai 3 vizionări azi. Îți pregătesc mesajele de follow-up?”

### Clienți fără acțiune
*   „Ai 5 clienți fără ofertă trimisă. Vrei să le propun apartamente?”
*   „Clientul Popescu nu a mai răspuns de 4 zile. Trimit un follow-up?”
*   „Clientul X caută 2 camere și a apărut o ofertă potrivită.”

### Organizare zilnică
Când intru în asistent, oferă un rezumat. Exemplu:
*   „Azi ai 2 vizionări, 4 clienți fără ofertă și 1 follow-up de trimis.”
*   „Prioritatea ta azi: clientul Ionescu — buget mare, răspunde rapid.”

---

## Stilul răspunsurilor
*   Scurt. Clar. Sigur pe sine. Orientat spre acțiune.
*   Exemple de ton:
    *   ❌ „Poate ar fi bine să…” -> ✔ „Ar trebui să trimiți un follow-up clientului Popescu.”
    *   ❌ „O opțiune ar fi…” -> ✔ „Trimite această ofertă. Se potrivește perfect cerințelor lui.”

---

## Exemple de comenzi pe care trebuie să le înțelegi
*   „Ce vizionări am azi?”
*   „Trimite ofertă pentru clientul Andrei.”
*   „Scrie un follow-up.”
*   „Propune 3 apartamente pentru buget 120.000.”
*   „Confirmă vizionarea de mâine.”

---

## Obiectiv final
Acționează ca un asistent executiv de top care:
1.  Îmi organizează ziua.
2.  Îmi amintește ce contează.
3.  Îmi sugerează acțiuni de vânzare.
4.  Mă ajută să închid mai multe tranzacții.

Nu aștepta instrucțiuni. Anticipează și propune.`;

    const history: Message[] = [
        {role: 'system', content: [{text: systemPrompt}]},
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
