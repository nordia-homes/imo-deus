import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), referencesAllowed: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { originalFragment, conversationHistorySchema, readConversationHistory } from '../conversation-history';
import { collectionFor, referencesAllowed } from '../access';
it('recovers an entire long message including a late negation without silent truncation', () => {
 const text = 'Publică proprietatea. '.repeat(200) + 'Dar NU în grupul Titan.';
 let combined = '', offset = 0;
 for (;;) { const fragment = originalFragment(text, offset); combined += fragment.value; if (fragment.complete) break; offset = fragment.nextOffset!; }
 expect(combined).toBe(text);
 expect(combined).toContain('NU în grupul Titan');
});
it('preserves Unicode across fragment boundaries and validates offsets',()=>{
 const text = 'a'.repeat(999) + '🏠Cișmigiu';
 const first = originalFragment(text);
 expect(first.value).toHaveLength(999);
 expect(first.value+originalFragment(text,first.nextOffset!).value).toBe(text);
 expect(()=>originalFragment(text,text.length+1)).toThrow();
 expect(()=>conversationHistorySchema.parse({offset:10})).toThrow();
 expect(()=>conversationHistorySchema.parse({messageId:'m',before:'b'})).toThrow();
});
it('refuses another user session before reading its messages', async()=>{
 const collection=vi.fn();
 vi.mocked(collectionFor).mockReturnValue({doc:()=>({get:async()=>({exists:true,data:()=>({ownerId:'other'})}),collection})} as any);
 await expect(readConversationHistory({uid:'me',prospectingRequest:{sessionId:'s'}} as any,{})).rejects.toThrow('accesibilă');
 expect(collection).not.toHaveBeenCalled();
});
it('revalidates resource access before returning original text', async()=>{
 vi.mocked(referencesAllowed).mockResolvedValue(false);
 const message={exists:true,id:'m',data:()=>({text:'private',accessRefs:[{resource:'properties',id:'p'}]})};
 vi.mocked(collectionFor).mockReturnValue({doc:()=>({get:async()=>({exists:true,data:()=>({ownerId:'me'})}),collection:()=>({doc:()=>({get:async()=>message})})})} as any);
 await expect(readConversationHistory({uid:'me',prospectingRequest:{sessionId:'s'}} as any,{messageId:'m'})).rejects.toThrow('accesibil');
});
