'use server';

import { z } from 'zod';

const SocialMediaPostInputSchema = z.object({
  title: z.string().describe("The title of the property listing."),
  price: z.number().describe("The price of the property."),
  transactionType: z.string().describe("The type of transaction ('Vânzare' or 'Închiriere')."),
  location: z.string().describe("The location of the property."),
  rooms: z.number().describe("The number of rooms."),
  squareFootage: z.number().describe("The square footage."),
});
type SocialMediaPostInput = z.infer<typeof SocialMediaPostInputSchema>;

const SocialMediaPostOutputSchema = z.object({
  post: z.string().describe('The generated social media post content, including emojis and hashtags.'),
});
type SocialMediaPostOutput = z.infer<typeof SocialMediaPostOutputSchema>;

function buildPrompt(input: SocialMediaPostInput) {
  return `You are a creative real estate marketing expert for the Romanian market.
Write a short, engaging, and professional social media post in Romanian for Facebook or Instagram.

Property details:
- Titlu: ${input.title}
- Pret: €${input.price}
- Tip tranzactie: ${input.transactionType}
- Locatie: ${input.location}
- Camere: ${input.rooms}
- Suprafata: ${input.squareFootage} mp

Instructions:
- Start with a strong, attention-grabbing hook.
- Highlight the best features concisely.
- Use emojis like 🏠 ✨ 🔑 💰 📍 in a tasteful way.
- Include the price naturally and add a clear call to action.
- End with 3-5 relevant hashtags for Romanian real estate and the location.
- Keep the tone enthusiastic but professional.

Return only the final post text in Romanian.`;
}

export async function generateSocialMediaPost(input: SocialMediaPostInput): Promise<SocialMediaPostOutput> {
  const parsedInput = SocialMediaPostInputSchema.parse(input);
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
      temperature: 0.8,
      messages: [
        {
          role: 'developer',
          content:
            'You write short Romanian social media posts for real estate listings. Keep them polished, human, and ready to publish.',
        },
        {
          role: 'user',
          content: buildPrompt(parsedInput),
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      'OpenAI nu a putut genera postarea social media.';

    throw new Error(message);
  }

  const post = payload?.choices?.[0]?.message?.content?.trim();

  if (!post) {
    throw new Error('OpenAI nu a returnat o postare valida.');
  }

  return SocialMediaPostOutputSchema.parse({ post });
}
