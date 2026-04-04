'use server';

type OpenAiDebugInfo = {
  hasKey: boolean;
  keySuffix: string | null;
  model: string;
};

export async function getOpenAiDebugInfo(): Promise<OpenAiDebugInfo> {
  const apiKey = process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENAI_ASSISTANT_MODEL || process.env.OPENAI_TEXT_MODEL || 'gpt-4.1-mini';

  return {
    hasKey: apiKey.length > 0,
    keySuffix: apiKey.length >= 6 ? apiKey.slice(-6) : null,
    model,
  };
}
