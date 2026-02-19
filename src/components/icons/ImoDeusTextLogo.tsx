'use client';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ImoDeusTextLogo({ className, size = 'text-3xl' }: { className?: string; size?: string }) {
  return (
    <div className={cn("flex items-center font-bold tracking-tighter", size, className)}>
      <span className="text-foreground">Im</span>
      <Home className="mx-px h-[0.8em] w-[0.8em] text-primary" strokeWidth={2.5} />
      <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">Deus</span>
      <span className="text-foreground">.ai</span>
    </div>
  );
};
