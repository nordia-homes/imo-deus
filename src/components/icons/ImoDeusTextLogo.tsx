'use client';
import { cn } from '@/lib/utils';
import type { SVGProps } from "react";

export function ImoDeusTextLogo({ className, ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      viewBox="0 0 1100 300"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-auto", className)}
      {...props}
    >
      <defs>
        <linearGradient id="gradMain" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3A1C71" />
          <stop offset="50%" stopColor="#5F2C82" />
          <stop offset="100%" stopColor="#B24592" />
        </linearGradient>
      </defs>

      <g fontFamily="Poppins, Montserrat, sans-serif" fontWeight="600" fontSize="160" fill="url(#gradMain)">
        <text x="0" y="190">im</text>
      </g>

      <g transform="translate(230, 60)">
        <circle cx="80" cy="80" r="80" fill="#3A1C71" />
        <polygon points="30,90 80,50 130,90" fill="white" />
        <rect x="55" y="90" width="50" height="50" fill="white" />
        <circle cx="85" cy="115" r="8" fill="#3A1C71" />
        <rect x="83" y="120" width="4" height="25" fill="#3A1C71" />
        <rect x="83" y="145" width="12" height="4" fill="#3A1C71" />
      </g>

      <g fontFamily="Poppins, Montserrat, sans-serif" fontWeight="600" fontSize="160" fill="url(#gradMain)">
        <text x="400" y="190">deus</text>
      </g>
    </svg>
  );
};
