'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarCheck2,
  Home,
  RefreshCw,
  ShieldCheck,
  Users,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoSession } from "@/components/demo/DemoSessionProvider";

const NAV_ITEMS = [
  { href: "/demo/workspace", label: "Dashboard", icon: Home },
  { href: "/demo/workspace/leads", label: "Lead-uri", icon: Users },
  { href: "/demo/workspace/properties", label: "Proprietati", icon: Building2 },
  { href: "/demo/workspace/viewings", label: "Vizionari", icon: CalendarCheck2 },
  { href: "/demo/workspace/tasks", label: "Task-uri", icon: CheckSquare },
  { href: "/demo/workspace/reports-preview", label: "Rapoarte", icon: BarChart3 },
];

export function DemoWorkspaceShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { state, isLoading, resetSession } = useDemoSession();

  if (isLoading || !state) {
    return (
      <main
        data-app-theme="agentfinder"
        className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7fafe_38%,#eef4fb_100%)]"
      />
    );
  }

  return (
    <main
      data-app-theme="agentfinder"
      className="min-h-screen bg-[linear-gradient(180deg,#eef3fb_0%,#f7fafe_38%,#eef4fb_100%)] text-[var(--foreground)]"
    >
      <div className="mx-auto flex w-full max-w-[1380px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden w-[270px] shrink-0 rounded-[30px] border border-[var(--app-surface-border)] bg-white/76 p-4 shadow-[0_22px_64px_rgba(37,55,88,0.08)] backdrop-blur-xl lg:block">
          <div className="rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Agentie demo</p>
            <h1 className="mt-2 text-xl font-semibold text-slate-950">{state.agency.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{state.agency.positioning}</p>
          </div>

          <nav className="mt-4 space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-[20px] px-4 py-3 text-sm font-medium ${
                    isActive
                      ? "bg-[var(--agentfinder-primary-button)] text-white shadow-[var(--agentfinder-primary-button-shadow)]"
                      : "bg-white/70 text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-[24px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-green)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Protectie</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Workspace-ul acesta ruleaza complet separat de fluxurile reale din aplicatie.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-6">
          <div className="rounded-[30px] border border-[var(--app-surface-border)] bg-white/76 p-5 shadow-[0_22px_64px_rgba(37,55,88,0.08)] backdrop-blur-xl lg:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--app-surface-border)] bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Mod demo izolat
                </div>
                <h2 className="mt-4 font-headline text-3xl font-bold tracking-[-0.04em] text-slate-950">
                  {title}
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{description}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full border-[var(--app-surface-border)] bg-white/85 text-slate-700 hover:bg-white"
                  onClick={resetSession}
                >
                  <RefreshCw className="h-4 w-4" />
                  Reseteaza demo
                </Button>
                <Button
                  asChild
                  className="rounded-full border-0 bg-[var(--agentfinder-primary-button)] text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
                >
                  <Link href="/register">Creeaza agentia ta</Link>
                </Button>
              </div>
            </div>
          </div>

          {children}
        </section>
      </div>
    </main>
  );
}
