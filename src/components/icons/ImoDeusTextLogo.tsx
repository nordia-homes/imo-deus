'use client';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { HTMLAttributes } from 'react';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("relative aspect-[550/100]", className)} {...props}>
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/studio-652232171-42fb6.firebasestorage.app/o/logoImoDeus-ai.jpeg?alt=media&token=85f8a2c1-c641-45fd-9bee-96cb9a01e89f"
        alt="ImoDeus.ai Logo"
        fill
        sizes="224px" 
        style={{ objectFit: 'contain' }}
        priority
      />
    </div>
  );
};
