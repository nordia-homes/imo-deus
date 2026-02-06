'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { isToday, parseISO, differenceInHours, differenceInDays, format } from 'date-fns';
import type { Contact, Property, Viewing, Briefing } from '@/lib/types';

// Define the inputs for the main flow
interface GenerateBriefingInput {
  contacts: Contact[];
  properties: Property[];
  viewings: Viewing[];
}

// This is the schema for what the AI model will return.
// It's only the creative text parts.
const AiGenSchema = z.object({
  priorities: z.array(z.string()).describe('A short, actionable to-do list for the day.'),
  urgentClientsAnalysis: z.string().describe('A summary analysis of the most urgent clients and why they need attention.'),
  propertiesToReviewAnalysis: z.string().describe('A summary of properties that need review and what should be done.'),
});

// Main function to be called by the frontend.
export async function generateBriefing(input: GenerateBriefingInput): Promise<Briefing> {
  const { contacts, properties, viewings } = input;
  const now = new Date();

  // --- 1. Perform all deterministic calculations in code ---

  // Vizionari programate astazi
  const todayViewings = viewings.filter(v => v.status === 'scheduled' && isToday(parseISO(v.viewingDate)));
  
  // Cumparatori care asteapta oferte (peste 72h, fara oferte in portal)
  const clientsWaitingForOffers = contacts.filter(c => 
    c.createdAt && 
    differenceInHours(now, parseISO(c.createdAt)) > 72 &&
    (c.status === 'Nou' || c.status === 'Contactat') &&
    (!c.recommendationHistory || Object.keys(c.recommendationHistory).length === 0)
  );

  // Proprietati de revizuit (mai putin de 8 poze sau descriere scurta)
  const propertiesToReview = properties.filter(p => 
    p.status === 'Activ' &&
    ((p.images?.length || 0) < 8 || (p.description?.length || 0) < 150)
  );
  
  // Follow up clienti
  const clientsNeedingFollowUp = contacts.filter(c => {
    if (c.status === 'Pierdut' || c.status === 'Câștigat' || c.status === 'Nou') return false;
    
    // Find the most recent interaction
    if (!c.interactionHistory || c.interactionHistory.length === 0) {
        // If they've been contacted but have no interaction history, they need a follow up.
        return c.createdAt ? differenceInDays(now, parseISO(c.createdAt)) > 2 : true;
    }
    const lastInteractionDate = c.interactionHistory.reduce((latest, current) => {
        return new Date(current.date) > new Date(latest.date) ? current : latest;
    }).date;

    return differenceInDays(now, parseISO(lastInteractionDate)) > 3;
  });

  // --- 2. Prepare data for the AI prompt ---
  
  const aiContext = {
    todayViewings: todayViewings.map(v => ({ time: format(parseISO(v.viewingDate), 'HH:mm'), property: v.propertyTitle, contact: v.contactName })),
    waitingForOffers: clientsWaitingForOffers.map(c => ({ name: c.name, budget: c.budget })),
    needsFollowUp: clientsNeedingFollowUp.map(c => ({ name: c.name, status: c.status })),
    needsReview: propertiesToReview.map(p => ({ title: p.title, reason: `${p.images?.length || 0} poze, ${p.description?.length || 0} caractere descriere` })),
  };

  // --- 3. Call the AI to generate only the text analysis ---
  const prompt = ai.definePrompt({
    name: 'generateBriefingAnalysis',
    input: { schema: z.any() },
    output: { schema: AiGenSchema },
    prompt: `Ești Donna, un asistent imobiliar proactiv și eficient. Analizează datele pre-calculate de mai jos și generează un briefing concis și orientat spre acțiune.
    
    Datele de azi:
    - Vizionări programate: ${JSON.stringify(aiContext.todayViewings)}
    - Clienți care așteaptă oferte de peste 3 zile: ${JSON.stringify(aiContext.waitingForOffers)}
    - Clienți care necesită follow-up (fără interacțiune de peste 3 zile): ${JSON.stringify(aiContext.needsFollowUp)}
    - Proprietăți ce necesită optimizare (poze/descriere): ${JSON.stringify(aiContext.needsReview)}
    
    Sarcinile tale:
    1.  Generează o listă scurtă cu 3-4 **priorități de top** pentru azi. Fii direct: "Sună-l pe X", "Trimite oferte pentru Y", "Actualizează proprietatea Z".
    2.  Generează o analiză de 1-2 propoziții pentru **clienții urgenți**, explicând de ce necesită atenție.
    3.  Generează o analiză de 1-2 propoziții pentru **proprietățile de optimizat**, explicând de ce este important.
    
    Fii concis, direct și profesionist. Nu adăuga introduceri sau concluzii. Returnează doar obiectul JSON conform schemei.`,
  });

  let aiOutput;
  try {
    const { output } = await prompt(aiContext);
    if (!output) throw new Error("AI output was null or undefined.");
    aiOutput = output;
  } catch (e) {
    console.error("AI Generation failed in briefing-generator:", e);
    // Provide a fallback if AI fails, so the page doesn't crash
    aiOutput = {
      priorities: ["Verifică manual clienții și proprietățile."],
      urgentClientsAnalysis: "AI-ul nu a putut genera analiza clienților.",
      propertiesToReviewAnalysis: "AI-ul nu a putut genera analiza proprietăților.",
    };
  }

  // --- 4. Construct the final Briefing object for the frontend ---
  const finalBriefing: Briefing = {
    summary: [
      { label: 'Vizionări azi', value: todayViewings.length },
      { label: 'Așteaptă oferte', value: clientsWaitingForOffers.length },
      { label: 'Follow-up necesar', value: clientsNeedingFollowUp.length },
      { label: 'Proprietăți de revizuit', value: propertiesToReview.length },
    ],
    priorities: aiOutput.priorities.map(p => ({ text: p })),
    upcomingViewings: todayViewings.map(v => ({
      id: v.id,
      time: format(parseISO(v.viewingDate), 'HH:mm'),
      title: v.propertyTitle,
      contact: v.contactName,
    })),
    urgentClients: [
        ...clientsWaitingForOffers.slice(0, 2).map(c => ({ id: c.id, name: c.name, reason: `Așteaptă ofertă de peste 72h. Buget: €${c.budget?.toLocaleString()}`, avatar: c.photoUrl })),
        ...clientsNeedingFollowUp.slice(0, 2).map(c => ({ id: c.id, name: c.name, reason: `Fără interacțiune recentă. Status: ${c.status}`, avatar: c.photoUrl }))
    ],
    propertiesToOptimize: propertiesToReview.slice(0, 3).map(p => ({ 
        id: p.id, 
        name: p.title, 
        reason: `${p.images?.length || 0}/8 poze, descriere ${p.description?.length || 0} caractere`,
        image: p.images?.[0]?.url 
    })),
    // Add raw text analysis from AI
    urgentClientsAnalysis: aiOutput.urgentClientsAnalysis,
    propertiesToReviewAnalysis: aiOutput.propertiesToReviewAnalysis,
  };

  return finalBriefing;
}
