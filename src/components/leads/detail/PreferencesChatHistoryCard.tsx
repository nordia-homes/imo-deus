'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Contact } from '@/lib/types';
import { Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';

interface PreferencesChatHistoryCardProps {
    history: Contact['preferencesChatHistory'] | undefined;
}

export function PreferencesChatHistoryCard({ history }: PreferencesChatHistoryCardProps) {
    if (!history || history.length === 0) {
        return null; // Don't render the card if there's no history
    }

    return (
        <Card className="rounded-2xl shadow-2xl bg-[#152A47] border-none text-white">
            <CardHeader className="p-4 pb-2 lg:p-6 lg:pb-4">
                <CardTitle className="text-base text-white">Istoric Conversație Preferințe</CardTitle>
                <CardDescription className="text-white/70">Conversația purtată de client cu asistentul AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 p-4 pt-0 lg:p-6 lg:pt-0 max-h-96 overflow-y-auto">
                {history.map((msg, index) => (
                    <div key={index} className={`flex items-start gap-3 ${msg.role === 'model' ? 'justify-start' : 'justify-end'}`}>
                        {msg.role === 'model' && <div className="p-2 rounded-full bg-primary/10 text-primary mt-1"><Bot className="h-5 w-5" /></div>}
                        <div className={`prose prose-sm max-w-full rounded-lg p-3 shadow-sm lg:prose-base dark:prose-invert ${msg.role === 'model' ? 'bg-white/10 text-white' : 'bg-primary text-primary-foreground'}`}>
                            <Markdown>{msg.content}</Markdown>
                        </div>
                        {msg.role === 'user' && <div className="p-2 rounded-full bg-secondary text-secondary-foreground mt-1"><User className="h-5 w-5" /></div>}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
