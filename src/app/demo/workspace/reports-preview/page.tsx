'use client';

import { useDemoSession } from "@/components/demo/DemoSessionProvider";
import { formatDemoCurrency } from "@/components/demo/demo-utils";

export default function DemoReportsPreviewPage() {
  const { state } = useDemoSession();

  if (!state) return null;

  const soldVolume = state.properties
    .filter((item) => item.status === "VÃ¢ndut")
    .reduce((sum, item) => sum + item.price, 0);
  const activeLeads = state.contacts.filter((item) => !["CÃ¢È™tigat", "Pierdut"].includes(item.status)).length;
  const upcomingViewings = state.viewings.filter((item) => item.status === "scheduled").length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { label: "Volum vandut demo", value: formatDemoCurrency(soldVolume) },
        { label: "Lead-uri active", value: String(activeLeads) },
        { label: "Vizionari viitoare", value: String(upcomingViewings) },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-[26px] border border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] p-5 shadow-[var(--agentfinder-card-shadow)]"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{item.value}</p>
          <p className="mt-2 text-sm text-slate-600">Preview demo pentru fazele urmatoare de raportare extinsa.</p>
        </div>
      ))}
    </div>
  );
}
