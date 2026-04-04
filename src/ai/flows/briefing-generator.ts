'use server';

import { z } from 'zod';
import { differenceInDays, differenceInHours, format, isToday, isTomorrow, parseISO } from 'date-fns';
import type { Briefing, Contact, Property, Viewing } from '@/lib/types';
import { isArchivedContact } from '@/lib/contact-aging';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';

interface GenerateBriefingInput {
  contacts: Contact[];
  properties: Property[];
  viewings: Viewing[];
}

const BriefingAiOutputSchema = z.object({
  executiveSummary: z.string(),
  dailyFocus: z.string(),
  priorities: z.array(z.string()).min(3).max(5),
  urgentClientsAnalysis: z.string(),
  propertiesToReviewAnalysis: z.string(),
  opportunities: z.array(z.string()).min(2).max(4),
  suggestedPrompts: z.array(z.string()).min(3).max(5),
  whatsAppDrafts: z.array(
    z.object({
      contactName: z.string(),
      reason: z.string(),
      message: z.string(),
    })
  ).max(4),
  nextStepPlans: z.array(
    z.object({
      contactName: z.string(),
      step: z.string(),
      reason: z.string(),
      expectedOutcome: z.string(),
    })
  ).max(4),
});

type BriefingAiOutput = z.infer<typeof BriefingAiOutputSchema>;

function getTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

function hoursSince(value?: string | null) {
  const time = getTime(value);
  if (time === null) return null;
  return Math.floor((Date.now() - time) / (1000 * 60 * 60));
}

function getLatestInteractionTime(contact: Contact) {
  const interactionTimes = (contact.interactionHistory || [])
    .map((entry) => getTime(entry.date))
    .filter((value): value is number => value !== null);

  const offerTimes = (contact.offers || [])
    .map((offer) => getTime(offer.date))
    .filter((value): value is number => value !== null);

  const latestInteraction = Math.max(0, ...interactionTimes, ...offerTimes);
  return latestInteraction || getTime(contact.createdAt);
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const content = payload?.output?.[0]?.content;
  if (Array.isArray(content)) {
    const textItem = content.find((item: any) => typeof item?.text === 'string');
    if (textItem?.text) return textItem.text;
  }

  return '';
}

