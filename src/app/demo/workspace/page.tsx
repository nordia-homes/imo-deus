'use client';

import { useDemoSession } from "@/components/demo/DemoSessionProvider";
import { formatDemoCurrency } from "@/components/demo/demo-utils";

export default function DemoWorkspacePage() {
  const { state, isLoading } = useDemoSession();

  if (isLoading || !state) {
    return null;
  }

  const activeProperties = state.properties.filter((item) => item.status === "Activ").length;
  const scheduledViewings = state.viewings.filter((item) => item.status === "scheduled").length;
  const openTasks = state.tasks.filter((item) => item.status === "open").length;
  const activeLeads = state.contacts.filter((item) => !["CÃ¢È™tigat", "Pierdut"].includes(item.status)).length;
  const activeInventoryValue = state.properties
    .filter((item) => item.status === "Activ")
    .reduce((sum, item) => sum + item.price, 0);

  const topViewings = [...state.viewings]
    .sort((left, right) => new Date(left.viewingDate).getTime() - new Date(right.viewingDate).getTime())
    .slice(0, 3);

  const topLeads = [...state.contacts]
    .sort((left, right) => (right.leadScore || 0) - (left.leadScore || 0))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-[var(--app-surface-border)] bg-white/76 p-5 shadow-[0_22px_64px_rgba(37,55,88,0.08)] backdrop-blur-xl lg:p-6">
        <h2 className="font-headline text-3xl font-bold tracking-[-0.04em] text-slate-950">
          Bun venit in workspace-ul demo al agentiei {state.agency.name}
        </h2>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
          Acesta este primul milestone de implementare: un runtime separat de productie, cu date mock coerente si stare izolata per sesiune.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Lead-uri active", value: activeLeads, helper: "pipeline in lucru" },
              { label: "Proprietati active", value: activeProperties, helper: "inventar disponibil" },
              { label: "Vizionari programate", value: scheduledViewings, helper: "urmatoarele intalniri" },
              { label: "Valoare inventar activ", value: formatDemoCurrency(activeInventoryValue), helper: "suma listata" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-[26px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-5 shadow-[var(--agentfinder-card-shadow)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                <p className="mt-2 text-sm text-slate-600">{card.helper}</p>
              </div>
            ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-white/76 p-5 shadow-[var(--agentfinder-card-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Prioritati comerciale</p>
          <div className="mt-4 space-y-3">
            {topLeads.map((lead) => (
              <div
                key={lead.id}
                className="rounded-[20px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-soft)] px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{lead.name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {lead.status} · {lead.zones?.join(", ") || "zone de clarificat"}
                    </p>
                  </div>
                  <div className="rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-[var(--primary)] shadow-[var(--agentfinder-soft-shadow)]">
                    Scor {lead.leadScore || 0}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--app-surface-border)] bg-white/76 p-5 shadow-[var(--agentfinder-card-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Vizionari si task-uri</p>
          <div className="mt-4 space-y-3">
            {topViewings.map((viewing) => (
              <div
                key={viewing.id}
                className="rounded-[20px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-blue)] px-4 py-3"
              >
                <p className="text-sm font-semibold text-slate-900">{viewing.propertyTitle}</p>
                <p className="mt-1 text-sm text-slate-600">{viewing.contactName}</p>
                <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                  {new Date(viewing.viewingDate).toLocaleString("ro-RO")}
                </p>
              </div>
            ))}

            <div className="rounded-[20px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg-green)] px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Task-uri deschise</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{openTasks}</p>
              <p className="mt-2 text-sm text-slate-600">
                Foloseste navigatia demo pentru a deschide paginile dedicate si a edita local lead-uri, proprietati, vizionari si task-uri.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
