'use client';

import { useState } from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { Property } from '@/lib/types';

export function usePropertyPresentation(property: Property) {
    const { user } = useUser();
    const { toast } = useToast();
    const [isGeneratingPresentation, setIsGeneratingPresentation] = useState(false);

    const handleGeneratePresentation = async () => {
        if (!user || isGeneratingPresentation) return;

        setIsGeneratingPresentation(true);

        try {
            const token = await user.getIdToken(true);
            const safeTitle = property.title
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]+/g, '-')
                .replace(/^-+|-+$/g, '')
                .slice(0, 90) || 'prezentare-proprietate';

            if (typeof window !== 'undefined' && window.imodeusDesktop?.generatePropertyPresentationPdf) {
                const url = new URL(`/api/properties/${property.id}/presentation`, window.location.origin);
                url.searchParams.set('format', 'html');
                const result = await window.imodeusDesktop.generatePropertyPresentationPdf({
                    url: url.toString(),
                    token,
                    fileName: `${safeTitle}-prezentare.pdf`,
                });

                if (!result.canceled) {
                    toast({
                        title: 'Prezentare generata',
                        description: 'PDF-ul A4 cu 3 pagini a fost salvat local.',
                    });
                }
                return;
            }

            const response = await fetch(`/api/properties/${property.id}/presentation`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload?.message || 'Nu am putut genera prezentarea PDF.');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');

            link.href = url;
            link.download = `${safeTitle}-prezentare.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);

            toast({
                title: 'Prezentare generata',
                description: 'PDF-ul A4 cu 3 pagini a fost descarcat.',
            });
        } catch (error) {
            console.error('Failed to generate property presentation:', error);
            toast({
                variant: 'destructive',
                title: 'Generarea a esuat',
                description: error instanceof Error ? error.message : 'Nu am putut genera prezentarea PDF.',
            });
        } finally {
            setIsGeneratingPresentation(false);
        }
    };

    return { isGeneratingPresentation, handleGeneratePresentation, canGeneratePresentation: Boolean(user) };
}
