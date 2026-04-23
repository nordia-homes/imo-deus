import { DemoSessionProvider } from "@/components/demo/DemoSessionProvider";

export default function DemoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <DemoSessionProvider>{children}</DemoSessionProvider>;
}
