'use client';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { HTMLAttributes } from 'react';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("relative aspect-[752/201]", className)} {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/imodeus-logo-transparent.png?alt=media&token=placeholder"
        alt="ImoDeus.ai Logo"
        fill
        style={{ objectFit: 'contain' }}
        priority
      />
    </div>
  );
};
