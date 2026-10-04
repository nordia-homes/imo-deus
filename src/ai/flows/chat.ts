'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Agency, Contact, Property, UserProfile, Viewing } from '@/lib/types';
import { assistantContext } from '@/lib/ai-assistant/access';
import { chatTurn } from '@/lib/ai-assistant/workspace';

// Compatibility for the retired chat component. Never trust browser CRM snapshots.
interface ChatInput {
  authorization?: string;
  sessionId?: string;
  history: { role: 'user' | 'model'; content: { text: string }[] }[];
  prompt: string;
  contacts?: Contact[];
  properties?: Property[];
  viewings?: Viewing[];
  agency?: Agency;
  user?: UserProfile;
}
export async function chat(input: ChatInput): Promise<{ response: string }> {
  const ctx = await assistantContext(new Request('http://assistant.internal', { headers: { authorization: input.authorization || '' } }));
  const prompt = z.string().trim().min(1).max(6000).parse(input.prompt);
  const result = await chatTurn(ctx, { prompt, sessionId: input.sessionId ? z.string().uuid().parse(input.sessionId) : randomUUID(), requestId: randomUUID() });
  return { response: result.message.text };
}
