
'use client';
import { Button } from "../ui/button";
import { CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Send, Bot, User } from "lucide-react";
import { useState } from "react";
import { chat } from "@/ai/flows/chat";
import type { Message } from "genkit";
import { useToast } from "@/hooks/use-toast";

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

export function AiChat() {
    const { toast } = useToast();
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'model', text: 'Bună! Sunt asistentul tău AI. Cum te pot ajuta astăzi cu activitățile tale imobiliare?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
            // Convert our chat format to Genkit's Message format
            const history: Message[] = newMessages.slice(0, -1).map(msg => ({
                role: msg.role,
                content: [{ text: msg.text }]
            }));

            const result = await chat({
                history: history,
                prompt: input,
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
             // Remove the user message that failed to get a response, so they can try again.
            setMessages(prev => prev.filter(m => m !== userMessage));

        } finally {
            setLoading(false);
        }
    };

    const suggestedPrompts = [
        "Generează o descriere pentru un apartament cu 3 camere în Brașov.",
        "Care este prețul mediu pe metru pătrat în Cluj-Napoca, zona centrală?",
        "Creează un email de follow-up pentru un client care a vizionat o proprietate ieri."
    ];

  return (
    <div className="flex-1 flex flex-col mt-6 h-full">
        <CardContent className="flex-1 overflow-y-auto space-y-6 p-6">
            {messages.map((msg, i) => (
                <div key={i} className={`flex items-start gap-4 ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                    {msg.role === 'model' && <div className="p-2 rounded-full bg-primary/10 text-primary"><Bot className="h-5 w-5" /></div>}
                     <div className={`p-4 rounded-lg max-w-2xl shadow-sm ${msg.role === 'model' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                     {msg.role === 'user' && <div className="p-2 rounded-full bg-secondary"><User className="h-5 w-5" /></div>}
                </div>
            ))}
            {loading && (
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
                 {suggestedPrompts.map(prompt => (
                     <Button key={prompt} variant="outline" size="sm" onClick={() => setInput(prompt)} className="flex-shrink-0">{prompt}</Button>
                 ))}
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
                <Button onClick={handleSend} size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" disabled={loading}>
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );
}
