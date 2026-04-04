'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { collection, orderBy, query } from 'firebase/firestore';
import { addDocumentNonBlocking, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { chat } from '@/ai/flows/chat';
import { generateAssistantWelcome } from '@/ai/flows/assistant-welcome';
import type { Contact, Property, Viewing } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot,
  Loader2,
  MessageSquareText,
  Mic,
  Send,
  Sparkles,
  User,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatHistoryMessage = { role: 'user' | 'model'; text: string };

const STARTER_PROMPTS = [
  'Spune-mi primele 3 lead-uri pe care trebuie să le sun azi și de ce.',
  'Scrie-mi un mesaj WhatsApp care mută lead-ul cel mai bun spre vizionare.',
  'Arată-mi unde pierdem acum în pipeline și ce fac azi.',
  'Spune-mi ce proprietăți active trebuie optimizate urgent pentru a genera mai multe vizionări.',
];

export default function AiAssistantPage() {
  const { agencyId, agency, userProfile, user } = useAgency();
  const firestore = useFirestore();
  const { toast } = useToast();

  const contactsQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'contacts'), orderBy('createdAt', 'desc')) : null),
    [firestore, agencyId]
  );
  const propertiesQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'properties')) : null),
    [firestore, agencyId]
  );
  const viewingsQuery = useMemoFirebase(
    () => (agencyId ? query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'desc')) : null),
    [firestore, agencyId]
  );

  const { data: contacts } = useCollection<Contact>(contactsQuery);
  const { data: properties } = useCollection<Property>(propertiesQuery);
  const { data: viewings } = useCollection<Viewing>(viewingsQuery);

  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [welcome, setWelcome] = useState<{ title: string; subtitle: string; suggestions: string[] } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const welcomeRequestedRef = useRef<string | null>(null);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (!agencyId || !contacts || !properties || !viewings) return;
    if (welcomeRequestedRef.current === agencyId) return;

    welcomeRequestedRef.current = agencyId;

    generateAssistantWelcome({
      contacts,
      properties,
      viewings,
      agency,
      user: userProfile,
    })
      .then((result) => {
        setWelcome(result);
      })
      .catch((error) => {
        console.error('Assistant welcome generation failed', error);
      });
  }, [agency, agencyId, contacts, properties, userProfile, viewings]);

  async function handleSend(promptOverride?: string) {
    const prompt = (promptOverride || input).trim();
    if (!prompt) return;

    setMessages((prev) => [...prev, { role: 'user', text: prompt }]);
    setInput('');
    setChatLoading(true);

    try {
      const result = await chat({
        history: messages.map((message) => ({
          role: message.role,
          content: [{ text: message.text }],
        })),
        prompt,
        contacts: contacts || [],
        properties: properties || [],
        viewings: viewings || [],
        agency,
        user: userProfile,
      });

      setMessages((prev) => [...prev, { role: 'model', text: result.response }]);

      const actionMatch = result.response.match(/\[ACTION:scheduleViewing\]([\s\S]*?)\[\/ACTION\]/);
      if (actionMatch?.[1] && agencyId && user) {
        const params = JSON.parse(actionMatch[1]);
        const property = properties?.find((item) => item.title === params.propertyTitle);
        const contact = contacts?.find((item) => item.name === params.contactName);

        if (property && contact) {
          addDocumentNonBlocking(collection(firestore, `agencies/${agencyId}/viewings`), {
            propertyId: property.id,
            propertyTitle: property.title,
            propertyAddress: property.address,
            contactId: contact.id,
            contactName: contact.name,
            viewingDate: params.isoDateTime,
            notes: 'Programat din AI Assistant.',
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
            createdAt: new Date().toISOString(),
          });

          toast({ title: 'Vizionare programată!' });
        }
      }
    } catch (error) {
      console.error('AI chat failed', error);
      toast({
        variant: 'destructive',
        title: 'Nu am putut comunica cu asistentul AI.',
      });
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden bg-[#07111f] text-white lg:h-[calc(100vh-5rem)]">
      <div className="relative h-full overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(59,130,246,0.18),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(56,189,248,0.14),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(37,99,235,0.16),transparent_34%),linear-gradient(180deg,#12253f_0%,#0c1a30_14%,#081322_34%,#07111f_100%)]" />
        <div className="pointer-events-none absolute left-[-8rem] top-24 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-[-10rem] top-16 h-[28rem] w-[28rem] rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-8rem] left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative mx-auto flex h-full w-full max-w-[1540px] flex-col px-2 py-2 sm:px-3 sm:py-3 lg:px-6 lg:py-4">
          <div className="flex h-full min-h-0 flex-1 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-3 pt-3 pb-3 sm:px-3 sm:pt-3 sm:pb-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 lg:px-4 lg:pt-4 lg:pb-4">
                <div className="min-h-0 overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))]">
                  <div className="flex min-h-0 h-full flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6">
                      <div className="flex items-center gap-2 text-sky-200/80">
                        <Bot className="h-4 w-4" />
                        <span className="text-sm">Asistent AI</span>
                      </div>
                    </div>
                    <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
                      {messages.length === 0 ? (
                        <div className="mx-auto flex h-full max-h-full max-w-4xl flex-col items-center justify-center overflow-hidden px-3 py-4 text-center sm:px-4 sm:py-6 lg:px-6 lg:py-8">
                          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-sky-300/25 bg-sky-300/8 text-sky-300 shadow-[0_0_90px_rgba(56,189,248,0.16)] sm:h-18 sm:w-18 lg:h-20 lg:w-20">
                            <Sparkles className="h-8 w-8 lg:h-9 lg:w-9" />
                          </div>

                          <h1 className="max-w-3xl text-balance text-[2rem] font-semibold tracking-tight sm:text-[2.35rem] sm:leading-[1.1] lg:text-[2.75rem] lg:leading-[1.06]">
                            {welcome?.title || 'Asistentul tău analizează CRM-ul și pregătește direcția zilei.'}
                          </h1>

                          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 sm:text-[0.98rem] sm:leading-7 lg:mt-4 lg:text-[1.02rem] lg:leading-8">
                            {welcome?.subtitle || 'Spune-mi direct ce vrei să prioritizăm, să scriem, să confirmăm sau să împingem mai departe.'}
                          </p>
                        </div>
                      ) : (
                        <div className="mx-auto flex max-w-4xl flex-col gap-5">
                          {messages.map((message, index) => (
                            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {message.role === 'model' ? (
                                <MessageAvatar variant="model">
                                  <Bot className="h-5 w-5" />
                                </MessageAvatar>
                              ) : null}

                              <div
                                className={`prose prose-sm max-w-[92%] break-words rounded-[28px] px-4 py-4 shadow-sm sm:px-5 lg:max-w-[84%] lg:prose-base ${
                                  message.role === 'model'
                                    ? 'border border-white/10 bg-white/[0.055] text-white'
                                    : 'bg-sky-400 text-slate-950'
                                }`}
                              >
                                <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
                              </div>

                              {message.role === 'user' ? (
                                <MessageAvatar variant="user">
                                  <User className="h-5 w-5" />
                                </MessageAvatar>
                              ) : null}
                            </div>
                          ))}

                          {chatLoading ? (
                            <div className="flex gap-3">
                              <MessageAvatar variant="model">
                                <Bot className="h-5 w-5" />
                              </MessageAvatar>
                              <div className="rounded-[28px] border border-white/10 bg-white/[0.055] px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 animate-bounce rounded-full bg-sky-300" />
                                  <span className="h-2 w-2 animate-bounce rounded-full bg-sky-300 [animation-delay:0.15s]" />
                                  <span className="h-2 w-2 animate-bounce rounded-full bg-sky-300 [animation-delay:0.3s]" />
                                </div>
                              </div>
                            </div>
                          ) : null}

                          <div ref={chatEndRef} />
                        </div>
                      )}
                    </div>

                    <div className="px-3 py-3 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
                      <div className="mx-auto max-w-4xl">
                        <div className="rounded-[28px] border border-sky-300/12 bg-[linear-gradient(180deg,rgba(56,189,248,0.06),rgba(255,255,255,0.025))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                          <div className="grid grid-cols-1 gap-2 border-b border-white/8 px-2 pb-3 pt-1 sm:grid-cols-2">
                            {STARTER_PROMPTS.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                onClick={() => setInput(prompt)}
                                className="truncate rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-left text-xs text-white/72 transition hover:border-sky-300/20 hover:bg-white/10 hover:text-white"
                                title={prompt}
                              >
                                <span className="block truncate">{prompt}</span>
                              </button>
                            ))}
                          </div>

                          <div className="flex items-end gap-2 pt-2">
                            <div className="flex h-14 w-11 shrink-0 items-center justify-center text-white/38 sm:w-12">
                              <Mic className="h-4 w-4" />
                            </div>

                            <Input
                              value={input}
                              onChange={(event) => setInput(event.target.value)}
                              onKeyDown={(event) => event.key === 'Enter' && !chatLoading && handleSend()}
                              placeholder="Start your request, iar asistentul se ocupă de restul..."
                              className="h-14 border-0 bg-transparent px-0 text-base text-white placeholder:text-white/35 focus-visible:ring-0 focus-visible:ring-offset-0"
                              disabled={chatLoading}
                            />

                            <Button
                              size="icon"
                              className="h-12 w-12 shrink-0 rounded-full bg-sky-400 text-slate-950 hover:bg-sky-300"
                              onClick={() => handleSend()}
                              disabled={chatLoading}
                            >
                              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="min-h-0 overflow-hidden rounded-[30px] bg-[linear-gradient(180deg,rgba(59,130,246,0.09),rgba(255,255,255,0.02))]">
                  <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-xl font-medium text-white">Sugestii asistent</p>
                        <p className="mt-1 text-sm text-white/45">Lansează rapid sarcini utile</p>
                      </div>
                      <Sparkles className="h-4 w-4 text-sky-200/55" />
                    </div>

                    <div className="flex-1 overflow-y-auto px-4 py-4">
                      <div className="space-y-3">
                        {(welcome?.suggestions?.length ? welcome.suggestions : STARTER_PROMPTS).map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setInput(item)}
                            className="group w-full rounded-[22px] border border-white/10 bg-black/20 px-4 py-4 text-left transition-all duration-200 hover:border-sky-300/18 hover:bg-white/[0.05]"
                          >
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70">
                                <MessageSquareText className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-3 text-sm leading-6 text-white/82">{item}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageAvatar({ children, variant }: { children: ReactNode; variant: 'user' | 'model' }) {
  return (
    <div
      className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
        variant === 'model' ? 'bg-primary/12 text-primary' : 'bg-white/10 text-white'
      }`}
    >
      {children}
    </div>
  );
}
