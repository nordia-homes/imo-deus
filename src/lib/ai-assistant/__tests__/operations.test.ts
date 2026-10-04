import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { operations, operationPath, invokeOperation } from '../operations';
import type { AssistantContext } from '../access';
describe('existing handler adapters', () => {
  it('registers only actual handler methods', () => {
    const source = fs.readFileSync('src/lib/ai-assistant/operations.ts', 'utf8');
    let checked = 0;
    for (const match of source.matchAll(/\w+: \{ method: '(\w+)',[^\n]*?import\('@\/([^']+)'\)/g)) {
      checked++;
      const code = fs.readFileSync('src/' + match[2] + '.ts', 'utf8');
      expect(code, match[2] + ' lacks ' + match[1]).toMatch(new RegExp('export (?:async function ' + match[1] + '\\b|(?:const|\\{)[\\s\\S]*\\b' + match[1] + '\\b)'));
    }
    expect(checked).toBe(Object.keys(operations).length);
  });
  it('rejects URLs and path traversal in route parameters', () => {
    expect(() => operationPath(operations.message_send, { conversationId: '../consent' })).toThrow();
    expect(() => operationPath(operations.message_send, { conversationId: 'https://attacker.test' })).toThrow();
    expect(operationPath(operations.message_send, { conversationId: 'conversation' })).toBe('/api/communications/conversations/conversation/messages');
  });
  it('rejects mutation through a read tool and unknown operation names', async () => {
    const ctx = { agencyId: 'a', runtimeMode: 'real' } as AssistantContext;
    await expect(invokeOperation(ctx, { operation: 'message_send', params: {}, query: {}, body: {} }, true)).rejects.toThrow();
    await expect(invokeOperation(ctx, { operation: 'fetch_any_url', params: {}, query: {}, body: {} })).rejects.toThrow();
  });
  it('prevents the background video worker from selecting an unallowlisted text model', async () => {
    const ctx = { agencyId: 'a', runtimeMode: 'real' } as AssistantContext;
    await expect(invokeOperation(ctx, { operation: 'video_create', params: { propertyId: 'p' }, query: {}, body: { includeAiPresenter: true } })).rejects.toThrow('aiPresenterScript');
  });
});
