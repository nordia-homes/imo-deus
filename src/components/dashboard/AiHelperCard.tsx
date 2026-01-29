import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Bot, Sparkles, Wand2 } from 'lucide-react';

export function AiHelperCard() {
    return (
        <Card className="bg-muted/50">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Salut, Adam! Cum te pot ajuta?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-center">
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card">
                        <Wand2 className="h-5 w-5 mb-1 text-primary" />
                        <span className="text-xs">Asistență Text</span>
                    </Button>
                    <Button variant="outline" className="h-auto flex-col py-2 bg-card">
                        <Sparkles className="h-5 w-5 mb-1 text-primary" />
                         <span className="text-xs">Automatizare Proces</span>
                    </Button>
                </div>
                <div className="relative">
                    <Input placeholder="Întreabă ceva..." className="pr-10 bg-card"/>
                    <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8">
                        <Bot className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
