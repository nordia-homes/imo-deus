'use server';

import type { Property } from '@/lib/types';

type PropertyDescriptionOutput = {
  description: string;
};

function buildPrompt(property: Property) {
  return `You are a premium Romanian real estate copywriter.

Use the following JSON object which contains all available information about the property:
\`\`\`json
${JSON.stringify(property, null, 2)}
\`\`\`

Your job:
- Write a fluent, persuasive, natural property description in Romanian.
- Carefully use all relevant information available in the data, especially:
  - main details
  - specifications
  - finishes and amenities
  - location details
  - the text from "keyFeatures"
  - the existing "description" if one already exists
- If an existing description is present, do not ignore it. Rewrite, refine, and improve it into a better, more coherent final version.
- If "keyFeatures" contains essential selling points, integrate them naturally into the final text.

Writing rules:
- Do not output bullet points.
- Do not dump raw technical fields mechanically.
- Turn the information into a readable narrative with a premium, sales-oriented tone.
- Keep the text realistic and professional, not exaggerated or spammy.
- Mention the location benefits naturally when possible.
- Mention the price only if it fits naturally in the copy; do not force it awkwardly.
- Focus on clarity, desirability, comfort, lifestyle, and decision-making value for a buyer or tenant.
- If some fields are missing, do not mention that they are missing.
- Never mention internal/admin-only information such as owner data, internal scores, assigned agent IDs, or internal status logic.

Return only the final Romanian description text.`;
}

export async function generatePropertyDescription(property: Property): Promise<PropertyDescriptionOutput> {
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
      temperature: 0.7,
      messages: [
        {
          role: 'developer',
          content: 'You write premium Romanian real estate descriptions that are clear, natural, persuasive, and based strictly on the provided property data.',
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

  const description = payload?.choices?.[0]?.message?.content?.trim();

  if (!description) {
    throw new Error('OpenAI nu a returnat o descriere valida.');
  }

  return { description };
}
