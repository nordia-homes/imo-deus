
'use client';
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Send, Bot, User } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { chat } from "@/ai/flows/chat";
import type { Message } from "genkit";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "../ui/skeleton";
import type { Contact, Property, Agency, UserProfile } from '@/lib/types';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

interface AiChatProps {
    suggestedPrompts: string[];
    promptsLoading: boolean;
    initialPrompt?: string;
    contacts: Contact[];
    properties: Property[];
    agency?: Agency;
    user?: UserProfile;
}

export function AiChat({ suggestedPrompts, promptsLoading, initialPrompt, contacts, properties, agency, user }: AiChatProps) {
    const { toast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const processedInitialPrompt = useRef(false);

    const handleSend = async (promptOverride?: string) => {
        const promptToSend = promptOverride || input;
        if (!promptToSend.trim()) return;

        const userMessage: ChatMessage = { role: 'user', text: promptToSend };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const history: Message[] = [...messages, userMessage].slice(0, -1).map(msg => ({
                role: msg.role,
                content: [{ text: msg.text }]
            }));

            const result = await chat({
                history: history,
                prompt: promptToSend,
                contacts,
                properties,
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
            setLoading(false);
        }
    };
    
    useEffect(() => {
        if (promptsLoading || processedInitialPrompt.current) {
            return;
        }

        const getInitialBriefing = async () => {
            try {
                const result = await chat({
                    history: [],
                    prompt: 'Acționează conform instrucțiunilor de sistem. Oferă-mi rezumatul zilnic și prioritățile pentru astăzi.',
                    contacts,
                    properties,
                    agency,
                    user,
                });
                const aiMessage: ChatMessage = { role: 'model', text: result.response };
                setMessages([aiMessage]);
            } catch (error) {
                 console.error("AI initial briefing failed", error);
                 toast({
                    variant: "destructive",
                    title: "A apărut o eroare",
                    description: "Nu am putut genera sumarul zilnic. Încearcă să trimiți un mesaj.",
                 });
                 setMessages([{ role: 'model', text: 'Bună! Nu am putut încărca sumarul zilnic. Cum te pot ajuta?' }]);
            } finally {
                setLoading(false);
            }
        };

        if (initialPrompt) {
            handleSend(initialPrompt);
        } else {
            getInitialBriefing();
        }
        
        processedInitialPrompt.current = true;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [promptsLoading]);


  return (
    <div className="flex-1 flex flex-col mt-6 h-full">
        <CardContent className="flex-1 overflow-y-auto space-y-6 p-6">
            {messages.length === 0 && loading && (
                 <div className="flex items-start gap-4 justify-start">
                    <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
                     <div className="p-4 rounded-lg max-w-2xl shadow-sm bg-muted">
                        <div className="flex items-center gap-2">
                           <span className="h-2 w-2 bg-primary rounded-full animate-bounce " style={{animationDelay: '0s'}}></span>
                           <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                           <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                        </div>
                    </div>
                </div>
            )}
            {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-4 ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                    {msg.role === 'model' && <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>}
                     <div className={`prose prose-sm max-w-2xl rounded-lg p-4 shadow-sm lg:prose-base dark:prose-invert ${msg.role === 'model' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                        <Markdown remarkPlugins={[remarkGfm]}>{msg.text}</Markdown>
                    </div>
                     {msg.role === 'user' && <div className="p-2 rounded-full bg-secondary"><User className="h-5 w-5" /></div>}
                </div>
            ))}
            {messages.length > 0 && loading && (
                 <div className="flex items-start gap-4 justify-start">
                    <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>
                     <div className="p-4 rounded-lg max-w-2xl shadow-sm bg-muted">
                        <div className="flex items-center gap-2">
                           <span className="h-2 w-2 bg-primary rounded-full animate-bounce " style={{animationDelay: '0s'}}></span>
                           <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                           <span className="h-2 w-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                        </div>
                    </div>
                </div>
            )}
        </CardContent>
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
                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend()}
                    disabled={loading}
                    className="pr-12 h-12"
                />
                <Button onClick={() => handleSend()} size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" disabled={loading}>
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );
}
