'use client';
import { PublicFooter } from "@/components/public/PublicFooter";
import { PublicHeader } from "@/components/public/PublicHeader";
import { usePublicAgency } from "@/context/PublicAgencyContext";

// A simple layout for the public portal to ensure it does not use the dashboard shell
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { agency, isAgencyLoading } = usePublicAgency();

  return (
    <>
        <PublicHeader agency={agency} isLoading={isAgencyLoading} />
        <main className="min-h-screen bg-background">{children}</main>
        <PublicFooter agency={agency} isLoading={isAgencyLoading} />
    </>
  );
}