function dedupeById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildFallback(input: {
  activeContacts: Contact[];
  archivedContacts: Contact[];
  propertiesToReview: Property[];
  urgentClients: Briefing['urgentClients'];
  todayViewings: Viewing[];
  tomorrowViewings: Viewing[];
  stalledNegotiations: Contact[];
  followUpContacts: Contact[];
  draftCandidates: Contact[];
}): BriefingAiOutput {
  const {
    activeContacts,
    archivedContacts,
    propertiesToReview,
    urgentClients,
    todayViewings,
    tomorrowViewings,
    stalledNegotiations,
    followUpContacts,
    draftCandidates,
  } = input;

  const topUrgent = urgentClients[0];
  const messagingTargets = (draftCandidates.length > 0 ? draftCandidates : activeContacts.filter((contact) => contact.status !== 'Pierdut' && contact.status !== 'Câștigat')).slice(0, 4);

  const whatsappDrafts = messagingTargets.slice(0, 3).map((contact) => {
    const messageBase =
      contact.status === 'În negociere'
        ? `Bună, ${contact.name}. Revin ca să închidem clar pasul următor pe proprietatea discutată. Dacă e în regulă pentru tine, stabilim astăzi un apel scurt și vedem exact unde mai trebuie ajustat ca să putem avansa.`
        : contact.status === 'Vizionare'
          ? `Bună, ${contact.name}. Revin după interesul arătat ca să fixăm următorul pas concret. Dacă ești disponibil, putem stabili acum o discuție scurtă sau o vizionare, astfel încât să nu pierdem ritmul bun al conversației.`
          : `Bună, ${contact.name}. Revin cu un pas clar ca să putem avansa eficient. Dacă rămâne interesul activ, hai să stabilim azi o discuție scurtă și să vedem imediat ce proprietăți sau variante merită puse pe masă.`;

    return {
      contactName: contact.name,
      reason:
        contact.status === 'În negociere'
          ? 'Este în negociere și cere un mesaj care închide pasul următor.'
          : contact.status === 'Vizionare'
            ? 'A ajuns la etapa de vizionare și merită împins spre acțiune concretă.'
            : 'Lead activ care are nevoie de un follow-up clar, nu doar de prezență în CRM.',
      message: messageBase,
    };
  });

  const nextStepPlans = messagingTargets.slice(0, 4).map((contact) => ({
    contactName: contact.name,
    step:
      contact.status === 'În negociere'
        ? 'Sună-l astăzi și ieși din conversație cu o decizie clară: acceptare, contraofertă sau motiv concret de blocaj.'
        : contact.status === 'Vizionare'
          ? 'În maximum 24h, fixează feedback-ul după vizionare și mută discuția spre ofertă sau a doua proprietate relevantă.'
          : 'Transformă următorul contact într-un apel sau o vizionare programată, nu într-un simplu mesaj de verificare.',
    reason:
      contact.status === 'În negociere'
        ? 'Aici există cel mai mult potențial de închidere rapidă.'
        : contact.status === 'Vizionare'
          ? 'După vizionare, viteza de follow-up face diferența dintre interes și răcire.'
          : 'Lead-urile active fără pas următor clar consumă timp fără să miște pipeline-ul.',
    expectedOutcome:
      contact.status === 'În negociere'
        ? 'Clarifici dacă tranzacția merge mai departe sau dacă trebuie repoziționată imediat.'
        : contact.status === 'Vizionare'
          ? 'Scoți un răspuns ferm și nu lași interesul să se răcească.'
          : 'Muti lead-ul într-o etapă reală din pipeline, nu îl lași în urmă doar ca activitate.',
  }));

  return {
    executiveSummary: `Ai ${activeContacts.length} lead-uri active și ${archivedContacts.length} arhivate. Focusul zilei este pe lead-urile care cer reacție rapidă, pe vizionările programate și pe proprietățile active care frânează conversia prin prezentare slabă.`,
    dailyFocus:
      followUpContacts.length > 0
        ? `Astăzi mută lead-urile rămase fără follow-up spre un pas concret: apel, ofertă sau vizionare confirmată.`
        : `Astăzi concentrează-te pe confirmarea vizionărilor și pe accelerarea lead-urilor care sunt aproape de negociere.`,
    priorities: [
      topUrgent
        ? `Sună-l pe ${topUrgent.name} și închide următorul pas clar.`
        : 'Curăță pipeline-ul activ și scoate din el lead-urile fără pas următor clar.',
      todayViewings.length > 0
        ? `Confirmă toate vizionările de azi și pregătește follow-up-ul pentru fiecare.`
        : 'Programează vizionări noi pentru lead-urile care au trecut deja de etapa de contact.',
      propertiesToReview.length > 0
        ? `Corectează proprietățile active cu poze puține sau descrieri slabe.`
        : 'Verifică portofoliul activ și caută proprietățile care pot fi repoziționate mai bine.',
      stalledNegotiations.length > 0
        ? `Deblochează negocierile care au stat prea mult fără mișcare.`
        : 'Împinge lead-urile bune spre ofertă sau vizionare, nu le lăsa în status intermediar.',
    ],
    urgentClientsAnalysis:
      urgentClients.length > 0
        ? `Clienții urgenți nu sunt cei mai zgomotoși, ci cei care sunt aproape de o decizie și pot ieși din piață dacă nu primesc reacție rapidă. Aici trebuie câștigat timp, nu doar trimise mesaje.`
        : `Nu ai un grup mare de urgențe, ceea ce îți dă spațiu să lucrezi mai disciplinat pe conversie și follow-up.`,
    propertiesToReviewAnalysis:
      propertiesToReview.length > 0
        ? `Proprietățile active cu media slabă sau descrieri subțiri taie din șansa de a muta interesul în vizionare. Aici ai oportunitate directă de conversie, nu doar o problemă de prezentare.`
        : `Portofoliul nu arată semnale majore de prezentare slabă, deci poți pune accent mai mare pe execuția comercială decât pe cosmetizare.`,
    opportunities: [
      followUpContacts.length > 0
        ? 'Cea mai clară oportunitate este să transformi follow-up-ul restant în apeluri și vizionări confirmate, nu doar în mesaje trimise.'
        : 'Cea mai bună oportunitate este să reduci timpul dintre contact și vizionare.',
      todayViewings.length + tomorrowViewings.length > 0
        ? 'Vizionările deja programate sunt cea mai bună materie primă pentru tranzacții, dacă fiecare primește follow-up și următor pas clar.'
        : 'Fereastra cea mai bună de creștere este creșterea numărului de vizionări programate din lead-urile deja calificate.',
      stalledNegotiations.length > 0
        ? 'Negocierile stagnante ascund potențial de închidere mai rapidă decât orice lead nou intrat în CRM.'
        : 'Lead-urile care au trecut de etapa de interes inițial pot fi împinse mai repede spre ofertă.',
    ],
    suggestedPrompts: [
      'Spune-mi pe cine trebuie să sun azi primul.',
      'Scrie-mi un mesaj WhatsApp pentru lead-ul cel mai important de azi.',
      'Spune-mi următorul pas clar pentru lead-urile calde.',
      'Pregătește-mi un plan de follow-up pentru lead-urile întârziate.',
      'Arată-mi ce proprietăți trebuie optimizate prima dată.',
    ],
    whatsAppDrafts: whatsappDrafts,
    nextStepPlans,
  };
}

