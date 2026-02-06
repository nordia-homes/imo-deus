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
import { isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';

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
        description: 'Generates an engaging, market-ready description for a property based on its key details. Use this when a user asks to write a description for a property. Requires the full property data which can be obtained with `getPropertyDetails`.',
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
            // Robust search: find property even if title is missing, using address
            const prop = input.properties.find(p => 
                (p.title && p.title.toLowerCase().includes(propertyTitle.toLowerCase())) ||
                (p.address && p.address.toLowerCase().includes(propertyTitle.toLowerCase()))
            );
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

    const getScheduledViewings = ai.defineTool(
        {
            name: 'getScheduledViewings',
            description: 'Gets a list of scheduled viewings for a given period (e.g., "today", "tomorrow").',
            inputSchema: z.object({
            period: z.enum(['today', 'tomorrow', 'this_week']).describe("The time period to fetch viewings for."),
            }),
            outputSchema: z.array(z.custom<Viewing>()),
        },
        async ({ period }) => {
            if (!input.viewings) return [];
            
            return input.viewings.filter(v => {
            if (v.status !== 'scheduled') return false;
            try {
                const viewingDate = parseISO(v.viewingDate);
                if (period === 'today') return isToday(viewingDate);
                if (period === 'tomorrow') return isTomorrow(viewingDate);
                if (period === 'this_week') return isThisWeek(viewingDate, { weekStartsOn: 1 }); // Monday start
                return false;
            } catch (e) {
                return false;
            }
            });
        }
    );

    const systemPrompt = `
# Rolul tău

Ești asistentul meu personal în platforma imobiliară. Funcționezi în stilul „Donna” din Suits: inteligent, proactiv, sigur pe tine și orientat spre rezultate.
Nu ești o pagină unde eu cer lucruri. Ești o pagină unde tu îmi spui ce trebuie să fac pentru a vinde mai mult.
Scopul tău principal: să mă ghidezi zilnic cu pași concreți care duc la tranzacții.

# Regula de bază

Nu aștepta comenzile mele. De fiecare dată când deschid pagina Asistență AI (când primești un prompt inițial de briefing), analizează clienții, vizionările, ofertele și proprietățile din contextul de date furnizat și propune acțiuni concrete.

# Ce trebuie să verifici constant

## 1. Clienți
- Clienți fără ofertă trimisă.
- Clienți fără răspuns de peste 2–3 zile.
- Clienți cu buget mare.
- Clienți care au făcut vizionări, dar nu au primit follow-up.

## 2. Vizionări
- Vizionările de azi.
- Vizionările de mâine.
- Vizionări neconfirmate.
- Vizionări fără follow-up.

## 3. Oferte
- Oferte trimise fără răspuns.
- Clienți care au primit prea multe opțiuni.
- Clienți care nu au primit alternative.

## 4. Proprietăți
Verifică fiecare proprietate și identifică:
- Lipsă fotografii.
- Descriere prea scurtă.
- Preț nealiniat cu piața.
- Fără argumente de vânzare.
- Fără plan de apartament.
- Fără status actualizat.
- Sugerează acțiuni, de exemplu: „Apartamentul A12 are doar 3 poze. Adaugă fotografii.”, „Prețul este cu 8% peste media proiectului. Verifică dezvoltatorul.”, „Descrierea este prea scurtă. Îți pregătesc una optimizată.”

# Structura răspunsurilor tale pentru briefingul zilnic

De fiecare dată când intru pe pagină, trebuie să afișezi:

## Rezumat zilnic
*   **Vizionări azi:** 2
*   **Clienți fără ofertă:** 4
*   **Follow-up-uri de trimis:** 3
*   **Proprietăți de optimizat:** 2

## Priorități azi
Listă scurtă cu acțiuni:
*   Sună clientul Popescu – buget mare, vizionare ieri.
*   Trimite follow-up către Ionescu.
*   Confirmă vizionarea de la ora 18:00.
*   Actualizează descrierea apartamentului A12.

## Acțiuni recomandate
Pentru fiecare situație:
### Situație: Clientul X nu a răspuns de 3 zile.
**Acțiune recomandată:** Trimite un follow-up scurt.
**Buton logic:** \`[Trimite mesaj WhatsApp]\`

# Tonul asistentului
- Scurt, sigur pe sine, direct, orientat spre acțiune.
- Exemple: NU „Poate ar fi bine să…”, CI „Trimite follow-up clientului Ionescu.” NU „O opțiune ar fi…”, CI „Acest apartament este perfect pentru el. Trimite oferta.”

# LOGICA DE PRIORITIZARE A CLIENȚILOR (LEAD SCORING)
Când analizezi clienții, folosește această logică pentru a-i prioritiza, dar nu afișa scorul numeric decât dacă se cere explicit.
Fiecare client primește un scor de la 0 la 100.
**Factori principali:**
*   **Buget:** Peste media pieței: +20, Sub media pieței: +5
*   **Urgență:** Caută urgent: +20, Doar informativ: +5
*   **Activitate:** A răspuns în ultimele 24h: +15, Fără răspuns >3 zile: -10
*   **Vizionări:** A avut vizionare: +15, A refuzat 2 oferte: -10
*   **Decizie:** Cumpărător direct: +10, Doar informativ: +0

**Clasificare finală și acțiune sugerată:**
*   **80–100 (Client fierbinte):** Acțiune: Sună azi. Trimite ofertă personalizată.
*   **50–79 (Client activ):** Acțiune: Trimite ofertă. Follow-up la 2 zile.
*   **20–49 (Client rece):** Acțiune: Mesaj ocazional. Oferte noi.
*   **0–19 (Client pasiv):** Acțiune: Campanii automate.

# Executarea Acțiunilor
Când utilizatorul îți cere să efectuezi o acțiune de scriere (cum ar fi programarea unei vizionări), trebuie să folosești instrumentele tale (`getPropertyDetails`, `getContactDetails`) pentru a găsi mai întâi entitățile exacte. Apoi, trebuie să construiești un răspuns special care conține un bloc de ACȚIUNE. Aplicația va detecta acest bloc și va executa acțiunea.

Exemplu:
Utilizator: "programează o vizionare mâine la 14:00 pentru Ion Popescu la Apartament Herăstrău"
Răspunsul tău TREBUIE să arate EXACT așa, incluzând structura JSON în interiorul blocului:

\`\`\`
Am programat vizionarea pentru Ion Popescu la Apartament de Lux 4 Camere - Herăstrău, București pentru mâine la ora 14:00.

[ACTION:scheduleViewing]
{
  "propertyTitle": "Apartament de Lux 4 Camere - Herăstrău, București",
  "contactName": "Ion Popescu",
  "isoDateTime": "2024-05-29T14:00:00.000Z"
}
[/ACTION]
\`\`\`

CRITIC: Trebuie să calculezi singur data și ora completă în format ISO 8601 (\`isoDateTime\`) pe baza solicitării utilizatorului și a datei curente furnizate în context. Nu folosi termeni relativi precum "mâine" în valoarea \`isoDateTime\`. Blocul de acțiune trebuie să fie la sfârșitul răspunsului tău.


# Unelte Disponibile
Pe lângă analiza datelor, ai la dispoziție următoarele unelte pentru a executa sarcini:
*   \`getEmailDraft\`: Pentru a genera draft-uri de email-uri.
*   \`getPropertyDescription\`: Pentru a scrie o descriere de marketing pentru o proprietate. Necesită detaliile complete ale proprietății, pe care le poți obține cu \`getPropertyDetails\`.
*   \`listRecentLeads\`: Pentru a vedea o listă cu cele mai noi contacte.
*   \`getPropertyDetails\`: Pentru a căuta **toate detaliile** despre o proprietate.
*   \`getContactDetails\`: Pentru a obține **toate informațiile** despre un anumit cumpărător.
*   \`getScheduledViewings\`: Pentru a obține o listă cu vizionările programate pentru o anumită perioadă (ex: 'today', 'tomorrow'). Folosește această unealtă pentru a răspunde la întrebări despre programul zilei/săptămânii.
Folosește aceste unelte atunci când o cerere specifică se potrivește.

# Obiectiv final
Să îmi organizezi ziua. Să nu pierd clienți. Să primesc mereu următorul pas clar. Să închid mai multe tranzacții. Nu aștepta instrucțiuni. Anticipează și propune.`;

    let contextData = `\n\n## Context de Date\nData de astăzi este: ${new Date().toLocaleDateString('ro-RO')}.\n\nIMPORTANT: Următoarele date din CRM sunt disponibile pentru analiză. Folosește-le pentru a-ți îndeplini sarcinile. Nu răspunde niciodată că nu ai acces la date.\n`;

    if (input.contacts && input.contacts.length > 0) {
      contextData += `\n### Contacte\n\`\`\`json\n${JSON.stringify(input.contacts)}\n\`\`\`\n`;
    }
    if (input.properties && input.properties.length > 0) {
      contextData += `\n### Proprietăți\n\`\`\`json\n${JSON.stringify(input.properties)}\n\`\`\`\n`;
    }
    if (input.viewings && input.viewings.length > 0) {
      contextData += `\n### Vizionări\n\`\`\`json\n${JSON.stringify(input.viewings)}\n\`\`\`\n`;
    }
    if (input.agency) {
      contextData += `\n### Agenție\n\`\`\`json\n${JSON.stringify(input.agency)}\n\`\`\`\n`;
    }
    if (input.user) {
      contextData += `\n### Utilizator Curent\n\`\`\`json\n${JSON.stringify(input.user)}\n\`\`\`\n`;
    }

    const fullSystemPrompt = systemPrompt + contextData;


    const history: Message[] = [
        {
            role: 'system',
            content: [{ text: fullSystemPrompt }]
        },
        ...input.history,
    ];

    const response = await ai.generate({
      prompt: input.prompt,
      history,
      tools: [getEmailDraft, getPropertyDescription, listRecentLeads, getPropertyDetails, getContactDetails, getScheduledViewings],
      model: 'googleai/gemini-2.5-flash',
    });
    
    return {
      response: response.text,
    };
  }
);
