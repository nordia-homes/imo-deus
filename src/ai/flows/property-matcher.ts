'use server';

import type { Contact, ContactPreferences, MatchedBuyer, MatchedProperty, Property } from '@/lib/types';
import {
  derivePreferencesFromContact,
  getDeterministicMatchedBuyers,
  getDeterministicMatchedProperties,
  scoreBuyerForProperty,
  scorePropertyForPreferences,
} from '@/lib/matching-engine';

export type PropertyMatcherInput = {
  clientPreferences: ContactPreferences;
  properties: Property[];
  contact?: Contact | null;
};

export type PropertyMatcherOutput = {
  matchedProperties: MatchedProperty[];
};

export type BuyerMatcherInput = {
  property: Property;
  contacts: Contact[];
};

export type BuyerMatcherOutput = {
  matchedBuyers: MatchedBuyer[];
};

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_MATCHING_MODEL = process.env.OPENAI_MATCHING_MODEL || 'gpt-5-mini';

type OpenAIRankedItem = {
  id: string;
  matchScore: number;
  reasoning: string;
};

function normalizeProperties(input: PropertyMatcherInput) {
  return input.properties.map((property) => ({
    ...property,
    address: property.address || property.location || '',
    price: property.price || 0,
    rooms: property.rooms || 0,
    bathrooms: property.bathrooms || 0,
    squareFootage: property.squareFootage || 0,
    description: property.description || property.title || '',
    images: property.images || [],
  }));
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

async function rankWithOpenAI<T extends { id: string; matchScore: number; reasoning: string }>(args: {
  schemaName: string;
  taskLabel: string;
  context: Record<string, unknown>;
  candidates: T[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || args.candidates.length === 0) {
    return null;
  }

  const prompt = [
    `You are a Romanian real-estate matching engine.`,
    `Task: ${args.taskLabel}.`,
    `You will receive already prefiltered candidates with deterministic scores.`,
    `Re-rank them and return only the strongest matches.`,
    `Rules:`,
    `- Scores must be integers from 0 to 100.`,
    `- Keep the ranking realistic, not generous.`,
    `- Prefer hard constraints first: budget, area, rooms, location, property type.`,
    `- Then refine for softer fit: features, trade-offs, overall desirability.`,
    `- Reasoning must be short, in Romanian, one sentence per item.`,
    `- Do not invent missing facts.`,
    JSON.stringify(
      {
        context: args.context,
        candidates: args.candidates,
      },
      null,
      2
    ),
  ].join('\n');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MATCHING_MODEL,
      reasoning: { effort: 'low' },
      input: prompt,
      text: {
        format: {
          type: 'json_schema',
          name: args.schemaName,
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              results: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    matchScore: { type: 'integer', minimum: 0, maximum: 100 },
                    reasoning: { type: 'string' },
                  },
                  required: ['id', 'matchScore', 'reasoning'],
                },
              },
            },
            required: ['results'],
          },
        },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`OpenAI matching request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const responseText = extractResponseText(payload);
  const parsed = JSON.parse(responseText) as { results?: OpenAIRankedItem[] };

  if (!parsed.results || !Array.isArray(parsed.results)) {
    return null;
  }

  const candidateById = new Map(args.candidates.map((candidate) => [candidate.id, candidate]));
  return parsed.results
    .map((item) => {
      const original = candidateById.get(item.id);
      if (!original) {
        return null;
      }

      return {
        ...original,
        matchScore: Math.max(0, Math.min(100, Math.round(item.matchScore))),
        reasoning: item.reasoning?.trim() || original.reasoning,
      };
    })
    .filter(Boolean) as T[];
}

export async function propertyMatcher(input: PropertyMatcherInput): Promise<PropertyMatcherOutput> {
  const properties = normalizeProperties(input);
  const fallback = properties
    .map((property) => ({
      ...property,
      ...scorePropertyForPreferences(property, input.clientPreferences, input.contact || undefined),
    }))
    .map((property) => ({
      ...property,
      matchScore: property.score,
      reasoning: property.reasoning || 'Compatibilitate buna pe criteriile esentiale.',
    }))
    .filter((property) => property.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 12) as MatchedProperty[];

  const deterministicTop = fallback.slice(0, 8).map((property) => ({
    id: property.id,
    matchScore: property.matchScore,
    reasoning: property.reasoning,
    title: property.title,
    price: property.price,
    rooms: property.rooms,
    bathrooms: property.bathrooms,
    squareFootage: property.squareFootage,
    location: property.location,
    propertyType: property.propertyType,
  }));

  try {
    const reranked = await rankWithOpenAI({
      schemaName: 'property_match_results',
      taskLabel: 'Match one buyer profile with the best property candidates',
      context: {
        buyerPreferences: input.clientPreferences,
        buyer: input.contact
          ? {
              id: input.contact.id,
              name: input.contact.name,
              budget: input.contact.budget,
              city: input.contact.city,
              zones: input.contact.zones,
              desiredFeatures: input.contact.preferences?.desiredFeatures,
            }
          : null,
      },
      candidates: deterministicTop,
    });

    if (!reranked || reranked.length === 0) {
      return { matchedProperties: fallback };
    }

    const propertyById = new Map(fallback.map((property) => [property.id, property]));
    const matchedProperties = reranked
      .map((item) => {
        const original = propertyById.get(item.id);
        if (!original) {
          return null;
        }

        return {
          ...original,
          matchScore: item.matchScore,
          reasoning: item.reasoning,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.matchScore - a!.matchScore) as MatchedProperty[];

    return { matchedProperties };
  } catch (error) {
    console.error('OpenAI property matching failed, using deterministic fallback:', error);
    return { matchedProperties: fallback };
  }
}

export async function buyerMatcher(input: BuyerMatcherInput): Promise<BuyerMatcherOutput> {
  const fallback = getDeterministicMatchedBuyers(input.property, input.contacts, 12);
  const deterministicTop = fallback.slice(0, 8).map((buyer) => ({
    id: buyer.id,
    matchScore: buyer.matchScore,
    reasoning: buyer.reasoning,
    name: buyer.name,
    budget: buyer.budget || 0,
    city: buyer.city || '',
    zones: buyer.zones || [],
    desiredRooms: buyer.preferences?.desiredRooms || 0,
    desiredBathrooms: buyer.preferences?.desiredBathrooms || 0,
    desiredSquareFootageMin: buyer.preferences?.desiredSquareFootageMin || 0,
    desiredPriceRangeMax: buyer.preferences?.desiredPriceRangeMax || buyer.budget || 0,
    desiredFeatures: buyer.preferences?.desiredFeatures || '',
  }));

  try {
    const reranked = await rankWithOpenAI({
      schemaName: 'buyer_match_results',
      taskLabel: 'Match one property with the best buyer candidates',
      context: {
        property: {
          id: input.property.id,
          title: input.property.title,
          price: input.property.price,
          rooms: input.property.rooms,
          bathrooms: input.property.bathrooms,
          squareFootage: input.property.squareFootage,
          location: input.property.location,
          address: input.property.address,
          propertyType: input.property.propertyType,
          description: input.property.description,
          features: input.property.keyFeatures || input.property.amenities || [],
        },
      },
      candidates: deterministicTop,
    });

    if (!reranked || reranked.length === 0) {
      return { matchedBuyers: fallback };
    }

    const buyerById = new Map(fallback.map((buyer) => [buyer.id, buyer]));
    const matchedBuyers = reranked
      .map((item) => {
        const original = buyerById.get(item.id);
        if (!original) {
          return null;
        }

        return {
          ...original,
          matchScore: item.matchScore,
          reasoning: item.reasoning,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.matchScore - a!.matchScore) as MatchedBuyer[];

    return { matchedBuyers };
  } catch (error) {
    console.error('OpenAI buyer matching failed, using deterministic fallback:', error);
    return { matchedBuyers: fallback };
  }
}

export async function propertyMatcherFromContact(contact: Contact, properties: Property[]) {
  return propertyMatcher({
    clientPreferences: derivePreferencesFromContact(contact),
    properties,
    contact,
  });
}

export async function buyerMatcherFromProperty(property: Property, contacts: Contact[]) {
  return buyerMatcher({
    property,
    contacts,
  });
}
