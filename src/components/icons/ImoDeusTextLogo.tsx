'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

const IMO_DEUS_LOGO_SRC = '/imodeus-logo.png';

export function ImoDeusTextLogo({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div
      className={cn('relative block w-[11.5rem] shrink-0 aspect-[1910/823]', className)}
      {...props}
    >
      <Image
        src={IMO_DEUS_LOGO_SRC}
        alt="ImoDeus.ai CRM"
        fill
        priority
        sizes="(max-width: 640px) 160px, 240px"
        className="object-contain object-left"
      />
    </div>
  );
}
