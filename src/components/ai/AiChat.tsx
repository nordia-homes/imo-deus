
'use client';
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Send } from "lucide-react";
import { useState } from "react";
// import { useGemini } from '@/lib/gemini'; // Placeholder hook

export function AiChat() {
    // const { generateResponse, loading } = useGemini(); // Placeholder
    const [messages, setMessages] = useState([
        { from: 'ai', text: 'Bună! Cum te pot ajuta astăzi?' }
    ]);
    const [input, setInput] = useState('');
    const loading = false; // Placeholder

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { from: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // const aiResponse = await generateResponse(input); // Placeholder
        // Simulating AI response
        setTimeout(() => {
             const aiResponse = { from: 'ai', text: `Răspuns AI pentru: "${input}"`};
             setMessages(prev => [...prev, aiResponse]);
        }, 1000);
    };

    const suggestedPrompts = [
        "Generează o descriere pentru un apartament cu 3 camere în Brașov.",
        "Care este prețul mediu pe metru pătrat în Cluj-Napoca, zona centrală?",
        "Creează un email de follow-up pentru un client care a vizionat o proprietate ieri."
    ];

  return (
    <div className="flex-1 flex flex-col mt-6">
        <CardContent className="flex-1 overflow-y-auto space-y-4">
            {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'ai' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`p-3 rounded-lg max-w-lg ${msg.from === 'ai' ? 'bg-gray-200' : 'bg-primary text-primary-foreground'}`}>
                        {msg.text}
                    </div>
                </div>
            ))}
        </CardContent>
        <div className="p-4 bg-white border-t">
             <div className="flex gap-2 mb-2">
                 {suggestedPrompts.map(prompt => (
                     <Button key={prompt} variant="outline" size="sm" onClick={() => setInput(prompt)}>{prompt}</Button>
                 ))}
             </div>
            <div className="relative">
                <Input
                    placeholder="Scrie un mesaj..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    disabled={loading}
                />
                <Button onClick={handleSend} size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" disabled={loading}>
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>
  );
}
