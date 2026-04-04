'use server';

import type { Agency, Contact, Property, UserProfile, Viewing } from '@/lib/types';
import { isArchivedContact } from '@/lib/contact-aging';

const OPENAI_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_ASSISTANT_MODEL = process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';

interface AssistantWelcomeInput {
  contacts?: Contact[];
  properties?: Property[];
  viewings?: Viewing[];
  agency?: Agency;
  user?: UserProfile;
}

interface AssistantWelcomeOutput {
  title: string;
  subtitle: string;
  suggestions: string[];
}

function extractResponseText(payload: any) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim().length > 0) {
    return payload.output_text.trim();
  }

  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const textParts = outputs.flatMap((entry: any) => {
    const content = Array.isArray(entry?.content) ? entry.content : [];
    return content
      .map((item: any) => {
        if (typeof item?.text === 'string') return item.text;
        if (typeof item?.output_text === 'string') return item.output_text;
        return '';
      })
      .filter((text: string) => text.trim().length > 0);
  });

  return textParts.join('\n').trim();
}

function buildFallback(input: AssistantWelcomeInput): AssistantWelcomeOutput {
  return {
    title: 'Hai să vedem ce merită atacat primul astăzi.',
    subtitle: 'Pot să te ajut cu prioritizarea zilei, mesaje de follow-up, confirmări de vizionări și pașii următori pentru lead-urile bune.',
    suggestions: [
      'Spune-mi primele 3 lead-uri care merită sunate acum dacă vrem rezultat rapid.',
      'Arată-mi unde pierdem azi bani sau viteză în pipeline și ce fac imediat.',
      'Ce proprietăți active trebuie împinse primele dacă vrem mai multe vizionări?',
      'Scrie-mi mesajul care mută cel mai bun lead din interes în acțiune concretă.',
      'Ce contacte trebuie reactivate azi și cu ce abordare?',
      'Care este următorul pas comercial corect pentru lead-urile cele mai promițătoare?',
    ],
  };
}

export async function generateAssistantWelcome(input: AssistantWelcomeInput): Promise<AssistantWelcomeOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallback(input);

  const activeContacts = (input.contacts || []).filter((contact) => !isArchivedContact(contact));
  const activeProperties = (input.properties || []).filter((property) => property.status === 'Activ');
  const scheduledViewings = (input.viewings || []).filter((viewing) => viewing.status === 'scheduled');
  const negotiationCount = activeContacts.filter((contact) => contact.status === 'În negociere').length;
  const propertiesNeedingWork = activeProperties.filter(
    (property) => (property.images?.length || 0) < 8 || (property.description?.trim().length || 0) < 180
  ).length;

  const prompt = [
    'Write in Romanian.',
    'You are writing the welcome copy for a real-estate AI assistant used by agents in Romania.',
    'Return valid JSON only.',
    'The JSON must contain: title, subtitle, suggestions.',
    'title must be a natural human-sounding welcome title.',
    'subtitle must be a concise subtitle.',
    'suggestions must be an array of 6 strings.',
    'Both must sound like they were written by a smart human sales operator, not by a robot, not by a copywriter, and not by a luxury brand ad.',
    'Avoid hype, ad language, empty sophistication, and generic AI buzzwords.',
    'Do not write phrases like "elite", "succes garantat", "asistență avansată", "premium experience", "transformă", "revoluționează", or anything that sounds inflated.',
    'Prefer direct, warm, credible Romanian.',
    'The title should feel like a good operator looking at the day and speaking naturally.',
    'The subtitle should explain simply what the assistant can help with right now.',
    'Do not invent or infer exact numbers, dates, appointments, viewings, or CRM facts in the welcome copy.',
    'Do not mention any count unless it is absolutely necessary. Prefer zero exact figures in both lines.',
    'If you are not explicitly certain, keep the welcome high-signal and qualitative rather than numeric.',
    'The suggestions must sound like they come from a senior real-estate agent with decades of experience in sales.',
    'The suggestions must always be proactive, concrete, and focused on aggressive sales growth.',
    'The suggestions must push toward action on leads, viewings, negotiations, follow-up, and active properties.',
    'The suggestions must work only from the CRM context, without inventing facts.',
    'Do not make the suggestions generic. They should feel commercially sharp and execution-oriented.',
    'Think like a genius of residential sales who understands timing, urgency, follow-up windows before and after viewings, negotiations, buyer psychology, and property positioning.',
    'Make the suggestions feel like a senior operator who sees exactly where money can move fastest today.',
    'Do not use markdown, bullets, labels, quotes, or emojis.',
    'Do not mention AI in every line.',
    'Do not start with "Bună dimineața" unless it genuinely sounds natural.',
    'Make it specific to the CRM context below.',
    'Keep the title under 14 words if possible.',
    'Keep the subtitle under 22 words if possible.',
    'Good examples of tone:',
    'Astăzi merită să începi cu lead-urile care sunt aproape de vizionare.',
    'Ai câteva conversații bune în lucru. Hai să vedem unde merită intrat primul.',
    'Ziua asta se joacă în follow-up, vizionări și negocierile care nu trebuie lăsate să stea.',
    'Bad examples of tone:',
    'Gestionează elite pentru succes garantat.',
    'Optimizează portofoliul cu asistența noastră avansată.',
    'Transformă fiecare interacțiune într-o experiență premium.',
    'Ai 12 vizionări programate, hai să le urmărim pe cele mai importante.',
    '',
    JSON.stringify(
      {
        agencyName: input.agency?.name || null,
        userName: input.user?.name || null,
        activeContacts: activeContacts.length,
        activeProperties: activeProperties.length,
        scheduledViewings: scheduledViewings.length,
        negotiationsInProgress: negotiationCount,
        propertiesNeedingWork,
      },
      null,
      2
    ),
  ].join('\n');

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_ASSISTANT_MODEL,
        input: prompt,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Assistant welcome failed with status ${response.status}: ${errorText}`);
    }

    const payload = await response.json();
    const text = extractResponseText(payload);
    const parsed = JSON.parse(text);

    if (
      typeof parsed?.title === 'string' &&
      typeof parsed?.subtitle === 'string' &&
      Array.isArray(parsed?.suggestions) &&
      parsed.suggestions.every((item: unknown) => typeof item === 'string')
    ) {
      return {
        title: parsed.title.trim(),
        subtitle: parsed.subtitle.trim(),
        suggestions: parsed.suggestions.slice(0, 6).map((item: string) => item.trim()).filter(Boolean),
      };
    }

    return buildFallback(input);
  } catch (error) {
    console.error('OpenAI assistant welcome failed, using fallback:', error);
    return buildFallback(input);
  }
}
