'use client';
import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { Interaction } from '@/lib/types';

interface AddInteractionPopoverProps {
    children: React.ReactNode;
    type: Interaction['type'];
    onSave: (notes: string) => Promise<void>;
}

export function AddInteractionPopover({ children, type, onSave }: AddInteractionPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!notes.trim()) return;
        setIsSaving(true);
        await onSave(notes);
        setIsSaving(false);
        setNotes('');
        setIsOpen(false);
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent className="w-80">
                <div className="grid gap-4">
                    <div className="space-y-2">
                        <h4 className="font-medium leading-none">Adaugă notiță pentru: {type}</h4>
                        <p className="text-sm text-muted-foreground">Scrie un rezumat al interacțiunii.</p>
                    </div>
                    <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Clientul a confirmat vizionarea..."
                    />
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvează Notița
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
