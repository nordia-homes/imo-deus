import type { SVGProps } from 'react';

export function WazeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M5.2 14.1c-1.4-.3-2.2-1-2.2-2.1 0-1.2.9-2 2.3-2.2C6.1 6.7 8.7 4.6 12 4.6c4 0 7.2 2.7 7.2 6.4 0 3.6-3.2 6.4-7.3 6.4H9.7l-3.4 2.1.8-3.1c-.8-.6-1.5-1.4-1.9-2.3Z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.3 10.5h.1M14.7 10.5h.1M9.4 13.3c.7.6 1.6.9 2.6.9s1.9-.3 2.6-.9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="8.1" cy="18.5" r="1.3" fill="currentColor" />
      <circle cx="15.9" cy="18.5" r="1.3" fill="currentColor" />
    </svg>
  );
}
