
'use client';
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Send, Bot, User } from "lucide-react";
import { useEffect, useState, useRef, useMemo } from "react";
import { chat } from "@/ai/flows/chat";
import { useToast } from "@/hooks/use-toast";
import type { Contact, Property, Agency, UserProfile, Viewing } from '@/lib/types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Skeleton } from "../ui/skeleton";

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

type AssistantHistoryMessage = {
    role: 'user' | 'model';
    content: Array<{ text: string }>;
};

interface AiChatProps {
    suggestedPrompts: string[];
    promptsLoading: boolean;
    initialPrompt?: string;
    contacts: Contact[];
    properties: Property[];
    viewings: Viewing[];
    agency?: Agency;
    user?: UserProfile;
}

export function AiChat({ suggestedPrompts, promptsLoading, initialPrompt, contacts, properties, viewings, agency, user }: AiChatProps) {
    const { toast } = useToast();
    const [briefing, setBriefing] = useState<string | null>(null);
    const [briefingLoading, setBriefingLoading] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const processedInitialPrompt = useRef(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    
    const handleSend = async (promptOverride?: string) => {
        const promptToSend = promptOverride || input;
        if (!promptToSend.trim()) return;

        const userMessage: ChatMessage = { role: 'user', text: promptToSend };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setChatLoading(true);

        try {
            // History for chat should include the briefing context maybe? For now, let's keep it simple.
            const history: AssistantHistoryMessage[] = [...messages, userMessage].slice(0, -1).map(msg => ({
                role: msg.role,
                content: [{ text: msg.text }]
            }));

            const result = await chat({
                history: history,
                prompt: promptToSend,
                contacts,
                properties,
                viewings,
                agency,
                user,
            });

            const aiMessage: ChatMessage = { role: 'model', text: result.response };
            setMessages(prev => [...prev, aiMessage]);

        } catch (error) {
            console.error("AI chat failed", error);
            toast({
                variant: "destructive",
                title: "A apărut o eroare",
                description: "Nu am putut comunica cu asistentul AI. Încearcă din nou.",
            });
            setMessages(prev => prev.filter(m => m !== userMessage));

        } finally {
            setChatLoading(false);
        }
    };
    
    // Effect for initial briefing
    useEffect(() => {
        if (promptsLoading || processedInitialPrompt.current) {
            return;
        }

        const getInitialBriefing = async () => {
            setBriefingLoading(true);
            try {
                const result = await chat({
                    history: [],
                    prompt: 'Generează briefing-ul pentru astăzi, folosind formatul Markdown specificat în instrucțiunile de sistem.',
                    contacts,
                    properties,
                    viewings,
                    agency,
                    user,
                });
                setBriefing(result.response);
            } catch (error) {
                 console.error("AI initial briefing failed", error);
                 toast({
                    variant: "destructive",
                    title: "A apărut o eroare",
                    description: "Nu am putut încărca sumarul zilnic. Reîmprospătează pagina sau încearcă să trimiți un mesaj.",
                 });
                 setBriefing('### Eroare la încărcare\nNu am putut genera briefing-ul. Te rog să reîncarci pagina.');
            } finally {
                setBriefingLoading(false);
            }
        };

        if (initialPrompt) {
            handleSend(initialPrompt);
            setBriefingLoading(false); // don't load briefing if there is an initial prompt
        } else {
            getInitialBriefing();
        }
        
        processedInitialPrompt.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [promptsLoading]);

    // Effect for scrolling chat
    useEffect(() => {
        chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

  return (
    <div className="flex flex-col h-full">
        <CardHeader>
            <CardTitle>Asistent AI</CardTitle>
            <CardDescription>Asistentul tău personal inteligent, conștient de datele tale din CRM.</CardDescription>
        </CardHeader>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {briefingLoading && (
                <div className="prose prose-sm max-w-full lg:prose-base dark:prose-invert space-y-4">
                    <Skeleton className="h-8 w-1/2" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            )}
            {briefing && !briefingLoading && (
                 <div className="prose prose-sm max-w-full lg:prose-base dark:prose-invert rounded-lg border bg-muted/50 p-6 shadow-inner">
                    <Markdown remarkPlugins={[remarkGfm]}>{briefing}</Markdown>
                </div>
            )}
            
            <div className="space-y-6">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex items-start gap-4 ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                        {msg.role === 'model' && <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>}
                        <div className={`prose prose-sm max-w-2xl rounded-lg p-4 shadow-sm lg:prose-base dark:prose-invert ${msg.role === 'model' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                            <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                        </div>
                        {msg.role === 'user' && <div className="p-2 rounded-full bg-secondary"><User className="h-5 w-5" /></div>}
                    </div>
                ))}
                {chatLoading && (
                    <div className="flex items-start gap-4 justify-start">
                        <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
                        <div className="p-4 rounded-lg max-w-2xl shadow-sm bg-muted">
                            <div className="flex items-center gap-2">
                               <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                               <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                               <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                            </div>
                        </div>
                    </div>
                )}
                 <div ref={chatContainerRef} />
            </div>
        </div>
        
        <div className="p-4 bg-background border-t">
             <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                 {promptsLoading ? (
                    [...Array(3)].map((_, i) => <Skeleton key={i} className="h-9 w-64 rounded-md" />)
                 ) : (
                    suggestedPrompts.map(prompt => (
                        <Button key={prompt} variant="outline" size="sm" onClick={() => setInput(prompt)} className="flex-shrink-0">{prompt}</Button>
                    ))
                 )}
             </div>
            <div className="relative">
                <Input
                    placeholder="Scrie un mesaj către asistentul AI..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleSend()}
                    disabled={chatLoading}
                    className="pr-12 h-12"
                />
                <Button onClick={() => handleSend()} size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" disabled={chatLoading}>
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );
}
