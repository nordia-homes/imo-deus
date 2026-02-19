'use client';
import { cn } from '@/lib/utils';
import type { SVGProps } from "react";

export function ImoDeusTextLogo({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 550 140"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto", className)}
      {...props}
    >
      <defs>
        <linearGradient id="gradLogo" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#5B5FFF"/>
          <stop offset="100%" stopColor="#C850C0"/>
        </linearGradient>
      </defs>

      <text x="40" y="90"
            fontFamily="Poppins, Montserrat, sans-serif"
            fontWeight="600"
            fontSize="70"
            fill="url(#gradLogo)">
        im
      </text>

      <g transform="translate(130, 25)">
        <circle cx="40" cy="40" r="40" fill="#2C1E63"/>

        <polygon points="15,45 40,25 65,45" fill="white"/>
        <rect x="27" y="45" width="26" height="25" fill="white"/>

        <circle cx="40" cy="55" r="4" fill="#2C1E63"/>
        <rect x="38" y="58" width="4" height="12" fill="#2C1E63"/>
      </g>

      <text x="210" y="90"
            fontFamily="Poppins, Montserrat, sans-serif"
            fontWeight="600"
            fontSize="70"
            fill="url(#gradLogo)">
        deus
      </text>

      <text x="400" y="90"
            fontFamily="Poppins, Montserrat, sans-serif"
            fontWeight="500"
            fontSize="55"
            fill="#9F8CFF"
            opacity="0.85">
        .ai
      </text>
    </svg>
  );
};
