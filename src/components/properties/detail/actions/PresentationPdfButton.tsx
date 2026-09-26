'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePropertyPresentation } from '@/hooks/use-property-presentation';
import type { Property } from '@/lib/types';

export function PresentationPdfButton({ property }: { property: Property }) {
  const { isGeneratingPresentation, handleGeneratePresentation, canGeneratePresentation } = usePropertyPresentation(property);
  return (
    <Button
      type="button"
      variant="secondary"
      className="min-w-10 flex-1 rounded-full border border-white/30 bg-white/12 text-white backdrop-blur-xl hover:bg-white/18 hover:text-white md:hidden"
      aria-label={isGeneratingPresentation ? 'Se generează prezentarea PDF' : 'Generează prezentarea PDF'}
      aria-busy={isGeneratingPresentation}
      title="Generează prezentarea PDF"
      disabled={!canGeneratePresentation || isGeneratingPresentation}
      onClick={handleGeneratePresentation}
    >
      {isGeneratingPresentation ? <Loader2 className="h-4 w-4 animate-spin" /> : 'PDF'}
    </Button>
  );
}
