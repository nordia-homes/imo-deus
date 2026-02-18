
import { ReactNode } from 'react';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';

export default function PreferencesLayout({
  children,
}: {
  children: ReactNode;
}) {

  return (
    <>
      <PublicHeader agency={null} isLoading={false} />
      <main className="min-h-screen bg-background">{children}</main>
      <PublicFooter agency={null} isLoading={false} />
    </>
  );
}
