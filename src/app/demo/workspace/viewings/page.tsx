'use client';

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Viewing } from "@/lib/types";
import { useDemoSession } from "@/components/demo/DemoSessionProvider";
import { createDemoEntityId, formatDemoDateTime } from "@/components/demo/demo-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ViewingFormState = {
  id: string;
  propertyTitle: string;
  propertyAddress: string;
  contactName: string;
  viewingDate: string;
  duration: string;
  status: Viewing["status"];
  notes: string;
};

const DEFAULT_VIEWING_FORM: ViewingFormState = {
  id: "",
  propertyTitle: "",
  propertyAddress: "",
  contactName: "",
  viewingDate: "",
  duration: "60",
  status: "scheduled",
  notes: "",
};

export default function DemoViewingsPage() {
  const { state, saveViewing, deleteViewing } = useDemoSession();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ViewingFormState>(DEFAULT_VIEWING_FORM);

  const viewings = useMemo(
    () => [...(state?.viewings || [])].sort((left, right) => new Date(left.viewingDate).getTime() - new Date(right.viewingDate).getTime()),
    [state?.viewings]
  );

  const openCreate = () => {
    setForm(DEFAULT_VIEWING_FORM);
    setIsOpen(true);
  };

  const openEdit = (viewing: Viewing) => {
    setForm({
      id: viewing.id,
      propertyTitle: viewing.propertyTitle,
      propertyAddress: viewing.propertyAddress,
      contactName: viewing.contactName,
      viewingDate: viewing.viewingDate.slice(0, 16),
      duration: String(viewing.duration || 60),
      status: viewing.status,
      notes: viewing.notes || "",
    });
    setIsOpen(true);
  };

  const handleSave = () => {
    const selectedProperty = state?.properties.find((item) => item.title === form.propertyTitle) || state?.properties[0];
    const selectedContact = state?.contacts.find((item) => item.name === form.contactName) || state?.contacts[0];
    const selectedAgent = state?.agents[0];

    const nextViewing: Viewing = {
      id: form.id || createDemoEntityId("demo-viewing"),
      propertyId: selectedProperty?.id || "demo-property-unassigned",
      propertyTitle: form.propertyTitle.trim() || selectedProperty?.title || "Proprietate demo",
      propertyAddress: form.propertyAddress.trim() || selectedProperty?.address || "Bucuresti",
      contactId: selectedContact?.id || "demo-contact-unassigned",
      contactName: form.contactName.trim() || selectedContact?.name || "Contact demo",
      agentId: selectedAgent?.id || "demo-admin",
      agentName: selectedAgent?.name || "Agent demo",
      viewingDate: form.viewingDate ? new Date(form.viewingDate).toISOString() : new Date().toISOString(),
      duration: Number(form.duration) || 60,
      notes: form.notes.trim() || undefined,
      status: form.status,
      createdAt: new Date().toISOString(),
    };

    saveViewing(nextViewing);
    setIsOpen(false);
  };

  if (!state) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="rounded-[24px] border border-[var(--app-surface-border)] bg-white/72 px-5 py-4 shadow-[var(--agentfinder-soft-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Calendar demo</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Vizionarile pot fi mutate sau rescrise local pentru prezentari personalizate catre agentii.
          </p>
        </div>
        <Button type="button" className="rounded-full border-0 bg-[var(--agentfinder-primary-button)] text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Vizionare noua
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {viewings.map((viewing) => (
          <Card key={viewing.id} className="rounded-[28px] border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] shadow-[var(--agentfinder-card-shadow)]">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-xl text-slate-950">{viewing.propertyTitle}</CardTitle>
                  <p className="mt-2 text-sm text-slate-600">{viewing.contactName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => openEdit(viewing)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => deleteViewing(viewing.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{viewing.status}</Badge>
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{viewing.agentName || "Agent demo"}</Badge>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Programare</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{formatDemoDateTime(viewing.viewingDate)}</p>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Adresa</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{viewing.propertyAddress}</p>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Note</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{viewing.notes || "Fara notite aditionale."}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-[28px] border border-[var(--app-surface-border)] bg-white">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editeaza vizionare demo" : "Vizionare noua in demo"}</DialogTitle>
            <DialogDescription>Programarea salvata aici este vizibila doar in sesiunea locala curenta.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Titlu proprietate" value={form.propertyTitle} onChange={(e) => setForm((current) => ({ ...current, propertyTitle: e.target.value }))} />
            <Input placeholder="Contact" value={form.contactName} onChange={(e) => setForm((current) => ({ ...current, contactName: e.target.value }))} />
            <Input placeholder="Adresa proprietate" value={form.propertyAddress} onChange={(e) => setForm((current) => ({ ...current, propertyAddress: e.target.value }))} />
            <Input type="datetime-local" value={form.viewingDate} onChange={(e) => setForm((current) => ({ ...current, viewingDate: e.target.value }))} />
            <Input placeholder="Durata in minute" value={form.duration} onChange={(e) => setForm((current) => ({ ...current, duration: e.target.value }))} />
            <Input placeholder="Status" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as Viewing["status"] }))} />
          </div>
          <Textarea placeholder="Note" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Anuleaza</Button>
            <Button type="button" onClick={handleSave}>Salveaza local</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
