import { DemoWorkspaceShell } from "@/components/demo/DemoWorkspaceShell";

export default function DemoWorkspaceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <DemoWorkspaceShell
      title="Workspace demo pentru explorare interactiva"
      description="Acest spatiu reproduce structura de lucru a unei agentii in ImoDeus.ai CRM, dar toate modificarile raman exclusiv in sesiunea locala curenta."
    >
      {children}
    </DemoWorkspaceShell>
  );
}
