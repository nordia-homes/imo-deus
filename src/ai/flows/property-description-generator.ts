'use server';

import type { Property } from '@/lib/types';

type PropertyDescriptionOutput = {
  description: string;
};

type PropertyDescriptionInput = Property & {
  agentPhone?: string | null;
};

type DescriptionSections = {
  headlineIntro: string;
  body: string;
};

function normalizeHeadlineIntro(value: string) {
  const trimmed = value.trim();
  const pipeIndex = trimmed.indexOf('|');

  if (pipeIndex >= 0) {
    return trimmed.slice(pipeIndex + 1).trim();
  }

  return trimmed;
}

function formatPrice(price?: number) {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return 'Nedisponibil';
  }

  return `${new Intl.NumberFormat('ro-RO').format(price)} EUR`;
}

function buildPrompt(property: PropertyDescriptionInput) {
  return `You are a premium Romanian real estate copywriter.

Use the following JSON object which contains all available information about the property:
\`\`\`json
${JSON.stringify(property, null, 2)}
\`\`\`

Your job:
- Write the content in Romanian.
- Carefully use all relevant information available in the data, especially:
  - main details
  - specifications
  - finishes and amenities
  - location details
  - the text from "keyFeatures"
  - the existing "description" if one already exists
  - the sale price from "price"
  - the contact phone from "agentPhone"
- If an existing description is present, do not ignore it. Rewrite, refine, and improve it into a better, more coherent final version.
- If "keyFeatures" contains essential selling points, integrate them naturally into the final text.

Writing rules:
- Do not output bullet points.
- Do not dump raw technical fields mechanically.
- Turn the information into a readable narrative with a premium, sales-oriented tone.
- Keep the text realistic and professional, not exaggerated or spammy.
- Mention the location benefits naturally when possible.
- Focus on clarity, desirability, comfort, lifestyle, and decision-making value for a buyer or tenant.
- If some fields are missing, do not mention that they are missing.
- Never mention internal/admin-only information such as owner data, internal scores, assigned agent IDs, or internal status logic.
- The first paragraph must start directly with the intro sentence, without any title prefix before it.
- Do not add formats like "Apartament 2 camere decomandat | ...".
- A correct example for the first paragraph is:
  "Vă propunem spre vânzare un apartament cu două camere, decomandat, situat în Sector 4, o zonă dinamică și accesibilă a Bucureștiului."
- The rest of the description must continue naturally after that intro.
- Do not include the mandatory fixed commission sentence, the price line, the phone line, or the final closing sentence in the generated body. Those will be added separately.

Return valid JSON only, with exactly these keys:
{
  "headlineIntro": "first paragraph only",
  "body": "remaining description only"
}`;
}

function extractDescriptionSections(content: string): DescriptionSections {
  const trimmed = content.trim();

  try {
    const parsed = JSON.parse(trimmed) as Partial<DescriptionSections>;
    const headlineIntro = typeof parsed.headlineIntro === 'string' ? parsed.headlineIntro.trim() : '';
    const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';

    if (headlineIntro && body) {
      return { headlineIntro, body };
    }
  } catch {
    const paragraphs = trimmed
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    if (paragraphs.length >= 2) {
      return {
        headlineIntro: paragraphs[0],
        body: paragraphs.slice(1).join('\n\n'),
      };
    }
  }

  throw new Error('OpenAI nu a returnat structura valida pentru descrierea proprietatii.');
}

export async function generatePropertyDescription(property: PropertyDescriptionInput): Promise<PropertyDescriptionOutput> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY nu este setata.');
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini',
      temperature: 0.3,
      messages: [
        {
          role: 'developer',
          content:
            'You write premium Romanian real estate descriptions that are clear, natural, persuasive, and based strictly on the provided property data. You must follow the requested output structure exactly.',
        },
        {
          role: 'user',
          content: buildPrompt(property),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      'OpenAI nu a putut genera descrierea proprietatii.';

    throw new Error(message);
  }

  const content = payload?.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('OpenAI nu a returnat o descriere valida.');
  }

  const { headlineIntro, body } = extractDescriptionSections(content);
  const priceLine = `Pretul de vanzare: ${formatPrice(property.price)}`;
  const phoneLine = `Telefon de contact: ${property.agentPhone?.trim() || 'Nedisponibil'}`;

  const description = [
    normalizeHeadlineIntro(headlineIntro),
    'Proprietatea este disponibila cu 0% comision la vanzare pentru a facilita o tranzactie rapida, corecta si transparenta',
    body,
    priceLine,
    phoneLine,
    'Va asteptam la vizionare inclusiv in weekend. Pentru mai multe detalii, va rog sa ma contactati.',
  ].join('\n\n');

  return { description };
}
