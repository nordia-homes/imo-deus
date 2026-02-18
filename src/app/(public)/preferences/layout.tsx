
import { ReactNode } from 'react';

export default function PreferencesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    // Set a background color that matches the app-like feel from the image
    <div className="bg-[#F4F2FB]">
      <main className="font-sans">
        {children}
      </main>
    </div>
  );
}
