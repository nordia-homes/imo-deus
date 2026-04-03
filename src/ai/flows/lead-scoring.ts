'use server';

import type { Contact, PortalRecommendation, Property, Task, Viewing } from '@/lib/types';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_LEAD_SCORING_MODEL = process.env.OPENAI_LEAD_SCORING_MODEL || 'gpt-5-mini';

export type ScoreBuyerInput = {
  contact: Contact;
  viewings?: Viewing[] | null;
  tasks?: Task[] | null;
  sourceProperty?: Property | null;
  recommendations?: PortalRecommendation[] | null;
};

export type ScoreBuyerOutput = {
  score: number;
  reason: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeDeterministicScore(input: ScoreBuyerInput): ScoreBuyerOutput {
  const { contact, viewings, tasks, recommendations, sourceProperty } = input;

  let score = 35;
  const reasons: string[] = [];
  const cautions: string[] = [];

  if (contact.budget && contact.budget >= 120000) {
    score += 14;
    reasons.push('buget solid pentru piața vizată');
  } else if (contact.budget && contact.budget >= 70000) {
    score += 9;
    reasons.push('buget decent și realist');
  } else if (contact.budget && contact.budget > 0) {
    score += 4;
  } else {
    cautions.push('buget insuficient clarificat');
  }

  if (contact.financialStatus === 'Cash') {
    score += 18;
    reasons.push('capacitate de cumpărare foarte bună');
  } else if (contact.financialStatus === 'Credit Aprobat') {
    score += 15;
    reasons.push('finanțare aprobată');
  } else if (contact.financialStatus === 'Credit Pre-aprobat') {
    score += 10;
    reasons.push('finanțare pre-aprobată');
  } else {
    cautions.push('situația financiară nu este încă validată complet');
  }

  const interactionCount = contact.interactionHistory?.length || 0;
  if (interactionCount >= 6) {
    score += 12;
    reasons.push('istoric consistent de interacțiuni');
  } else if (interactionCount >= 3) {
    score += 7;
    reasons.push('engagement bun în CRM');
  } else if (interactionCount === 0) {
    cautions.push('foarte puține interacțiuni documentate');
  }

  const scheduledOrCompletedViewings = (viewings || []).filter(
    (viewing) => viewing.status === 'scheduled' || viewing.status === 'completed'
  ).length;
  if (scheduledOrCompletedViewings >= 3) {
    score += 10;
    reasons.push('a ajuns frecvent în etapa de vizionare');
  } else if (scheduledOrCompletedViewings >= 1) {
    score += 6;
    reasons.push('a ajuns în etapa de vizionare');
  }

  const offerCount = contact.offers?.length || 0;
  if (offerCount >= 2) {
    score += 12;
    reasons.push('a făcut oferte, semn de intenție reală');
  } else if (offerCount === 1) {
    score += 8;
    reasons.push('există cel puțin o ofertă în istoric');
  }

  if ((recommendations || []).length >= 4) {
    score += 5;
  }

  if ((contact.preferencesChatHistory?.length || 0) >= 4) {
    score += 4;
    reasons.push('preferințele sunt mai bine calibrate');
  }

  if (contact.city || (contact.zones?.length || 0) > 0 || contact.preferences?.desiredFeatures) {
    score += 5;
  } else {
    cautions.push('preferințele de căutare sunt încă vagi');
  }

  if (sourceProperty?.id) {
    score += 3;
  }

  if ((tasks || []).some((task) => task.status === 'open')) {
    score -= 2;
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const summary = [
    reasons.slice(0, 3).join(', '),
    cautions[0] ? `Atenție: ${cautions[0]}.` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return {
    score: finalScore,
    reason: summary || 'Scor calculat din semnalele disponibile în CRM.',
  };
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const content = payload?.output?.[0]?.content;
  if (Array.isArray(content)) {
    const textItem = content.find((item: any) => typeof item?.text === 'string');
    if (textItem?.text) {
      return textItem.text;
    }
  }

  return '';
}

export async function leadScoring(input: ScoreBuyerInput): Promise<ScoreBuyerOutput> {
  const fallback = computeDeterministicScore(input);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  const payload = {
    buyer: {
      id: input.contact.id,
      name: input.contact.name,
      status: input.contact.status,
      budget: input.contact.budget || null,
      financialStatus: input.contact.financialStatus || null,
      city: input.contact.city || null,
      zones: input.contact.zones || [],
      priority: input.contact.priority || null,
      description: input.contact.description || null,
      preferences: input.contact.preferences || {},
      preferencesChatHistory: input.contact.preferencesChatHistory || [],
      interactionHistory: input.contact.interactionHistory || [],
      offers: input.contact.offers || [],
      recommendationHistory: input.contact.recommendationHistory || {},
      sourcePropertyId: input.contact.sourcePropertyId || null,
    },
    sourceProperty: input.sourceProperty
      ? {
          id: input.sourceProperty.id,
          title: input.sourceProperty.title,
          price: input.sourceProperty.price,
          location: input.sourceProperty.location,
          rooms: input.sourceProperty.rooms,
          squareFootage: input.sourceProperty.squareFootage,
        }
      : null,
    viewings: input.viewings || [],
    tasks: input.tasks || [],
    recommendations: input.recommendations || [],
    deterministicBaseline: fallback,
  };

  const prompt = [
    'You are an expert Romanian real-estate buyer credibility scoring engine.',
    'Analyze the buyer only using the CRM data provided.',
    'Return a credibility/priority score from 0 to 100.',
    'Higher score means the buyer is more credible, better qualified, and deserves stronger sales prioritization.',
    'Use strong signals first: financial readiness, consistency of behavior, viewings, offers, specificity of preferences, continuity of engagement.',
    'Do not be overly optimistic. Penalize missing or vague data.',
    'The reason must be in Romanian, concise, and actionable.',
    JSON.stringify(payload, null, 2),
  ].join('\n');

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_LEAD_SCORING_MODEL,
        reasoning: { effort: 'low' },
        input: prompt,
        text: {
          format: {
            type: 'json_schema',
            name: 'buyer_credibility_score',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                score: { type: 'integer', minimum: 0, maximum: 100 },
                reason: { type: 'string' },
              },
              required: ['score', 'reason'],
            },
          },
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`OpenAI lead scoring failed with status ${response.status}`);
    }

    const data = await response.json();
    const text = extractResponseText(data);
    const parsed = JSON.parse(text) as ScoreBuyerOutput;

    return {
      score: clamp(Math.round(parsed.score), 0, 100),
      reason: parsed.reason?.trim() || fallback.reason,
    };
  } catch (error) {
    console.error('OpenAI buyer credibility scoring failed, using deterministic fallback:', error);
    return fallback;
  }
}
