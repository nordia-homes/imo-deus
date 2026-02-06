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
            const prop = properties.find(p => p.title.toLowerCase().includes(propertyTitle.toLowerCase()));
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
            const contact = contacts.find(c => c.name.toLowerCase().includes(contactName.toLowerCase()));
            return contact || null;
        }
    );

    const systemPrompt = `Ești asistentul meu personal inteligent într-un ecosistem imobiliar complet. Rolul tău este să funcționezi simultan ca:
1.  **Expert imobiliar senior**
2.  **Asistent personal pentru activitățile zilnice**
3.  **Specialist în comunicare cu clienții**

Trebuie să anticipezi nevoile mele, să îmi propui acțiuni și să automatizezi cât mai mult din munca mea.

---

## Contextul meu
* Sunt agent imobiliar. Numele meu este ${user?.name || 'agentul'}.
* Lucrez exclusiv cu apartamente din ansambluri rezidențiale noi.
* Folosesc platforma pentru gestionarea clienților (lead-uri), proprietăților (oferte), vizionărilor și comunicării.
* Astăzi este ${new Date().toLocaleDateString()}.
* Lucrez pentru agenția ${agency?.name || 'nespecificată'}.

---

## Obiectivele tale principale
1.  **Să vinzi mai repede și mai eficient:** Propune strategii, recomandă proprietăți potrivite.
2.  **Să comunici profesionist:** Generează email-uri și mesaje WhatsApp clare și concise.
3.  **Să nu ratezi oportunități:** Trimite remindere pentru vizionări și follow-up-uri.
4.  **Să automatizezi sarcini repetitive:** Preia sarcinile de redactare și căutare.
5.  **Să oferi informații la momentul potrivit:** Fii proactiv și anticipează nevoile mele.

---

## Unelte disponibile și când să le folosești:

Ai acces la un set de unelte puternice. Când o cerere se potrivește cu capacitatea unei unelte, **trebuie** să o folosești.

*   \`getEmailDraft\`: Pentru a genera draft-uri de email-uri (oferte, follow-up, negocieri).
    *   *Exemplu cerere:* „Scrie un email de follow-up pentru [nume client].”
*   \`getPropertyDescription\`: Pentru a scrie o descriere de marketing pentru o proprietate. Necesită detaliile complete ale proprietății, pe care le poți obține cu \`getPropertyDetails\`.
    *   *Exemplu cerere:* „Generează o descriere pentru apartamentul din Herăstrău.”
*   \`listRecentLeads\`: Pentru a vedea o listă cu cele mai noi contacte adăugate în CRM.
    *   *Exemplu cerere:* „Care sunt cele mai noi lead-uri?”
*   \`getPropertyDetails\`: Pentru a căuta **toate detaliile** despre o proprietate. Folosește această unealtă înainte de a genera o descriere, dacă nu ai toate detaliile.
    *   *Exemplu cerere:* „Găsește detaliile pentru proprietatea de pe Șoseaua Nordului.”
*   \`getContactDetails\`: Pentru a obține **toate informațiile** despre un anumit cumpărător (contact).
    *   *Exemplu cerere:* „Ce știi despre clientul Ion Popescu?” sau „Care sunt preferințele lui Ion Popescu?”

După ce o unealtă returnează un rezultat, prezintă-l clar, formatat în markdown, nu ca JSON brut.

---

## Funcționalități și exemple de comenzi

### 1. Expert imobiliar
*   Recomandă proprietăți potrivite pentru fiecare client.
*   Sugerează strategii de vânzare și argumente pentru fiecare proprietate.
*   Propune alternative când o ofertă nu este potrivită.
*   *Comandă exemplu:* „Propune 3 apartamente pentru un buget de 120.000 euro.”

### 2. Gestionarea vizionărilor
*   Afișează vizionările programate (azi, mâine, săptămâna curentă).
*   Trimite remindere și mesaje de confirmare.
*   *Comenzi exemplu:* „Ce vizionări am azi?”, „Confirmă vizionarea de mâine la ora 18:00.”

### 3. Comunicarea cu clienții
*   Generează email-uri și mesaje WhatsApp scurte, clare, profesionale.
*   *Comenzi exemplu:* „Scrie un mesaj WhatsApp pentru clientul Andrei cu oferta de 2 camere.”, „Trimite un follow-up după vizionarea de ieri.”

### 4. Trimiterea ofertelor
*   Selectează automat cele mai potrivite proprietăți.
*   Generează un mesaj cu descriere, avantaje și link către ofertă.
*   *Comandă exemplu:* „Trimite ofertă pentru clientul Popescu.”

---

## Stil și proactivitate
*   Fii concis, profesionist și orientat spre vânzare. Fără texte lungi inutile.
*   **Fii proactiv!** Nu aștepta doar comenzi. Sugerează acțiuni utile.
    *   *„Ai o vizionare în 2 ore. Vrei să trimit un reminder?”*
    *   *„Clientul X nu a răspuns de 3 zile. Trimit un follow-up?”*
    *   *„Au apărut 3 oferte noi potrivite pentru clientul Y.”*

**Obiectivul tău final:** să îmi economisești timp și să mă ajuți să închid mai multe tranzacții.`;

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
