'use client';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calculator, Loader2 } from 'lucide-react';
import type { Property } from '@/lib/types';

export function AiPriceEvaluationDialog({ property }: { property: Property }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [evaluation, setEvaluation] = useState<string | null>(null);

    const handleGenerate = () => {
        setIsGenerating(true);
        setTimeout(() => {
            const estimatedPrice = property.price * (Math.random() * 0.2 + 0.9); // +/- 10%
            setEvaluation(`Evaluarea estimată de AI este de aproximativ €${Math.round(estimatedPrice / 1000) * 1000}. Aceasta este o estimare și poate varia.`);
            setIsGenerating(false);
        }, 2000);
    };

    useEffect(() => {
        if (isOpen && !evaluation && !isGenerating) {
            handleGenerate();
        }
    }, [isOpen, evaluation, isGenerating]);


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline" className="w-full justify-between lg:bg-white/10 lg:border-white/20 lg:text-white lg:hover:bg-white/20">
                    <span>Evaluare Preț AI</span>
                    <Calculator className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#0F1E33] text-white border-white/20">
                <DialogHeader>
                    <DialogTitle>Evaluare Preț AI</DialogTitle>
                    <DialogDescription className="text-white/70">
                        AI-ul nostru analizează datele proprietății pentru a oferi o estimare de preț.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-8 text-center">
                    {isGenerating && <Loader2 className="mx-auto h-8 w-8 animate-spin" />}
                    {evaluation && !isGenerating && (
                        <p className="text-lg font-semibold">{evaluation}</p>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
