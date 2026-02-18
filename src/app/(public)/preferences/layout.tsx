
import { ReactNode } from 'react';

export default function PreferencesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-gradient-to-b from-[#181134] to-[#0A0612] text-white">
      <main className="font-sans">
        {children}
      </main>
    </div>
  );
}
