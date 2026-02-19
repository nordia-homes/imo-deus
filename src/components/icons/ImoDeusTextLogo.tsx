'use client';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { HTMLAttributes } from 'react';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("relative aspect-[260/96]", className)} {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/logo%202%20imodeus.png?alt=media&token=611bf50e-49bb-47a5-837e-a943014fc060"
        alt="ImoDeus.ai Logo"
        fill
        style={{ objectFit: 'contain' }}
        priority
      />
    </div>
  );
};