export async function generateBriefing(input: GenerateBriefingInput): Promise<Briefing> {
  const { contacts, properties, viewings } = input;
  const now = new Date();
  const activeContacts = contacts.filter((contact) => !isArchivedContact(contact));
  const archivedContacts = contacts.filter((contact) => isArchivedContact(contact));

  const todayViewings = viewings
    .filter((viewing) => viewing.status === 'scheduled' && isToday(parseISO(viewing.viewingDate)))
    .sort((left, right) => left.viewingDate.localeCompare(right.viewingDate));

  const tomorrowViewings = viewings
    .filter((viewing) => viewing.status === 'scheduled' && isTomorrow(parseISO(viewing.viewingDate)))
    .sort((left, right) => left.viewingDate.localeCompare(right.viewingDate));

  const clientsWaitingForOffers = activeContacts.filter((contact) => {
    const createdAt = contact.createdAt ? parseISO(contact.createdAt) : null;
    return Boolean(
      createdAt &&
      differenceInHours(now, createdAt) > 72 &&
      (contact.status === 'Nou' || contact.status === 'Contactat') &&
      (!contact.offers || contact.offers.length === 0) &&
      (!contact.recommendationHistory || Object.keys(contact.recommendationHistory).length === 0)
    );
  });

  const propertiesToReview = properties.filter((property) =>
    property.status === 'Activ' &&
    ((property.images?.length || 0) < 8 || (property.description?.trim().length || 0) < 150)
  );

  const followUpContacts = activeContacts.filter((contact) => {
    if (contact.status === 'Nou' || contact.status === 'Pierdut' || contact.status === 'Câștigat') return false;
    const latestTime = getLatestInteractionTime(contact);
    return latestTime !== null && differenceInDays(now, new Date(latestTime)) > 3;
  });

  const viewedButCold = activeContacts.filter((contact) => {
    if (contact.status === 'Pierdut' || contact.status === 'Câștigat') return false;
    const hadViewing = viewings.some((viewing) => viewing.contactId === contact.id && viewing.status === 'completed');
    if (!hadViewing) return false;
    const latestTime = getLatestInteractionTime(contact);
    return latestTime !== null && differenceInDays(now, new Date(latestTime)) > 2;
  });

  const stalledNegotiations = activeContacts.filter((contact) => {
    if (contact.status !== 'În negociere') return false;
    const latestTime = getLatestInteractionTime(contact);
    return latestTime !== null && differenceInDays(now, new Date(latestTime)) > 4;
  });

  const urgentClients = [
    ...clientsWaitingForOffers.map((contact) => ({
      id: contact.id,
      name: contact.name,
      reason: `Așteaptă ofertă de peste 72h. Buget: €${(contact.budget || 0).toLocaleString('ro-RO')}`,
      avatar: contact.photoUrl || null,
    })),
    ...viewedButCold.map((contact) => ({
      id: contact.id,
      name: contact.name,
      reason: 'A avut vizionare, dar nu are follow-up recent.',
      avatar: contact.photoUrl || null,
    })),
    ...stalledNegotiations.map((contact) => ({
      id: contact.id,
      name: contact.name,
      reason: 'Este în negociere, dar fără mișcare recentă.',
      avatar: contact.photoUrl || null,
    })),
  ].slice(0, 6);

  const draftCandidates = dedupeById([
    ...stalledNegotiations,
    ...viewedButCold,
    ...followUpContacts,
    ...clientsWaitingForOffers,
  ]).slice(0, 6);

  const fallback = buildFallback({
    activeContacts,
    archivedContacts,
    propertiesToReview,
    urgentClients,
    todayViewings,
    tomorrowViewings,
    stalledNegotiations,
    followUpContacts,
    draftCandidates,
  });

  let aiOutput = fallback;
  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const contextPayload = {
        activeContacts: activeContacts.slice(0, 80).map((contact) => ({
          name: contact.name,
          status: contact.status,
          budget: contact.budget || 0,
          priority: contact.priority || null,
          createdAt: contact.createdAt || null,
          offers: contact.offers?.length || 0,
          interactionCount: contact.interactionHistory?.length || 0,
        })),
        archivedLeadCount: archivedContacts.length,
        todayViewings: todayViewings.map((viewing) => ({
          time: format(parseISO(viewing.viewingDate), 'HH:mm'),
          propertyTitle: viewing.propertyTitle,
          contactName: viewing.contactName,
        })),
        tomorrowViewings: tomorrowViewings.map((viewing) => ({
          time: format(parseISO(viewing.viewingDate), 'HH:mm'),
          propertyTitle: viewing.propertyTitle,
          contactName: viewing.contactName,
        })),
        urgentClients,
        followUpContacts: followUpContacts.slice(0, 12).map((contact) => ({
          name: contact.name,
          status: contact.status,
          budget: contact.budget || 0,
        })),
        propertiesToReview: propertiesToReview.slice(0, 12).map((property) => ({
          title: property.title,
          images: property.images?.length || 0,
          descriptionLength: property.description?.trim().length || 0,
          price: property.price,
        })),
        stalledNegotiations: stalledNegotiations.slice(0, 10).map((contact) => ({
          name: contact.name,
          budget: contact.budget || 0,
        })),
        draftCandidates: draftCandidates.map((contact) => ({
          name: contact.name,
          status: contact.status,
          budget: contact.budget || 0,
          priority: contact.priority || null,
          lastInteractionHoursAgo: hoursSince(
            (() => {
              const latest = getLatestInteractionTime(contact);
              return latest ? new Date(latest).toISOString() : contact.createdAt || null;
            })()
          ),
          hadViewing: viewings.some((viewing) => viewing.contactId === contact.id && viewing.status === 'completed'),
          offerCount: contact.offers?.length || 0,
        })),
      };

      const prompt = [
        'You are a senior Romanian real-estate agency chief of staff and sales coach.',
        'Write in Romanian.',
        'Be concise, managerial, and action-oriented.',
        'Sound like a senior real-estate operator, not like a generic AI assistant.',
        'Do not mention lead sources as opportunities.',
        'Focus opportunities on commercial leverage: faster follow-up, viewings, negotiations, portfolio positioning, cleaner next-step discipline.',
        'For WhatsApp drafts, write short natural Romanian messages that a strong agent would actually send today.',
        'Do not sound robotic, do not mention AI, do not use placeholders, and do not write more than 3 sentences per message.',
        'For next-step plans, be concrete: one clear action, why it matters, and what outcome it should produce.',
        'Use only the structured CRM context provided below.',
        JSON.stringify(contextPayload, null, 2),
      ].join('\n');

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_ASSISTANT_MODEL,
          input: prompt,
          text: {
            format: {
              type: 'json_schema',
              name: 'assistant_briefing',
              strict: true,
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  executiveSummary: { type: 'string' },
                  dailyFocus: { type: 'string' },
                  priorities: { type: 'array', items: { type: 'string' } },
                  urgentClientsAnalysis: { type: 'string' },
                  propertiesToReviewAnalysis: { type: 'string' },
                  opportunities: { type: 'array', items: { type: 'string' } },
                  suggestedPrompts: { type: 'array', items: { type: 'string' } },
                  whatsAppDrafts: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        contactName: { type: 'string' },
                        reason: { type: 'string' },
                        message: { type: 'string' },
                      },
                      required: ['contactName', 'reason', 'message'],
                    },
                  },
                  nextStepPlans: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        contactName: { type: 'string' },
                        step: { type: 'string' },
                        reason: { type: 'string' },
                        expectedOutcome: { type: 'string' },
                      },
                      required: ['contactName', 'step', 'reason', 'expectedOutcome'],
                    },
                  },
                },
                required: [
                  'executiveSummary',
                  'dailyFocus',
                  'priorities',
                  'urgentClientsAnalysis',
                  'propertiesToReviewAnalysis',
                  'opportunities',
                  'suggestedPrompts',
                  'whatsAppDrafts',
                  'nextStepPlans',
                ],
              },
            },
          },
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Briefing generation failed with status ${response.status}: ${errorText}`);
      }

      const payload = await response.json();
      const parsed = BriefingAiOutputSchema.parse(JSON.parse(extractResponseText(payload)));
      aiOutput = {
        executiveSummary: parsed.executiveSummary.trim(),
        dailyFocus: parsed.dailyFocus.trim(),
        priorities: parsed.priorities.slice(0, 5),
        urgentClientsAnalysis: parsed.urgentClientsAnalysis.trim(),
        propertiesToReviewAnalysis: parsed.propertiesToReviewAnalysis.trim(),
        opportunities: parsed.opportunities.slice(0, 4),
        suggestedPrompts: parsed.suggestedPrompts.slice(0, 5),
        whatsAppDrafts: parsed.whatsAppDrafts.slice(0, 4),
        nextStepPlans: parsed.nextStepPlans.slice(0, 4),
      };
    } catch (error) {
      console.error('OpenAI briefing generation failed, using deterministic fallback:', error);
    }
  }

  return {
    summary: [
      { label: 'Vizionări azi', value: todayViewings.length },
      { label: 'Vizionări mâine', value: tomorrowViewings.length },
      { label: 'Follow-up urgent', value: followUpContacts.length },
      { label: 'Proprietăți de optimizat', value: propertiesToReview.length },
    ],
    priorities: aiOutput.priorities.map((text) => ({ text })),
    upcomingViewings: todayViewings.map((viewing) => ({
      id: viewing.id,
      time: format(parseISO(viewing.viewingDate), 'HH:mm'),
      title: viewing.propertyTitle,
      contact: viewing.contactName,
    })),
    urgentClients,
    propertiesToOptimize: propertiesToReview.slice(0, 4).map((property) => ({
      id: property.id,
      name: property.title,
      reason: `${property.images?.length || 0}/8 poze, descriere ${property.description?.trim().length || 0} caractere`,
      image: property.images?.[0]?.url || null,
    })),
    urgentClientsAnalysis: aiOutput.urgentClientsAnalysis,
    propertiesToReviewAnalysis: aiOutput.propertiesToReviewAnalysis,
    executiveSummary: aiOutput.executiveSummary,
    dailyFocus: aiOutput.dailyFocus,
    opportunities: aiOutput.opportunities,
    suggestedPrompts: aiOutput.suggestedPrompts,
    whatsAppDrafts: aiOutput.whatsAppDrafts,
    nextStepPlans: aiOutput.nextStepPlans,
  };
}
