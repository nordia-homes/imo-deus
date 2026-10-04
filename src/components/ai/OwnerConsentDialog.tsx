"use client";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
export type Consent = {
  listingId: string;
  title: string;
  phone: string;
  connectionId: string;
  connections: { id: string; name: string }[];
  evidence: string;
  purpose: "marketing" | "service";
  confirmed: boolean;
  calledAt: string;
};
export async function loadOwnerConsent(
  api: (path: string, body?: unknown) => Promise<any>,
  row: Record<string, unknown>,
): Promise<Consent> {
  const [favorite, connections] = await Promise.all([
    api("/api/ai-assistant/workspace", {
      kind: "read",
      query: { resource: "ownerListingFavorites", id: row.id },
    }),
    api("/api/ai-assistant/workspace", {
      kind: "read",
      query: { resource: "channelConnections", limit: 100 },
    }),
  ]);
  const available = connections.rows.filter(
    (c: any) => c.channel === "whatsapp" && c.status === "connected",
  );
  return {
    listingId: String(row.id),
    title: String(row.title || favorite.rows[0]?.title || "Proprietar"),
    phone: favorite.rows[0]?.ownerPhone || "",
    connectionId: available[0]?.id || "",
    connections: available,
    evidence: "",
    purpose: "marketing",
    confirmed: false,
    calledAt: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16),
  };
}
export function consentPayload(current: Consent) {
  return {
    listingId: current.listingId,
    connectionId: current.connectionId,
    confirmedPhoneConsent: current.confirmed,
    purpose: current.purpose,
    calledAt: new Date(current.calledAt).toISOString(),
    evidence: current.evidence,
  };
}
export function OwnerConsentDialog({
  consent,
  setConsent,
  busy,
  error,
  saveConsent,
}: {
  consent: Consent | null;
  setConsent: Dispatch<SetStateAction<Consent | null>>;
  busy: boolean;
  error: string;
  saveConsent: () => void;
}) {
  return (
    <>
      {consent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consent-title"
        >
          <div className="w-full max-w-lg rounded-2xl bg-background p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 id="consent-title" className="text-lg font-semibold">
                Confirm acordul WhatsApp
              </h2>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Închide"
                onClick={() => setConsent(null)}
                disabled={busy}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="my-3 text-sm">
              {consent.title} • {consent.phone || "Telefon indisponibil"}
            </p>
            <label className="block text-sm">
              Număr WhatsApp al agenției
              <select
                className="my-2 w-full rounded-md border bg-background p-2"
                value={consent.connectionId}
                onChange={(e) =>
                  setConsent((c) => c && { ...c, connectionId: e.target.value })
                }
              >
                {consent.connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Scop
              <select
                className="my-2 w-full rounded-md border bg-background p-2"
                value={consent.purpose}
                onChange={(e) =>
                  setConsent(
                    (c) =>
                      c && {
                        ...c,
                        purpose: e.target.value as Consent["purpose"],
                      },
                  )
                }
              >
                <option value="marketing">
                  Propunere de colaborare / marketing
                </option>
                <option value="service">Comunicare de serviciu</option>
              </select>
            </label>
            <label className="block text-sm">
              Data și ora apelului
              <input
                type="datetime-local"
                className="my-2 w-full rounded-md border bg-background p-2"
                value={consent.calledAt}
                onChange={(e) =>
                  setConsent((c) => c && { ...c, calledAt: e.target.value })
                }
              />
            </label>
            {!consent.connections.length && (
              <p className="my-2 text-sm text-amber-700">
                Nu există un număr WhatsApp conectat al agenției.
              </p>
            )}
            <label className="block text-sm">
              Ce a confirmat proprietarul în apel
              <textarea
                className="my-2 min-h-24 w-full rounded-md border bg-background p-2"
                value={consent.evidence}
                maxLength={2000}
                onChange={(e) =>
                  setConsent((c) => c && { ...c, evidence: e.target.value })
                }
              />
            </label>
            <label className="my-4 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consent.confirmed}
                onChange={(e) =>
                  setConsent((c) => c && { ...c, confirmed: e.target.checked })
                }
              />
              <span>
                Confirm că am obținut în apel acordul proprietarului pentru
                mesaje WhatsApp cu scopul selectat.
              </span>
            </label>
            {error && (
              <p role="alert" className="mb-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              className="w-full"
              disabled={
                busy ||
                !consent.confirmed ||
                !consent.connectionId ||
                !consent.phone ||
                !consent.calledAt ||
                consent.evidence.trim().length < 10
              }
              onClick={saveConsent}
            >
              Înregistrează acordul
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
