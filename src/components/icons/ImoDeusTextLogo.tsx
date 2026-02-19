'use client';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
import Image from 'next/image';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("relative h-auto", className)} {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/logo%202%20imodeus%20ai.png?alt=media&token=e238b56b-1b9f-487a-bd01-7979f59ded90"
        alt="ImoDeus.ai Logo"
        width={500}
        height={135}
        style={{ width: '100%', height: 'auto' }}
        priority
      />
    </div>
  );
};
