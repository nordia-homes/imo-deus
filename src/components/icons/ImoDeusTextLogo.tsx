'use client';
import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function ImoDeusTextLogo({ className, ...props }: HTMLAttributes<HTMLDivElement> & { className?: string }) {
  return (
    <div className={cn("relative w-44", className)} {...props}>
      <svg viewBox="0 0 540 140" xmlns="http://www.w3.org/2000/svg"
          style={{width:'100%', display:'block'}}>

        <defs>
          <linearGradient id="gradLogo" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#5B5FFF"/>
            <stop offset="100%" stop-color="#C850C0"/>
          </linearGradient>
        </defs>

        {/* im */}
        <text x="0" y="90"
              font-family="Poppins, Montserrat, sans-serif"
              font-weight="600"
              font-size="70"
              fill="url(#gradLogo)">
          im
        </text>

        {/* O cu casă */}
        <g transform="translate(110,25)">
          <circle cx="40" cy="40" r="40" fill="#2C1E63"/>

          <polygon points="15,45 40,25 65,45" fill="white"/>
          <rect x="27" y="45" width="26" height="25" fill="white"/>

          <circle cx="40" cy="55" r="4" fill="#2C1E63"/>
          <rect x="38" y="58" width="4" height="12" fill="#2C1E63"/>
        </g>

        {/* deus */}
        <text x="195" y="90"
              font-family="Poppins, Montserrat, sans-serif"
              font-weight="600"
              font-size="70"
              fill="url(#gradLogo)">
          deus
        </text>

        {/* .ai */}
        <text x="400" y="90"
              font-family="Poppins, Montserrat, sans-serif"
              font-weight="500"
              font-size="55"
              fill="#9F8CFF"
              opacity="0.85">
          .ai
        </text>

      </svg>
    </div>
  );
};
