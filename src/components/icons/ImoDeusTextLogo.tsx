'use client';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';
import Image from 'next/image';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("relative h-auto", className)} {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/logo%20imodeus%20ai%20(1).png?alt=media&token=26038317-5735-4333-85f6-e4a8397a61f3"
        alt="ImoDeus.ai Logo"
        width={500}
        height={135}
        style={{ width: '100%', height: 'auto' }}
        priority
      />
    </div>
  );
};
