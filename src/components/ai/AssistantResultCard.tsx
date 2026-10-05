"use client";
import { useState } from "react";
import Image from "next/image";
import {
  Building2,
  CalendarDays,
  Clock3,
  MapPin,
  BedDouble,
  Maximize2,
  ArrowUpRight,
  Users,
  ListChecks,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  AssistantCard,
  AssistantAction,
} from "@/lib/ai-assistant/contracts";

export function resultLink(value: unknown) {
  if (typeof value !== "string") return null;
  if (/^\/(?!\/)/.test(value)) return value;
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}
export function resultDate(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  return Number.isNaN(d.getTime())
    ? ""
    : new Intl.DateTimeFormat("ro-RO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Bucharest",
      }).format(d);
}
function price(value: unknown) {
  return typeof value === "number"
    ? new Intl.NumberFormat("ro-RO", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(value)
    : String(value || "");
}
const statusLabels: Record<string, string> = {
  scheduled: "Programată",
  completed: "Finalizată",
  cancelled: "Anulată",
  open: "De făcut",
  active: "Activ",
  pending: "În așteptare",
  ready: "Pregătit",
  success: "Confirmat",
};
type Props = {
  compact?: boolean;
  card: AssistantCard;
  busy: boolean;
  onPrompt: (text: string) => void;
  onPrepare: (actions: AssistantAction[]) => void;
  onConsent: (row: Record<string, unknown>) => void;
  onContinue: () => void;
  onCrm: () => void;
  onArtifact: (row: Record<string, unknown>) => void;
};
export function AssistantResultCard({
  compact = false,
  card,
  busy,
  onPrompt,
  onPrepare,
  onConsent,
  onContinue,
  onCrm,
  onArtifact,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const property = ["owners", "crm", "properties"].includes(card.source),
    calendar = card.source === "viewings",
    task = card.source === "tasks",
    client = card.source === "contacts";
  const Icon = property
    ? Building2
    : calendar
      ? CalendarDays
      : task
        ? ListChecks
        : client
          ? Users
          : Sparkles;
  const title =
    (
      {
        properties: "Portofoliu CRM",
        viewings: "Agenda vizionărilor",
        tasks: "Sarcini",
        contacts: "Clienți",
      } as Record<string, string>
    )[card.title] || card.title;
  const shown = expanded ? card.rows : card.rows.slice(0, 6),
    total = card.summary?.count ?? card.rows.length;
  return (
    <section
      data-compact={compact || undefined}
      data-source={card.source}
      className="my-5 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_10px_40px_-20px_rgba(15,23,42,0.3)] dark:border-slate-800 dark:bg-slate-950"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-5 py-4 dark:from-emerald-950/40 dark:via-slate-950 dark:to-sky-950/40">
        <div className="flex items-center gap-3">
          <span className="rounded-2xl bg-white p-2.5 text-emerald-600 shadow-sm dark:bg-slate-900">
            <Icon className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold tracking-tight">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {card.source === "owners"
                ? "Anunțuri proprietari · date actuale"
                : card.source === "crm"
                  ? "Portofoliul agenției"
                  : "Date CRM · acces autorizat"}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-slate-900">
          {total} {card.summary?.label || "rezultate"}
        </span>
      </header>
      {card.note && (
        <p className="border-b bg-amber-50/70 px-5 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{card.note}</p>
      )}
      {card.summary && !compact && (
        <div className="flex flex-wrap items-center gap-5 border-b bg-slate-50/60 px-6 py-5 dark:bg-slate-900/30">
          <span className="text-5xl font-semibold tracking-tighter text-slate-900 dark:text-white">
            {card.summary.count}
          </span>
          <div>
            <p className="font-medium">
              {card.summary.label}
              {card.summary.period ? " · " + card.summary.period : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.summary.scope}
            </p>
            {card.summary.count > card.rows.length && (
              <p className="mt-1 text-xs text-muted-foreground">
                Primele {card.rows.length} sunt prezentate mai jos.
              </p>
            )}
          </div>
        </div>
      )}
      {compact && card.summary?.scope && (
        <p className="jarvis-result-scope">
          {card.summary.period ? card.summary.period + " · " : ""}
          {card.summary.scope}
          {card.summary.count > card.rows.length
            ? ` · Primele ${card.rows.length} rezultate`
            : ""}
        </p>
      )}
      <div className="p-4 sm:p-5">
        {!shown.length && (
          <div className="rounded-2xl bg-slate-50 px-5 py-7 text-center dark:bg-slate-900">
            <Icon className="mx-auto mb-3 h-7 w-7 text-slate-400" />
            <p className="font-medium">
              {card.complete === false
                ? "Nicio potrivire în segmentul verificat"
                : "Nicio potrivire pentru criteriile cerute"}
            </p>
            {card.nextCursor && (
              <p className="mt-1 text-sm text-muted-foreground">
                Căutarea poate continua în următorul segment.
              </p>
            )}
          </div>
        )}
        <div className={property ? "grid gap-4 xl:grid-cols-2" : "space-y-3"}>
          {shown.map((row, index) => {
            const name = String(
              row.title ||
                row.name ||
                row.propertyTitle ||
                row.description ||
                (calendar
                  ? "Vizionare"
                  : task
                    ? "Sarcină"
                    : client
                      ? "Contact"
                      : title),
            );
            const href =
              resultLink(row.link) ||
              (["properties", "crm"].includes(card.source) && row.id
                ? `/properties/${encodeURIComponent(String(row.id))}`
                : client && row.id
                  ? `/leads/${encodeURIComponent(String(row.id))}`
                  : calendar
                    ? "/viewings"
                    : task
                      ? "/tasks"
                      : null);
            const image = resultLink(
              row.imageUrl ||
                row.image ||
                (Array.isArray(row.images)
                  ? typeof row.images[0] === "string"
                    ? row.images[0]
                    : row.images[0]?.url
                  : null),
            );
            const date = resultDate(
              row.viewingDate || row.dueDate || row.nextRunAt,
            );
            return (
              <article
                key={String(row.id || index)}
                className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white transition-shadow hover:shadow-lg hover:shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-950"
              >
                {property && (
                  <div className="relative h-36 overflow-hidden bg-gradient-to-br from-slate-100 to-emerald-50 dark:from-slate-800 dark:to-emerald-950">
                    {image ? (
                      <Image
                        unoptimized
                        fill
                        sizes="400px"
                        src={image}
                        alt={name}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <Building2 className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-emerald-200" />
                    )}
                    {row.matchScore != null && (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white">
                        {String(row.matchScore)}% potrivire
                      </span>
                    )}
                    {row.status != null && (
                      <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {statusLabels[String(row.status)] || String(row.status)}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold leading-5">
                        {name}
                      </h4>
                      {row.contactName ? (
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {String(row.contactName)}
                        </p>
                      ) : null}
                    </div>
                    {!property && row.status ? (
                      <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950">
                        {statusLabels[String(row.status)] || String(row.status)}
                      </span>
                    ) : null}
                  </div>
                  {property && row.price != null && (
                    <p className="mt-3 text-xl font-semibold tracking-tight">
                      {price(row.price)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {row.location ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {String(row.location)}
                      </span>
                    ) : null}
                    {row.rooms ? (
                      <span className="flex items-center gap-1">
                        <BedDouble className="h-3.5 w-3.5" />
                        {String(row.rooms)} camere
                      </span>
                    ) : null}
                    {row.squareFootage ? (
                      <span className="flex items-center gap-1">
                        <Maximize2 className="h-3.5 w-3.5" />
                        {String(row.squareFootage)} m²
                      </span>
                    ) : null}
                    {date ? (
                      <span className="flex items-center gap-1 font-medium text-sky-700">
                        <Clock3 className="h-3.5 w-3.5" />
                        {date}
                        {row.duration
                          ? " · " + String(row.duration) + " min"
                          : ""}
                      </span>
                    ) : null}
                    {client && row.phone ? (
                      <span>{String(row.phone)}</span>
                    ) : null}
                  </div>
                  {row.reasoning ? (
                    <p className="mt-3 rounded-xl bg-emerald-50/70 p-2.5 text-xs leading-5 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
                      {String(row.reasoning)}
                    </p>
                  ) : null}
                  {!property && !calendar && !task && !client && (
                    <div className="mt-3 space-y-2">
                      {Object.entries(row)
                        .filter(
                          ([key, value]) =>
                            typeof value === "number" &&
                            !["id", "version"].includes(key),
                        )
                        .slice(0, 6)
                        .map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm dark:bg-slate-900"
                          >
                            <span className="text-muted-foreground">
                              {(
                                {
                                  count: "Total",
                                  total: "Total",
                                  value: "Valoare",
                                  amount: "Sumă",
                                  matched: "Potriviri",
                                  sent: "Trimise",
                                  failed: "Erori",
                                } as Record<string, string>
                              )[key] || key}
                            </span>
                            <strong>{String(value)}</strong>
                          </div>
                        ))}
                      {row.description ||
                      row.subject ||
                      row.text ||
                      row.extractedText ? (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {String(
                            row.description ||
                              row.subject ||
                              row.text ||
                              row.extractedText,
                          ).slice(0, 500)}
                        </p>
                      ) : null}
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {href && (
                      <a
                        href={href}
                        target={href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        Deschide
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {card.source === "owners" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() =>
                            onPrepare([
                              {
                                kind: "existing_operation",
                                operation: "owner_prospect",
                                params: {},
                                query: {},
                                body: { listingId: row.id, action: "add" },
                              },
                            ])
                          }
                        >
                          Adaugă în prospectare
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => onConsent(row)}
                        >
                          <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                          Confirm acordul WhatsApp
                        </Button>
                      </>
                    )}
                    {["crm", "properties"].includes(card.source) &&
                      Boolean(row.id) && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              onPrompt(
                                `Programează o vizionare pentru proprietatea ${row.id}.`,
                              )
                            }
                          >
                            Programează vizionare
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              onPrepare([
                                {
                                  kind: "update_property_status",
                                  propertyId: String(row.id),
                                  status: "Rezervat",
                                  notes: "",
                                },
                              ])
                            }
                          >
                            Rezervă
                          </Button>
                        </>
                      )}
                    {client && Boolean(row.id) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          onPrompt(`Fă follow-up cu clientul ${row.id}.`)
                        }
                      >
                        Follow-up
                      </Button>
                    )}
                    {task && Boolean(row.id) && row.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          onPrepare([
                            {
                              kind: "update_task",
                              taskId: String(row.id),
                              status: "completed",
                            },
                          ])
                        }
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Finalizează
                      </Button>
                    )}
                    {row.artifactId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => onArtifact(row)}
                      >
                        Descarcă {String(row.fileName || "documentul")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {card.rows.length > 6 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? "Restrânge"
              : `Vezi toate cele ${card.rows.length} rezultate`}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {card.nextCursor && (card.search || card.query || card.timeline) && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onContinue}
            >
              Continuă căutarea
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {card.source === "owners" && card.search && (
            <Button variant="outline" size="sm" disabled={busy} onClick={onCrm}>
              Vezi potrivirile din CRM
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
