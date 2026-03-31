'use client';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
import { LogoIcon } from '@/components/icons/LogoIcon';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-white", className)} {...props}>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04]">
        <LogoIcon className="h-6 w-6" />
      </div>
      <div className="leading-none">
        <div className="text-2xl font-semibold tracking-tight">ImoDeus</div>
        <div className="mt-1 text-xs uppercase tracking-[0.28em] text-white/55">AI CRM</div>
      </div>
    </div>
  );
};
