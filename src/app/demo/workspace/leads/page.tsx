'use client';

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Contact } from "@/lib/types";
import { useDemoSession } from "@/components/demo/DemoSessionProvider";
import { createDemoEntityId, formatDemoCurrency, formatDemoDate } from "@/components/demo/demo-utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type ContactFormState = {
  id: string;
  name: string;
  email: string;
  phone: string;
  budget: string;
  status: Contact["status"];
  source: string;
  city: string;
  zones: string;
  description: string;
};

const DEFAULT_CONTACT_FORM: ContactFormState = {
  id: "",
  name: "",
  email: "",
  phone: "",
  budget: "",
  status: "Nou",
  source: "Website",
  city: "Bucuresti",
  zones: "",
  description: "",
};

export default function DemoLeadsPage() {
  const { state, saveContact, deleteContact } = useDemoSession();
  const [isOpen, setIsOpen] = useState(false);
  const [form, setForm] = useState<ContactFormState>(DEFAULT_CONTACT_FORM);

  const sortedContacts = useMemo(
    () => [...(state?.contacts || [])].sort((left, right) => (right.leadScore || 0) - (left.leadScore || 0)),
    [state?.contacts]
  );

  const openCreate = () => {
    setForm(DEFAULT_CONTACT_FORM);
    setIsOpen(true);
  };

  const openEdit = (contact: Contact) => {
    setForm({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      budget: contact.budget ? String(contact.budget) : "",
      status: contact.status,
      source: contact.source,
      city: contact.city || "Bucuresti",
      zones: (contact.zones || []).join(", "),
      description: contact.description || "",
    });
    setIsOpen(true);
  };

  const handleSave = () => {
    const nextContact: Contact = {
      id: form.id || createDemoEntityId("demo-contact"),
      name: form.name.trim() || "Lead Demo",
      email: form.email.trim() || "lead.demo@example.com",
      phone: form.phone.trim() || "+40 721 000 000",
      source: form.source.trim() || "Website",
      budget: form.budget ? Number(form.budget) : undefined,
      status: form.status,
      description: form.description.trim() || undefined,
      contactType: "Cumparator",
      city: form.city.trim() || "Bucuresti",
      zones: form.zones
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
      priority: "Medie",
      leadScore: 60,
      leadScoreReason: "editat local in workspace-ul demo",
    };

    saveContact(nextContact);
    setIsOpen(false);
  };

  if (!state) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="rounded-[24px] border border-[var(--app-surface-border)] bg-white/72 px-5 py-4 shadow-[var(--agentfinder-soft-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Lead management demo</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            Creezi, editezi si stergi lead-uri doar in sesiunea demo locala. Nimic nu ajunge in conturile reale.
          </p>
        </div>
        <Button
          type="button"
          className="rounded-full border-0 bg-[var(--agentfinder-primary-button)] text-white shadow-[var(--agentfinder-primary-button-shadow)] hover:bg-[var(--agentfinder-primary-button-hover)]"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" />
          Lead nou
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {sortedContacts.map((contact) => (
          <Card key={contact.id} className="rounded-[28px] border-[var(--app-surface-border)] bg-[var(--agentfinder-card-bg)] shadow-[var(--agentfinder-card-shadow)]">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-xl text-slate-950">{contact.name}</CardTitle>
                  <p className="mt-2 text-sm text-slate-600">{contact.email}</p>
                  <p className="mt-1 text-sm text-slate-600">{contact.phone}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => openEdit(contact)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="rounded-full bg-white/80" onClick={() => deleteContact(contact.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{contact.status}</Badge>
                <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{contact.source}</Badge>
                {contact.city ? (
                  <Badge variant="outline" className="border-[var(--app-surface-border)] bg-white/82 text-slate-700">{contact.city}</Badge>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Buget</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{formatDemoCurrency(contact.budget || 0)}</p>
                </div>
                <div className="rounded-[18px] bg-white/80 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Creat la</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{contact.createdAt ? formatDemoDate(contact.createdAt) : "-"}</p>
                </div>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Zone</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{contact.zones?.join(", ") || "Necompletat"}</p>
              </div>
              <div className="rounded-[18px] bg-white/80 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Context</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{contact.description || contact.leadScoreReason || "Lead demo fara context aditional."}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="rounded-[28px] border border-[var(--app-surface-border)] bg-white">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editeaza lead demo" : "Lead nou in demo"}</DialogTitle>
            <DialogDescription>
              Datele salvate aici raman doar in sesiunea curenta de demo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input placeholder="Nume" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))} />
            <Input placeholder="Telefon" value={form.phone} onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))} />
            <Input placeholder="Buget" value={form.budget} onChange={(e) => setForm((current) => ({ ...current, budget: e.target.value }))} />
            <Input placeholder="Status" value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as Contact["status"] }))} />
            <Input placeholder="Sursa" value={form.source} onChange={(e) => setForm((current) => ({ ...current, source: e.target.value }))} />
            <Input placeholder="Oras" value={form.city} onChange={(e) => setForm((current) => ({ ...current, city: e.target.value }))} />
            <Input placeholder="Zone separate prin virgula" value={form.zones} onChange={(e) => setForm((current) => ({ ...current, zones: e.target.value }))} />
          </div>
          <Textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Anuleaza</Button>
            <Button type="button" onClick={handleSave}>Salveaza local</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
