"use client";
import Link from "next/link";
import { CalendarDays, ChevronRight, History, Users } from "lucide-react";
export type VoiceActivity = { id: string; title: string; at: string };
type ContextRow = Record<string, unknown>;
export type VoiceContextData = {
  contacts: ContextRow[];
  viewings: ContextRow[];
  loading: boolean;
  error: string;
};
function time(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("ro-RO", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Bucharest",
      }).format(date)
    : "";
}
export function VoiceContext({
  data,
  activities,
  close,
}: {
  data: VoiceContextData;
  activities: VoiceActivity[];
  close: () => void;
}) {
  return (
    <div className="jarvis-context-sections">
      {data.loading && (
        <p className="jarvis-context-note" role="status">
          Încarc contextul din CRM…
        </p>
      )}
      {data.error && (
        <p className="jarvis-context-note" role="status">
          {data.error}
        </p>
      )}
      <section>
        <div className="jarvis-context-title">
          <h3>
            <Users /> Clienți din CRM
          </h3>
          <Link prefetch={false} href="/leads" onClick={close}>
            Vezi toți
          </Link>
        </div>
        {data.contacts.map((row) => (
          <Link
            prefetch={false}
            key={String(row.id)}
            className="jarvis-context-row"
            href={`/leads/${encodeURIComponent(String(row.id))}`}
            onClick={close}
          >
            <span className="jarvis-context-avatar">
              {String(row.name || "Client")
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join("")}
            </span>
            <span>
              <strong>{String(row.name || "Client")}</strong>
              <small>
                {String(row.contactType || row.status || "Contact în CRM")}
              </small>
            </span>
            <ChevronRight />
          </Link>
        ))}
        {!data.loading && !data.error && !data.contacts.length && (
          <p className="jarvis-context-note">
            Nu sunt clienți disponibili în acest context.
          </p>
        )}
      </section>
      <section>
        <div className="jarvis-context-title">
          <h3>
            <CalendarDays /> Agenda de azi
          </h3>
          <Link prefetch={false} href="/viewings" onClick={close}>
            Vezi toate
          </Link>
        </div>
        {data.viewings.map((row) => (
          <Link
            prefetch={false}
            key={String(row.id)}
            className="jarvis-context-row"
            href="/viewings"
            onClick={close}
          >
            <span className="jarvis-context-icon">
              <CalendarDays />
            </span>
            <span>
              <strong>
                {String(row.propertyTitle || row.contactName || "Vizionare")}
              </strong>
              <small>
                {[time(row.viewingDate), row.contactName || row.location]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
            <ChevronRight />
          </Link>
        ))}
        {!data.loading && !data.error && !data.viewings.length && (
          <p className="jarvis-context-note">
            Nu sunt vizionări disponibile pentru azi.
          </p>
        )}
      </section>
      <section>
        <div className="jarvis-context-title">
          <h3>
            <History /> Activitate Jarvis
          </h3>
        </div>
        {activities.map((activity) => (
          <div key={activity.id} className="jarvis-context-row">
            <span className="jarvis-context-icon">
              <History />
            </span>
            <span>
              <strong>{activity.title}</strong>
              <small>{time(activity.at)}</small>
            </span>
          </div>
        ))}
        {!activities.length && (
          <p className="jarvis-context-note">
            Rezultatele comenzilor tale vor apărea aici.
          </p>
        )}
      </section>
    </div>
  );
}
