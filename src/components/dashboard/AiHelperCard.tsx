'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useUser } from '@/firebase';
import { Bot, Sparkles, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, FormEvent } from 'react';

export function AiHelperCard() {
    const { user } = useUser();
    const router = useRouter();
    const [prompt, setPrompt] = useState('');
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Utilizator';

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            router.push(`/ai-assistant?prompt=${encodeURIComponent(prompt)}`);
        }
    };

    return (
        <Card className="bg-muted/50">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Salut, {displayName}! Cum te pot ajuta?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card" asChild>
                        <Link href="/ai-assistant">
                            <Wand2 className="h-5 w-5 mb-1 text-primary" />
                            <span className="text-xs">Asistență Text</span>
                        </Link>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card" asChild>
                         <Link href="/ai-assistant">
                            <Sparkles className="h-5 w-5 mb-1 text-primary" />
                            <span className="text-xs">Automatizare Proces</span>
                        </Link>
                    </Button>
                </div>
                <form onSubmit={handleSubmit} className="relative">
                    <Input 
                        placeholder="Întreabă ceva..." 
                        className="pr-10 bg-card"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                    />
                    <Button type="submit" size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                        <Bot className="h-4 w-4" />
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
