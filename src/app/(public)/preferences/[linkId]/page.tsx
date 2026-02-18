'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Bot, Menu, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { preferencesChat } from '@/ai/flows/preferences-chat';
import type { Message } from 'genkit';
import Markdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

const AiBubble = ({ children }: { children: React.ReactNode }) => (
  <div className="self-start max-w-[85%] bg-[#251A46] p-4 rounded-2xl rounded-bl-sm shadow-lg">
    <div className="prose prose-sm prose-invert text-white">
        <Markdown>{`${children}`}</Markdown>
    </div>
  </div>
);

const UserBubble = ({ children }: { children: React.ReactNode }) => (
  <div className="self-end max-w-[85%] bg-gradient-to-r from-[#6382FF] to-[#9166FF] p-4 rounded-2xl rounded-br-sm shadow-[0_0_20px_rgba(122,102,255,0.5)]">
    <p>{children}</p>
  </div>
);

export default function PreferencesChatPage() {
  const params = useParams();
  const linkId = params.linkId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const hasStarted = useRef(false);

  // Initial greeting from the AI
  useEffect(() => {
    if (hasStarted.current || !linkId) return;
    hasStarted.current = true;
    
    const startConversation = async () => {
        setIsLoading(true);
        try {
            const result = await preferencesChat({
                history: [],
                prompt: "Salut! Mă poți ajuta, te rog?", // A friendly starting prompt
                linkId,
            });
            setMessages([{ role: 'model', content: result.response }]);
        } catch (error) {
            console.error("Error starting conversation:", error);
            setMessages([{ role: 'model', content: "Oops! Se pare că am o problemă tehnică. Te rog, revino puțin mai târziu." }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    startConversation();
  }, [linkId]);

  useEffect(() => {
    chatContainerRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const historyForAi: Message[] = messages.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }]
    }));

    try {
        const result = await preferencesChat({
            history: historyForAi,
            prompt: userMessage.content,
            linkId: linkId,
        });

        const aiMessage: ChatMessage = { role: 'model', content: result.response };
        setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
        console.error("Chat error:", error);
        const errorMessage: ChatMessage = { role: 'model', content: "Îmi pare rău, am întâmpinat o eroare. Putem încerca din nou?" };
        setMessages(prev => [...prev, errorMessage]);
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="flex flex-col h-screen max-w-md mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between p-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12">
             <div className="absolute inset-0 bg-gradient-to-br from-[#6382FF] to-[#9166FF] rounded-full blur-sm"></div>
             <div className="relative flex items-center justify-center h-12 w-12 bg-slate-900 rounded-full border-2 border-[#372d64]">
                 <Bot className="h-7 w-7 text-blue-300" />
             </div>
          </div>
          <div>
            <h1 className="font-bold text-lg">Asistent Preferințe</h1>
            <p className="text-sm text-white/70">Agentul tău virtual</p>
          </div>
        </div>
        <button aria-label="Meniu">
          <Menu className="h-6 w-6 text-white/80" />
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-8 flex flex-col">
        {messages.map((msg, index) => (
          <div key={index} className="flex flex-col">
            {msg.role === 'model' ? <AiBubble>{msg.content}</AiBubble> : <UserBubble>{msg.content}</UserBubble>}
          </div>
        ))}
        {isLoading && (
            <div className="self-start flex items-center gap-2 bg-[#251A46] p-4 rounded-2xl rounded-bl-sm shadow-lg">
                <span className="h-2 w-2 bg-blue-300 rounded-full animate-bounce" style={{animationDelay: '0s'}}></span>
                <span className="h-2 w-2 bg-blue-300 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                <span className="h-2 w-2 bg-blue-300 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
            </div>
        )}
        <div ref={chatContainerRef} />
      </main>

      {/* Input Footer */}
      <footer className="p-4 flex-shrink-0">
        <div className="relative flex items-center">
          <Input
            placeholder="Scrie mesajul tău..."
            className="w-full h-14 pl-6 pr-16 rounded-full bg-[#251A46]/80 border-none placeholder:text-white/50 text-white focus:ring-2 focus:ring-blue-500/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
           <Button size="icon" className="absolute right-2 h-11 w-11 rounded-full bg-gradient-to-br from-[#6382FF] to-[#9166FF] shadow-[0_0_15px_rgba(122,102,255,0.4)]" onClick={handleSend} disabled={isLoading}>
             {isLoading ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
           </Button>
        </div>
      </footer>
    </div>
  );
}
